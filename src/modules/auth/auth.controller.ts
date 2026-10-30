import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { CookieOptions } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PhoneThrottlerGuard } from '../../common/phone-throttler.guard';
import { CheckPhoneDto } from './dto/register.dto';
import { normalizePhone } from '../../shared/utils/phone-normalizer';
import { UserRepository } from '../users/repositories/user.repository';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
};
const ACCESS_TOKEN_OPTIONS = {
  path: '/',
  ...COOKIE_OPTIONS,
  maxAge: 24 * 60 * 60 * 1000,
};
const REFRESH_TOKEN_OPTIONS = {
  path: '/api/auth/refresh',
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
  ) {}
  // -------------- Login --------------
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      message: result.message,
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };
  }

  @Post('check-phone')
  @HttpCode(200)
  @UseGuards(PhoneThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkPhone(@Body() dto: CheckPhoneDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('INVALID_PHONE');

    const exists = await this.userRepository.findByPhone(phone);
    return { available: !exists };
  }
}
