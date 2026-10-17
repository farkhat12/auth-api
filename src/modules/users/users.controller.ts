import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../../main';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.getMe(request.user.userId);
  }
}
