import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createTestApp, TestContext } from './setup';

const API = '/api/v1';

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  let jwt: JwtService;

  beforeAll(async () => {
    ctx = await createTestApp();
    jwt = ctx.app.get(JwtService);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    for (const delegate of Object.values(ctx.prisma)) {
      if (typeof delegate === 'object') {
        for (const fn of Object.values(delegate as any)) {
          if (typeof fn === 'function' && 'mockReset' in (fn as any)) {
            (fn as jest.Mock).mockReset();
          }
        }
      }
    }
  });

  function accessTokenFor(
    userId = 'user-1',
    sessionId = 'session-1',
    role = 'CUSTOMER',
  ) {
    return jwt.sign(
      { sub: userId, email: 'user@example.com', role, sid: sessionId },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  describe('POST /auth/register — input validation', () => {
    it('rejects a malformed email', async () => {
      await request(ctx.app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          email: 'not-an-email',
          password: 'Valid@12345',
          firstName: 'A',
          lastName: 'B',
        })
        .expect(400);
    });

    it('rejects a missing password', async () => {
      await request(ctx.app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({ email: 'a@example.com', firstName: 'A', lastName: 'B' })
        .expect(400);
    });

    it('strips unknown fields rather than trusting them', async () => {
      // `whitelist: true` + `forbidNonWhitelisted: true` means an attempt
      // to smuggle in `role: ADMIN` is rejected outright, not silently
      // dropped — worth an explicit test since privilege escalation is
      // exactly what this setting exists to prevent.
      await request(ctx.app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          email: 'a@example.com',
          password: 'Valid@12345',
          firstName: 'A',
          lastName: 'B',
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 401 for a user that does not exist', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(null);

      await request(ctx.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'nobody@example.com', password: 'whatever' })
        .expect(401);
    });

    it('returns both tokens for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('Customer@12345', 10);
      ctx.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        passwordHash,
        role: 'CUSTOMER',
        isActive: true,
      });
      ctx.prisma.session.create.mockResolvedValue({});

      const res = await request(ctx.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'customer@example.com', password: 'Customer@12345' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('never echoes the password hash back to the client', async () => {
      const passwordHash = await bcrypt.hash('Customer@12345', 10);
      ctx.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        passwordHash,
        role: 'CUSTOMER',
        isActive: true,
      });
      ctx.prisma.session.create.mockResolvedValue({});

      const res = await request(ctx.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'customer@example.com', password: 'Customer@12345' });

      expect(JSON.stringify(res.body)).not.toContain(passwordHash);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('GET /auth/sessions — guard behaviour', () => {
    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer())
        .get(`${API}/auth/sessions`)
        .expect(401);
    });

    it('rejects a token signed with the wrong secret', async () => {
      const forged = jwt.sign(
        { sub: 'user-1', role: 'ADMIN', sid: 'session-1' },
        { secret: 'attacker-secret', expiresIn: '15m' },
      );

      await request(ctx.app.getHttpServer())
        .get(`${API}/auth/sessions`)
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = jwt.sign(
        { sub: 'user-1', role: 'CUSTOMER', sid: 'session-1' },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '-1s' },
      );

      await request(ctx.app.getHttpServer())
        .get(`${API}/auth/sessions`)
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('lists the caller’s live sessions and flags the current one', async () => {
      ctx.prisma.session.findMany.mockResolvedValue([
        {
          id: 'session-1',
          userAgent: 'laptop',
          ipAddress: '10.0.0.1',
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
        {
          id: 'session-2',
          userAgent: 'phone',
          ipAddress: '10.0.0.2',
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ]);

      const res = await request(ctx.app.getHttpServer())
        .get(`${API}/auth/sessions`)
        .set('Authorization', `Bearer ${accessTokenFor('user-1', 'session-2')}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.find((s: any) => s.id === 'session-2').current).toBe(true);
      expect(res.body.find((s: any) => s.id === 'session-1').current).toBe(false);
      expect(res.body[0]).not.toHaveProperty('hashedRefreshToken');
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    it('returns 404 when the session is not the caller’s', async () => {
      ctx.prisma.session.updateMany.mockResolvedValue({ count: 0 });

      await request(ctx.app.getHttpServer())
        .delete(`${API}/auth/sessions/someone-elses`)
        .set('Authorization', `Bearer ${accessTokenFor()}`)
        .expect(404);
    });

    it('revokes a session the caller owns', async () => {
      ctx.prisma.session.updateMany.mockResolvedValue({ count: 1 });

      await request(ctx.app.getHttpServer())
        .delete(`${API}/auth/sessions/session-2`)
        .set('Authorization', `Bearer ${accessTokenFor()}`)
        .expect(200);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('requires authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post(`${API}/auth/logout-all`)
        .expect(401);
    });

    it('revokes every session for the caller', async () => {
      ctx.prisma.session.updateMany.mockResolvedValue({ count: 3 });

      await request(ctx.app.getHttpServer())
        .post(`${API}/auth/logout-all`)
        .set('Authorization', `Bearer ${accessTokenFor()}`)
        .expect(201);

      expect(ctx.prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
