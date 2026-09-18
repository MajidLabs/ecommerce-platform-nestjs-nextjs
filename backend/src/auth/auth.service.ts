import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { addDuration } from './utils/duration';

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface TokenSubject {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });
    await this.prisma.cart.create({ data: { userId: user.id } });

    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user, meta);
  }

  async refresh(
    userId: string,
    sessionId: string,
    refreshToken: string,
    meta: SessionMeta,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    const sessionIsUsable =
      session &&
      session.userId === userId &&
      !session.revokedAt &&
      session.expiresAt > new Date();

    if (!sessionIsUsable) {
      throw new UnauthorizedException();
    }

    const fingerprint = createHash('sha256').update(refreshToken).digest('hex');
    const valid = await bcrypt.compare(
      fingerprint,
      session.hashedRefreshToken,
    );
    if (!valid) {
      // The presented refresh token doesn't match what's on file for a
      // session that otherwise looks valid — most likely a token that
      // was already rotated away (reused old token). Revoke the session
      // outright rather than just rejecting this one call.
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    return this.issueTokens(user, meta, sessionId);
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Session not found');
    }
    return { success: true };
  }

  /**
   * Issues a fresh access/refresh token pair. When `existingSessionId` is
   * given (the /auth/refresh path), the same Session row is rotated in
   * place; otherwise a new row — a new logged-in device — is created.
   * The session id is generated up front so it can be embedded in both
   * tokens' `sid` claim before the row exists.
   */
  private async issueTokens(
    user: TokenSubject,
    meta: SessionMeta,
    existingSessionId?: string,
  ) {
    const sessionId = existingSessionId ?? randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    const accessExpiration = process.env.JWT_ACCESS_EXPIRATION || '15m';
    const refreshExpiration = process.env.JWT_REFRESH_EXPIRATION || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: accessExpiration,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: refreshExpiration,
    });

    const refreshFingerprint = createHash('sha256').update(refreshToken).digest('hex');
    const hashedRefreshToken = await bcrypt.hash(refreshFingerprint, 10);
    const expiresAt = addDuration(new Date(), refreshExpiration);

    if (existingSessionId) {
      await this.prisma.session.update({
        where: { id: existingSessionId },
        data: {
          hashedRefreshToken,
          expiresAt,
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
        },
      });
    } else {
      await this.prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          hashedRefreshToken,
          expiresAt,
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
        },
      });
    }

    return { accessToken, refreshToken };
  }
}
