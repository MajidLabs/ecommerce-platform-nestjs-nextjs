import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestContext } from './setup';

const API = '/api/v1';

/**
 * These tests exist because the STAFF/ADMIN split was written down in
 * ARCHITECTURE.md before it was verified, and the docs turned out to be
 * wrong about it once. Documentation drifts silently; a failing test
 * does not. Each case below is the executable version of one line in
 * that document.
 */
describe('Role-based access control (e2e)', () => {
  let ctx: TestContext;
  let jwt: JwtService;

  beforeAll(async () => {
    ctx = await createTestApp();
    jwt = ctx.app.get(JwtService);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function tokenFor(role: 'CUSTOMER' | 'STAFF' | 'ADMIN') {
    return jwt.sign(
      {
        sub: `${role.toLowerCase()}-id`,
        email: `${role.toLowerCase()}@example.com`,
        role,
        sid: 'session-1',
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  const server = () => ctx.app.getHttpServer();

  describe('product catalogue is public', () => {
    it('lets an anonymous visitor browse products', async () => {
      ctx.prisma.product.findMany.mockResolvedValue([]);
      ctx.prisma.product.count.mockResolvedValue(0);

      await request(server()).get(`${API}/products`).expect(200);
    });
  });

  describe('product management', () => {
    it('blocks a customer from creating a product', async () => {
      await request(server())
        .post(`${API}/products`)
        .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
        .send({ name: 'Sneaky', slug: 'sneaky', price: 10, categoryId: 'c1' })
        .expect(403);
    });

    it('blocks an anonymous request from creating a product', async () => {
      await request(server())
        .post(`${API}/products`)
        .send({ name: 'Sneaky', slug: 'sneaky', price: 10, categoryId: 'c1' })
        .expect(401);
    });

    it('lets STAFF edit a product, including its price', async () => {
      // Explicitly asserted because ARCHITECTURE.md originally claimed
      // price changes were ADMIN-only. They are not.
      ctx.prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      ctx.prisma.product.update.mockResolvedValue({ id: 'p1', price: 99 });

      const res = await request(server())
        .patch(`${API}/products/p1`)
        .set('Authorization', `Bearer ${tokenFor('STAFF')}`)
        .send({ price: 99 });

      expect(res.status).not.toBe(403);
    });

    it('blocks STAFF from deleting a product', async () => {
      await request(server())
        .delete(`${API}/products/p1`)
        .set('Authorization', `Bearer ${tokenFor('STAFF')}`)
        .expect(403);
    });

    it('lets ADMIN delete a product', async () => {
      ctx.prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      ctx.prisma.product.update.mockResolvedValue({ id: 'p1' });

      const res = await request(server())
        .delete(`${API}/products/p1`)
        .set('Authorization', `Bearer ${tokenFor('ADMIN')}`);

      expect(res.status).not.toBe(403);
    });
  });

  describe('coupon management is ADMIN-only for writes', () => {
    it('lets STAFF read the coupon list', async () => {
      ctx.prisma.coupon.findMany.mockResolvedValue([]);

      await request(server())
        .get(`${API}/coupons`)
        .set('Authorization', `Bearer ${tokenFor('STAFF')}`)
        .expect(200);
    });

    it('blocks STAFF from creating a coupon', async () => {
      await request(server())
        .post(`${API}/coupons`)
        .set('Authorization', `Bearer ${tokenFor('STAFF')}`)
        .send({ code: 'STAFFONLY', type: 'PERCENTAGE', value: 50 })
        .expect(403);
    });

    it('blocks STAFF from deleting a coupon', async () => {
      await request(server())
        .delete(`${API}/coupons/c1`)
        .set('Authorization', `Bearer ${tokenFor('STAFF')}`)
        .expect(403);
    });

    it('blocks a customer from reading the coupon list', async () => {
      await request(server())
        .get(`${API}/coupons`)
        .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
        .expect(403);
    });

    it('lets ADMIN create a coupon', async () => {
      ctx.prisma.coupon.create.mockResolvedValue({ id: 'c1' });

      const res = await request(server())
        .post(`${API}/coupons`)
        .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
        .send({ code: 'ADMINMADE', type: 'PERCENTAGE', value: 20 });

      expect(res.status).not.toBe(403);
    });
  });
});
