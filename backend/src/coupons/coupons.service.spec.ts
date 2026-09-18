import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponType } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

// Builds a coupon that passes every validation gate, so each test can
// override exactly the one field it's about and nothing else.
function validCoupon(overrides: Record<string, any> = {}) {
  return {
    id: 'coupon-1',
    code: 'WELCOME10',
    type: CouponType.PERCENTAGE,
    value: 10,
    minOrderAmount: null,
    maxDiscountAmount: null,
    usageLimit: null,
    usedCount: 0,
    validUntil: null,
    isActive: true,
    ...overrides,
  };
}

describe('CouponsService', () => {
  let service: CouponsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CouponsService);
  });

  describe('validate — discount maths', () => {
    it('takes the given percentage off the subtotal', async () => {
      prisma.coupon.findUnique.mockResolvedValue(validCoupon({ value: 10 }));

      const result = await service.validate('WELCOME10', 200);

      expect(result.discountAmount).toBe(20);
      expect(result.valid).toBe(true);
    });

    it('subtracts a flat amount for FIXED_AMOUNT coupons, ignoring subtotal size', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ type: CouponType.FIXED_AMOUNT, value: 15 }),
      );

      const result = await service.validate('FLAT15', 200);

      expect(result.discountAmount).toBe(15);
    });

    it('caps a percentage discount at maxDiscountAmount', async () => {
      // 25% of 1000 would be 250, but the coupon is capped at 50.
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ value: 25, maxDiscountAmount: 50 }),
      );

      const result = await service.validate('BIG25', 1000);

      expect(result.discountAmount).toBe(50);
    });

    it('leaves the discount alone when it lands under the cap', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ value: 10, maxDiscountAmount: 50 }),
      );

      const result = await service.validate('WELCOME10', 100);

      expect(result.discountAmount).toBe(10);
    });

    it('handles Prisma Decimal values arriving as strings', async () => {
      // Decimal columns come back as Decimal/string, not number — the
      // service wraps them in Number() for exactly this reason.
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ value: '10', minOrderAmount: '50' }),
      );

      const result = await service.validate('WELCOME10', 200);

      expect(result.discountAmount).toBe(20);
    });
  });

  describe('validate — rejection rules', () => {
    it('rejects a code that does not exist', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.validate('NOPE', 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a deactivated coupon', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ isActive: false }),
      );

      await expect(service.validate('WELCOME10', 100)).rejects.toThrow(
        'Invalid coupon',
      );
    });

    it('rejects a coupon whose validUntil has passed', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ validUntil: new Date('2020-01-01') }),
      );

      await expect(service.validate('WELCOME10', 100)).rejects.toThrow(
        'Coupon expired',
      );
    });

    it('accepts a coupon whose validUntil is still in the future', async () => {
      const future = new Date(Date.now() + 86_400_000);
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ validUntil: future }),
      );

      await expect(service.validate('WELCOME10', 100)).resolves.toMatchObject({
        valid: true,
      });
    });

    it('rejects once usedCount has reached usageLimit', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ usageLimit: 5, usedCount: 5 }),
      );

      await expect(service.validate('WELCOME10', 100)).rejects.toThrow(
        'Coupon usage limit reached',
      );
    });

    it('still accepts the coupon on the final allowed use', async () => {
      // Boundary: usedCount 4 of 5 must pass; 5 of 5 must not.
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ usageLimit: 5, usedCount: 4 }),
      );

      await expect(service.validate('WELCOME10', 100)).resolves.toMatchObject({
        valid: true,
      });
    });

    it('rejects a subtotal below minOrderAmount', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ minOrderAmount: 50 }),
      );

      await expect(service.validate('WELCOME10', 49.99)).rejects.toThrow(
        /Minimum order amount/,
      );
    });

    it('accepts a subtotal exactly equal to minOrderAmount', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ minOrderAmount: 50 }),
      );

      await expect(service.validate('WELCOME10', 50)).resolves.toMatchObject({
        valid: true,
      });
    });
  });

  describe('create / findOne', () => {
    it('upper-cases the code so lookups are case-insensitive in practice', async () => {
      prisma.coupon.create.mockResolvedValue({});

      await service.create({ code: 'summer', type: CouponType.PERCENTAGE, value: 5 } as any);

      expect(prisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'SUMMER' }),
        }),
      );
    });

    it('throws NotFound for a missing coupon id', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deactivates rather than deleting, preserving order history', async () => {
      prisma.coupon.findUnique.mockResolvedValue(validCoupon());
      prisma.coupon.update.mockResolvedValue({});

      await service.remove('coupon-1');

      expect(prisma.coupon.delete).not.toHaveBeenCalled();
      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { isActive: false },
      });
    });
  });
});
