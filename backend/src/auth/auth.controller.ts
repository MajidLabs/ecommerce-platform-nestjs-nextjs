import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService, SessionMeta } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// Login and register get a much stricter limit than the rest of the API
// (5/min per IP vs the global 100/min): these are the endpoints a
// credential-stuffing or brute-force script actually hits, so the general
// API limit — sized for normal browsing — does nothing to slow that down.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractMeta(req));
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractMeta(req));
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  refresh(@Req() req: any) {
    return this.authService.refresh(
      req.user.userId,
      req.user.sessionId,
      req.user.refreshToken,
      this.extractMeta(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.userId, user.sessionId);
  }

  // Revokes every session for the user, not just the caller's own —
  // handy after a password change or a "log me out everywhere" request.
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: any) {
    return this.authService.logoutAll(user.userId);
  }

  // Lets a user see which devices/browsers are currently logged in to
  // their account, so they can recognize (or revoke) ones they don't.
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: any) {
    return this.authService.listSessions(user.userId, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.authService.revokeSession(user.userId, id);
  }

  private extractMeta(req: Request): SessionMeta {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
