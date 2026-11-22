import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { REDIS } from '../../infrastructure/redis/redis.constants';
import Redis from 'ioredis';
import { normalizePhone } from '../../shared/utils/phone-normalizer';
import {
  HOURLY_LIMIT,
  MAX_VERIFY_ATTEMPTS,
  OTP_BLOCK_TTL,
  OTP_COOLDOWN,
  OTP_EXPIRES_IN,
  OTP_REDIS_TTL,
  OtpKeys,
  OtpPurpose,
} from './otp.constants';
import { OtpUtils } from './utils/otp.utils';

@Injectable()
export class OtpService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  // ------------------ Send otp ------------------
  async sendOtp(phone: string, purpose: OtpPurpose) {
    // Redis keys
    const blockKey = OtpKeys.block(purpose, phone);
    const otpKey = OtpKeys.otp(purpose, phone);
    const hourlyLimitKey = OtpKeys.hourlyLimit(purpose, phone);
    const cooldownKey = OtpKeys.cooldown(purpose, phone);

    // 1) Блок тексеру
    const blockTtl = await this.redis.ttl(blockKey);
    if (blockTtl > 0) {
      const minutes = Math.ceil(blockTtl / 60);
      throw new HttpException(
        `Блокталдыңыз, ${minutes} минуттан кейін қайталаңыз`,
        HttpStatus.FORBIDDEN,
      );
    }

    // 2) Hourly Limit тексеру (OTP_CONFIG.HOURLY_LIMIT қолданылады)
    const hourlyCountStr = await this.redis.get(hourlyLimitKey);
    const hourlyCount = hourlyCountStr ? parseInt(hourlyCountStr, 10) : 0;
    if (hourlyCount >= HOURLY_LIMIT) {
      const ttl = await this.redis.ttl(hourlyLimitKey);
      const minutes = Math.ceil(ttl / 60);
      throw new HttpException(
        `Тым көп сұрау жасалды. ${minutes} минуттан кейін қайталаңыз.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3) Екінші: Cooldown тексеру
    const cooldownTtl = await this.redis.ttl(cooldownKey);

    if (cooldownTtl > 0) {
      return {
        success: true,
        message: 'OTP already active. Please enter the code.',
      };
    }
    // 4) Generate OTP and save on Redis
    const rawCode = OtpUtils.generateOtp();
    const hashedCode = OtpUtils.hashOtp(rawCode);
    const expiresAt = Date.now() + OTP_EXPIRES_IN * 1000;

    console.log(phone, '', rawCode);

    const multi = this.redis.multi();
    multi.hset(otpKey, {
      hashedCode,
      expiresAt: expiresAt.toString(),
      attempts: '0',
    });
    multi.expire(otpKey, OTP_REDIS_TTL);
    multi.set(cooldownKey, '1', 'EX', OTP_COOLDOWN);

    multi.incr(hourlyLimitKey);

    if (hourlyCount === 0) {
      multi.expire(hourlyLimitKey, 60 * 60); // 1 сағат TTL (3600 сек)
    }

    await multi.exec();

    // await this.smsService.send(phone, rawCode);
    return {
      message: 'OTP sent successfuly',
      cooldownRemaining: OTP_COOLDOWN,
    };
  }
  // ----------------- Verify otp -----------------
  async verifyOtp(rawPhone: string, rawCode: string, purpose: OtpPurpose) {
    const phone = normalizePhone(rawPhone);
    // Redis keys
    const blockKey = OtpKeys.block(purpose, phone);
    const otpKey = OtpKeys.otp(purpose, phone);
    const cooldownKey = OtpKeys.cooldown(purpose, phone);

    // 1) Блок тексеру
    const blockTtl = await this.redis.ttl(blockKey);
    if (blockTtl > 0) {
      throw new HttpException(
        `Блокталдыңыз, ${blockTtl} секундтан кейін қайталаңыз`,
        HttpStatus.FORBIDDEN,
      );
    }

    // 2) OTP деректерін Redis-тен алу
    const otpData = await this.redis.hgetall(otpKey);
    if (!otpData || !otpData.hashedCode) {
      throw new HttpException(
        'OTP табылмады немесе мерзімі өтіп кеткен.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3) Уақыты біткенін тексеру (OtpUtils арқылы)
    if (OtpUtils.isExpired(otpData.expiresAt)) {
      await this.redis.del(otpKey);
      throw new HttpException(
        'OTP уақыты өтіп кетті. Жаңа код сұраңыз.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4) Кодты салыстыру (Timing-safe hash verification)
    const isValid = OtpUtils.verifyCodeHash(rawCode, otpData.hashedCode);

    if (!isValid) {
      const attempts = await this.redis.hincrby(otpKey, 'attempts', 1);
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        const multi = this.redis.multi();
        multi.del(otpKey);
        multi.set(blockKey, '1', 'EX', OTP_BLOCK_TTL);
        await multi.exec();

        throw new HttpException(
          `Қате әрекеттер саны асып кетті. Нөмір 15 минутқа блокталды.`,
          HttpStatus.FORBIDDEN,
        );
      }

      const remainingAttempts = MAX_VERIFY_ATTEMPTS - attempts;
      throw new HttpException(
        `Қате код енгізілді. Қалған әрекет саны: ${remainingAttempts}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 5) Сәтті расталған жағдайда — OTP және Cooldown кілттерін тазалаймыз (Atomic)
    const multi = this.redis.multi();
    multi.del(otpKey);
    multi.del(cooldownKey);
    await multi.exec();

    return {
      message: 'OTP сәтті расталды!',
    };
  }
}
