import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { CookieOptions, Response } from 'express';

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
  constructor(private readonly authService: AuthService) {}
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
}
