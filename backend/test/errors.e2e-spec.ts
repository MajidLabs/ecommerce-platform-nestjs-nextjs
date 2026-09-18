import request from 'supertest';
import { Logger } from '@nestjs/common';
import { createTestApp, TestContext } from './setup';

const API = '/api/v1';

describe('Error handling (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('response shape', () => {
    it('returns the documented JSON envelope for a 404', async () => {
      ctx.prisma.product.findUnique.mockResolvedValue(null);
      ctx.prisma.product.findFirst.mockResolvedValue(null);

      const res = await request(ctx.app.getHttpServer())
        .get(`${API}/products/no-such-slug`)
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        path: `${API}/products/no-such-slug`,
      });
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('message');
    });

    it('returns JSON, not an HTML error page, when something blows up', async () => {
      // The frontend proxy calls res.json() on these. An HTML body here
      // would produce a second, misleading parse error on the client —
      // which is exactly the bug that was hit during development.
      ctx.prisma.product.findMany.mockRejectedValue(
        new Error('database exploded'),
      );

      const res = await request(ctx.app.getHttpServer())
        .get(`${API}/products`)
        .expect(500);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.statusCode).toBe(500);
    });

    it('does not leak the internal error message on a 500', async () => {
      ctx.prisma.product.findMany.mockRejectedValue(
        new Error('connection string: postgres://user:hunter2@db'),
      );

      const res = await request(ctx.app.getHttpServer())
        .get(`${API}/products`)
        .expect(500);

      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(res.body.message).toBe('Internal server error');
    });
  });

  describe('log levels', () => {
    it('logs an expected 4xx as a warning, without a stack trace', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await request(ctx.app.getHttpServer())
        .post(`${API}/products`)
        .expect(401);

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('logs an unexpected 5xx at error level with its stack', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      ctx.prisma.product.findMany.mockRejectedValue(new Error('boom'));

      await request(ctx.app.getHttpServer())
        .get(`${API}/products`)
        .expect(500);

      expect(errorSpy).toHaveBeenCalled();
      const [, stack] = errorSpy.mock.calls[0];
      expect(String(stack)).toContain('Error: boom');
    });
  });
});
