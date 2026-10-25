import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { normalizePhone } from '../../shared/utils/phone-normalizer';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../users/repositories/user.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { toUserResponse } from './mappers/user.mapper';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  // -------------- Login --------------
  async login(loginDto: LoginDto) {
    const phone = normalizePhone(loginDto.phone);
    const { password } = loginDto;

    const user = await this.userRepository.findByPhone(phone);

    if (!user) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const userId = user._id.toString();

    const { access_token, refresh_token } = await this.generateTokens({
      userId,
      role: user.role,
    });

    return {
      message: 'Login successful',
      access_token,
      refresh_token,
      user: toUserResponse(user),
    };
  }

  private async generateTokens(params: { userId: string; role: string }) {
    const payload = { sub: params.userId, role: params.role };
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);
    return { access_token, refresh_token };
  }
}
