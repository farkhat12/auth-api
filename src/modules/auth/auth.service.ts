import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { normalizePhone } from '../../shared/utils/phone-normalizer';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../users/repositories/user.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { toUserResponse } from './mappers/user.mapper';
import { OtpService } from '../otp/otp.service';
import { RegisterDto } from './dto/register.dto';
import { OtpPurpose } from '../otp/otp.constants';
import { VerifyOtpDto } from './dto/otp.dto';
import { REDIS } from '../../infrastructure/redis/redis.constants';
import Redis from 'ioredis';

const ACCESS_TTL_SECONDS = 30 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}
  // ----------------- Register -----------------
  async register(registerDto: RegisterDto) {
    const phone = normalizePhone(registerDto.phone);
    const tempUserKey = this.getTempUserKey(phone);
    // UserRepository арқылы нөмірдің бұрыннан бар-жоғын тексереміз
    const existingUser = await this.userRepository.findByPhone(phone);
    if (existingUser) {
      throw new ConflictException('Бұл телефон нөмірі тіркеліп қойған.');
    }
    // Құпия сөзді хештеу
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    // User деректерін Redis-ке уақытша сақтаймыз (TTL: 15 минут)
    const userData = {
      phone,
      name: registerDto.name,
      password: hashedPassword,
    };

    await this.redis.set(tempUserKey, JSON.stringify(userData), 'EX', 20 * 60);

    return await this.otpService.sendOtp(phone, OtpPurpose.REGISTER);
  }

  // ----------------- Verify -----------------
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const phone = normalizePhone(verifyOtpDto.phone);
    const tempUserKey = this.getTempUserKey(phone);
    await this.otpService.verifyOtp(
      phone,
      verifyOtpDto.otp,
      OtpPurpose.REGISTER,
    );

    // 2) ⚠️ Қосымша қауіпсіздік: Базада бұл нөмір қазірдің өзінде бар-жоғын қайта тексереміз
    const existingUser = await this.userRepository.findByPhone(phone);
    if (existingUser) {
      // Егер біреу тіркеліп үлгерсе, Redis-тегі уақытша деректі тазалап, қате қайтарамыз
      await this.redis.del(tempUserKey);
      throw new ConflictException('Бұл телефон нөмірі тіркеліп қойған.');
    }

    const userDataStr = await this.redis.get(tempUserKey);
    if (!userDataStr) {
      throw new HttpException(
        'Тіркелу сессиясының уақыты өтіп кетті.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const userData = JSON.parse(userDataStr);

    // 3) MongoDB-ге жаңа қолданушыны жазу
    const newUser = await this.userRepository.create({
      phone: userData.phone,
      name: userData.name,
      password: userData.password, // Бұл жерде зақымдалмаған, алдын ала хэштелген пароль сақталады
    });

    // 4) Уақытша Redis кілтін өшіреміз
    await this.redis.del(tempUserKey);

    const { access_token, refresh_token, accessExpiresIn, refreshExpiresIn } =
      await this.issueTokens({
        userId: newUser._id.toString(),
        role: newUser.role,
      });

    return {
      message: 'OTP verifyed successful',
      access_token,
      refresh_token,
      accessExpiresIn,
      refreshExpiresIn,
      user: toUserResponse(newUser),
    };
  }

  // ----------------- Login -----------------
  async login(loginDto: LoginDto) {
    const phone = normalizePhone(loginDto.phone);
    const { password } = loginDto;

    const user = await this.userRepository.findByPhone(phone);

    if (!user) throw new UnauthorizedException('Invalid phone or password');

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid phone or password');

    const userId = user._id.toString();

    const { access_token, refresh_token, accessExpiresIn, refreshExpiresIn } =
      await this.issueTokens({
        userId,
        role: user.role,
      });

    return {
      message: 'Login successful',
      access_token,
      refresh_token,
      accessExpiresIn,
      refreshExpiresIn,
      user: toUserResponse(user),
    };
  }

  // ----------------- Refresh -----------------
  async refresh(refreshToken: string) {
    let payload: { sub: string; role: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token'); // bad signature or expired
    }

    const user = await this.userRepository.findById(payload.sub);

    if (!user) throw new UnauthorizedException('User not found');

    const { access_token, refresh_token, accessExpiresIn, refreshExpiresIn } =
      await this.issueTokens({
        userId: payload.sub,
        role: user.role,
      });

    return {
      message: 'Tokens refreshed successfully',
      user,
      access_token,
      refresh_token,
      accessExpiresIn,
      refreshExpiresIn,
    };
  }

  // 📌 Жеке helper метод (телефонға байланысты кілтті генерациялайды)
  private getTempUserKey(phone: string): string {
    return `temp_user:${phone}`;
  }

  private async issueTokens(params: {
    userId: string;
    role: string;
  }): Promise<TokenPairResponse> {
    const payload = { sub: params.userId, role: params.role };
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TTL_SECONDS,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TTL_SECONDS,
      }),
    ]);

    return {
      access_token,
      refresh_token,
      accessExpiresIn: ACCESS_TTL_SECONDS,
      refreshExpiresIn: REFRESH_TTL_SECONDS,
    };
  }
}
