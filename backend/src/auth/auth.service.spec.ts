import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

// bcrypt is a native addon whose exports are non-configurable, so
// jest.spyOn() can't replace `compare` on it. Mocking the module up front
// is the way round that. Both functions still delegate to the real
// implementation by default — tests that care about actual hashing get
// real bcrypt, and tests that just need "the password matched" override
// `compare` for that one case.
jest.mock('bcrypt', () => {
  const actual = jest.requireActual('bcrypt');
  return {
    ...actual,
    hash: jest.fn((...args: any[]) => (actual.hash as any)(...args)),
    compare: jest.fn((...args: any[]) => (actual.compare as any)(...args)),
  };
});

const realBcrypt = jest.requireActual('bcrypt');

/** Forces the next password check to succeed or fail. */
function setPasswordMatches(matches: boolean) {
  (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(matches);
}

const META = { userAgent: 'jest', ipAddress: '127.0.0.1' };

function activeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'stored-hash',
    firstName: 'Test',
    lastName: 'User',
    role: 'CUSTOMER',
    isActive: true,
    ...overrides,
  };
}

function liveSession(overrides: Record<string, any> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    hashedRefreshToken: 'hashed-refresh',
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);

    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRATION = '15m';
    process.env.JWT_REFRESH_EXPIRATION = '7d';
  });

  afterEach(() => {
    // Module-level mocks survive restoreAllMocks(), so point them back at
    // the real implementations to keep tests independent of each other.
    (bcrypt.compare as unknown as jest.Mock).mockImplementation(
      (...args: any[]) => (realBcrypt.compare as any)(...args),
    );
    (bcrypt.hash as unknown as jest.Mock).mockImplementation(
      (...args: any[]) => (realBcrypt.hash as any)(...args),
    );
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('refuses an email that already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());

      await expect(
        service.register(
          { email: 'user@example.com', password: 'x', firstName: 'a', lastName: 'b' } as any,
          META,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password instead of storing it raw', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(activeUser());
      prisma.cart.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      await service.register(
        { email: 'new@example.com', password: 'PlainText123', firstName: 'a', lastName: 'b' } as any,
        META,
      );

      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.passwordHash).not.toBe('PlainText123');
      expect(await realBcrypt.compare('PlainText123', created.passwordHash)).toBe(true);
    });

    it('gives the new user a cart so later add-to-cart calls have somewhere to go', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(activeUser());
      prisma.cart.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      await service.register(
        { email: 'new@example.com', password: 'x', firstName: 'a', lastName: 'b' } as any,
        META,
      );

      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });
  });

  describe('login', () => {
    it('rejects an unknown email with the same message as a wrong password', async () => {
      // Deliberately identical messaging — a different error for "no such
      // user" would let an attacker enumerate registered emails.
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'x' } as any, META),
      ).rejects.toThrow('Invalid credentials');
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      setPasswordMatches(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' } as any, META),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a deactivated account even with the correct password', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser({ isActive: false }));

      await expect(
        service.login({ email: 'user@example.com', password: 'right' } as any, META),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns both tokens on success', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      setPasswordMatches(true);
      prisma.session.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'user@example.com', password: 'right' } as any,
        META,
      );

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('stores only a hash of the refresh token, never the token itself', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      setPasswordMatches(true);
      prisma.session.create.mockResolvedValue({});

      await service.login({ email: 'user@example.com', password: 'right' } as any, META);

      const stored = prisma.session.create.mock.calls[0][0].data;
      expect(stored.hashedRefreshToken).not.toBe('signed-token');
      const fingerprint = createHash('sha256').update('signed-token').digest('hex');
      expect(await realBcrypt.compare(fingerprint, stored.hashedRefreshToken)).toBe(true);
    });

    it('records the device metadata so the user can identify the session later', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      setPasswordMatches(true);
      prisma.session.create.mockResolvedValue({});

      await service.login({ email: 'user@example.com', password: 'right' } as any, {
        userAgent: 'Firefox/latest',
        ipAddress: '10.0.0.5',
      });

      const stored = prisma.session.create.mock.calls[0][0].data;
      expect(stored.userAgent).toBe('Firefox/latest');
      expect(stored.ipAddress).toBe('10.0.0.5');
    });
  });

  // This block is the whole point of the Session table: before it, a
  // second login overwrote the single refresh token on User and silently
  // logged the first device out.
  describe('multi-device sessions', () => {
    it('creates a separate session row per login instead of overwriting one', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      setPasswordMatches(true);
      prisma.session.create.mockResolvedValue({});

      await service.login({ email: 'user@example.com', password: 'right' } as any, {
        userAgent: 'laptop',
      });
      await service.login({ email: 'user@example.com', password: 'right' } as any, {
        userAgent: 'phone',
      });

      expect(prisma.session.create).toHaveBeenCalledTimes(2);
      expect(prisma.session.update).not.toHaveBeenCalled();

      const [first, second] = prisma.session.create.mock.calls;
      expect(first[0].data.id).not.toBe(second[0].data.id);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('gives each session its own sid claim in the token payload', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      setPasswordMatches(true);
      prisma.session.create.mockResolvedValue({});

      await service.login({ email: 'user@example.com', password: 'right' } as any, META);
      await service.login({ email: 'user@example.com', password: 'right' } as any, META);

      const sids = jwt.sign.mock.calls.map((call) => call[0].sid);
      expect(new Set(sids).size).toBe(2);
    });
  });

  describe('refresh', () => {
    it('rotates the stored hash in place rather than opening a new session', async () => {
      prisma.session.findUnique.mockResolvedValue(liveSession());
      setPasswordMatches(true);
      prisma.user.findUnique.mockResolvedValue(activeUser());
      prisma.session.update.mockResolvedValue({});

      await service.refresh('user-1', 'session-1', 'old-refresh', META);

      expect(prisma.session.create).not.toHaveBeenCalled();
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' } }),
      );
    });

    it('keeps the same sid across a refresh so the session identity is stable', async () => {
      prisma.session.findUnique.mockResolvedValue(liveSession());
      setPasswordMatches(true);
      prisma.user.findUnique.mockResolvedValue(activeUser());
      prisma.session.update.mockResolvedValue({});

      await service.refresh('user-1', 'session-1', 'old-refresh', META);

      for (const call of jwt.sign.mock.calls) {
        expect(call[0].sid).toBe('session-1');
      }
    });

    it('rejects a session id that does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh('user-1', 'ghost', 'token', META),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects using another user's session id", async () => {
      prisma.session.findUnique.mockResolvedValue(
        liveSession({ userId: 'someone-else' }),
      );

      await expect(
        service.refresh('user-1', 'session-1', 'token', META),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an already-revoked session', async () => {
      prisma.session.findUnique.mockResolvedValue(
        liveSession({ revokedAt: new Date() }),
      );

      await expect(
        service.refresh('user-1', 'session-1', 'token', META),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired session', async () => {
      prisma.session.findUnique.mockResolvedValue(
        liveSession({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.refresh('user-1', 'session-1', 'token', META),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('revokes the session outright when a stale refresh token is replayed', async () => {
      // A token that fails the hash check on a session that is otherwise
      // live means either a rotated-away token or a stolen one. Either
      // way the safe move is to kill the session, not just this request.
      prisma.session.findUnique.mockResolvedValue(liveSession());
      setPasswordMatches(false);
      prisma.session.update.mockResolvedValue({});

      await expect(
        service.refresh('user-1', 'session-1', 'stale-token', META),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects a valid session belonging to a since-deactivated user', async () => {
      prisma.session.findUnique.mockResolvedValue(liveSession());
      setPasswordMatches(true);
      prisma.user.findUnique.mockResolvedValue(activeUser({ isActive: false }));

      await expect(
        service.refresh('user-1', 'session-1', 'good-token', META),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes only the calling session, leaving other devices signed in', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-1', 'session-1');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('soft-revokes instead of deleting the row', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-1', 'session-1');

      expect(prisma.session.delete).not.toHaveBeenCalled();
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('revokes every live session for the user', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 3 });

      await service.logoutAll('user-1');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('listSessions', () => {
    it('flags which entry is the caller’s current device', async () => {
      prisma.session.findMany.mockResolvedValue([
        liveSession({ id: 'session-1', userAgent: 'laptop' }),
        liveSession({ id: 'session-2', userAgent: 'phone' }),
      ]);

      const result = await service.listSessions('user-1', 'session-2');

      expect(result.map((s) => s.current)).toEqual([false, true]);
    });

    it('never leaks the stored refresh token hash to the client', async () => {
      prisma.session.findMany.mockResolvedValue([liveSession()]);

      const result = await service.listSessions('user-1', 'session-1');

      expect(result[0]).not.toHaveProperty('hashedRefreshToken');
    });

    it('asks only for sessions that are live and unexpired', async () => {
      prisma.session.findMany.mockResolvedValue([]);

      await service.listSessions('user-1', 'session-1');

      const where = prisma.session.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('user-1');
      expect(where.revokedAt).toBeNull();
      expect(where.expiresAt).toHaveProperty('gt');
    });
  });

  describe('revokeSession', () => {
    it("will not revoke a session that isn't the caller's", async () => {
      // updateMany is scoped by userId, so someone else's session id
      // simply matches nothing — which surfaces as NotFound.
      prisma.session.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeSession('user-1', 'someone-elses-session'),
      ).rejects.toThrow(NotFoundException);
    });

    it('revokes a session the caller owns', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.revokeSession('user-1', 'session-2'),
      ).resolves.toEqual({ success: true });
    });
  });
});
