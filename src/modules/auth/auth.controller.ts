import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PhoneThrottlerGuard } from '../../common/phone-throttler.guard';
import { RegisterDto } from './dto/register.dto';
import { normalizePhone } from '../../shared/utils/phone-normalizer';
import { UserRepository } from '../users/repositories/user.repository';
import { VerifyOtpDto } from './dto/otp.dto';
import {
  ACCESS_TOKEN,
  cookieOptions,
  REFRESH_TOKEN,
} from './constants/auth.constants';
import { PhoneDto } from './dto/check-phone.dto';
import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '../otp/otp.constants';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly otpService: OtpService,
  ) {}

  // -------------- Login --------------
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, result);

    return { message: result.message, user: result.user };
  }

  @Post('check-phone')
  @HttpCode(200)
  async checkPhone(@Body() dto: PhoneDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('INVALID_PHONE');

    const exists = await this.userRepository.findByPhone(phone);
    if (exists) throw new ConflictException('PHONE_ALREADY_EXISTS');

    return { available: true };
  }

  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(200)
  async verify(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto);

    this.setAuthCookies(res, result);

    return { message: result.message, user: result.user };
  }

  @Post('register/resend-otp')
  @HttpCode(200)
  async resendRegisterOtp(@Body() dto: PhoneDto) {
    const phone = normalizePhone(dto.phone);
    return await this.otpService.sendOtp(phone, OtpPurpose.REGISTER);
  }

  @Post('forgot-password/resend-otp')
  @HttpCode(200)
  async resendForgot(@Body() dto: PhoneDto) {
    return await this.otpService.sendOtp(dto.phone, OtpPurpose.FORGOT_PASSWORD);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN];

    if (!refreshToken)
      throw new UnauthorizedException('Refresh token not found in cookies');

    const result = await this.authService.refresh(refreshToken);

    this.setAuthCookies(res, result);

    return { message: result.message, user: result.user };
  }

  private setAuthCookies(
    res: Response,
    tokens: {
      access_token: string;
      refresh_token: string;
      accessExpiresIn: number;
      refreshExpiresIn: number;
    },
  ) {
    res.cookie(ACCESS_TOKEN, tokens.access_token, {
      ...cookieOptions,
      maxAge: tokens.accessExpiresIn * 1000,
    });

    res.cookie(REFRESH_TOKEN, tokens.refresh_token, {
      ...cookieOptions,
      maxAge: tokens.refreshExpiresIn * 1000,
    });
  }
}
