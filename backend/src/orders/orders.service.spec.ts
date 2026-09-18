import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CouponType, OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

const SHIPPING = {
  shippingLine1: '1 Test St',
  shippingCity: 'Testville',
  shippingState: 'TS',
  shippingPostal: '12345',
  shippingCountry: 'US',
};

function cartItem(overrides: Record<string, any> = {}) {
  const {
    quantity = 1,
    price = 100,
    stock = 50,
    reserved = 0,
    productId = 'prod-1',
    name = 'Test Product',
  } = overrides;
  return {
    productId,
    quantity,
    product: {
      id: productId,
      name,
      price,
      inventory: { quantity: stock, reserved },
    },
  };
}

function cartWith(items: any[]) {
  return { id: 'cart-1', userId: 'user-1', items };
}

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

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(OrdersService);

    prisma.order.create.mockResolvedValue({ id: 'order-1', items: [] });
    prisma.inventory.update.mockResolvedValue({});
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    prisma.coupon.update.mockResolvedValue({});
  });

  describe('createFromCart — totals', () => {
    it('rejects an empty cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(cartWith([]));

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).rejects.toThrow('Cart is empty');
    });

    it('rejects when the user has no cart at all', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('sums price × quantity across every line', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([
          cartItem({ productId: 'a', price: 25, quantity: 2 }),
          cartItem({ productId: 'b', price: 10, quantity: 3 }),
        ]),
      );

      await service.createFromCart('user-1', SHIPPING as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.subtotal).toBe(80);
      expect(data.totalAmount).toBe(80);
      expect(data.discountAmount).toBe(0);
    });

    it('handles prices arriving as Decimal strings from Postgres', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: '19.99', quantity: 2 })]),
      );

      await service.createFromCart('user-1', SHIPPING as any);

      expect(prisma.order.create.mock.calls[0][0].data.subtotal).toBeCloseTo(
        39.98,
      );
    });

    it('snapshots the unit price onto the order line', async () => {
      // Order history must not change when the product price changes
      // later, so the price is copied at purchase time.
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: 42, quantity: 1 })]),
      );

      await service.createFromCart('user-1', SHIPPING as any);

      const lines = prisma.order.create.mock.calls[0][0].data.items.create;
      expect(lines[0].unitPrice).toBe(42);
    });
  });

  describe('createFromCart — stock checks', () => {
    it('rejects an order for more units than are in stock', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ quantity: 10, stock: 5, name: 'Portable Speaker' })]),
      );

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).rejects.toThrow('Insufficient stock for Portable Speaker');
    });

    it('counts units already reserved by other pending orders as unavailable', async () => {
      // 10 on the shelf but 8 spoken for leaves 2 — a 3-unit order fails.
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ quantity: 3, stock: 10, reserved: 8 })]),
      );

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).rejects.toThrow(/Insufficient stock/);
    });

    it('allows an order that takes exactly the last available unit', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ quantity: 2, stock: 10, reserved: 8 })]),
      );

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).resolves.toBeDefined();
    });

    it('treats a product with no inventory row as out of stock', async () => {
      const item = cartItem({ quantity: 1 });
      item.product.inventory = null as any;
      prisma.cart.findUnique.mockResolvedValue(cartWith([item]));

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).rejects.toThrow(/Insufficient stock/);
    });

    it('creates no order when any single line fails the stock check', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([
          cartItem({ productId: 'a', quantity: 1, stock: 100 }),
          cartItem({ productId: 'b', quantity: 99, stock: 1 }),
        ]),
      );

      await expect(
        service.createFromCart('user-1', SHIPPING as any),
      ).rejects.toThrow();

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('reserves stock rather than decrementing it, so unpaid orders can be released', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ productId: 'prod-9', quantity: 3, stock: 50 })]),
      );

      await service.createFromCart('user-1', SHIPPING as any);

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { productId: 'prod-9' },
        data: { reserved: { increment: 3 } },
      });
    });

    it('empties the cart once the order exists', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ quantity: 1 })]),
      );

      await service.createFromCart('user-1', SHIPPING as any);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });

    it('runs the whole cart-to-order conversion in a single transaction', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ quantity: 1 })]),
      );

      await service.createFromCart('user-1', SHIPPING as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('createFromCart — coupons', () => {
    it('applies a percentage discount to the subtotal', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: 100, quantity: 2 })]),
      );
      prisma.coupon.findUnique.mockResolvedValue(validCoupon({ value: 10 }));

      await service.createFromCart('user-1', {
        ...SHIPPING,
        couponCode: 'WELCOME10',
      } as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.subtotal).toBe(200);
      expect(data.discountAmount).toBe(20);
      expect(data.totalAmount).toBe(180);
    });

    it('applies a fixed discount', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: 100, quantity: 1 })]),
      );
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ type: CouponType.FIXED_AMOUNT, value: 15 }),
      );

      await service.createFromCart('user-1', {
        ...SHIPPING,
        couponCode: 'FLAT15',
      } as any);

      expect(prisma.order.create.mock.calls[0][0].data.totalAmount).toBe(85);
    });

    it('honours maxDiscountAmount', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: 1000, quantity: 1 })]),
      );
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ value: 50, maxDiscountAmount: 100 }),
      );

      await service.createFromCart('user-1', {
        ...SHIPPING,
        couponCode: 'HALF',
      } as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.discountAmount).toBe(100);
      expect(data.totalAmount).toBe(900);
    });

    it('rejects an unknown coupon code', async () => {
      prisma.cart.findUnique.mockResolvedValue(cartWith([cartItem()]));
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(
        service.createFromCart('user-1', {
          ...SHIPPING,
          couponCode: 'FAKE',
        } as any),
      ).rejects.toThrow('Invalid coupon');
    });

    it('rejects an expired coupon', async () => {
      prisma.cart.findUnique.mockResolvedValue(cartWith([cartItem()]));
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ validUntil: new Date('2020-01-01') }),
      );

      await expect(
        service.createFromCart('user-1', {
          ...SHIPPING,
          couponCode: 'OLD',
        } as any),
      ).rejects.toThrow('Coupon expired');
    });

    it('rejects a coupon that has hit its usage limit', async () => {
      prisma.cart.findUnique.mockResolvedValue(cartWith([cartItem()]));
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ usageLimit: 1, usedCount: 1 }),
      );

      await expect(
        service.createFromCart('user-1', {
          ...SHIPPING,
          couponCode: 'USEDUP',
        } as any),
      ).rejects.toThrow('Coupon usage limit reached');
    });

    it('rejects a coupon when the order is below its minimum', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: 20, quantity: 1 })]),
      );
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ minOrderAmount: 50 }),
      );

      await expect(
        service.createFromCart('user-1', {
          ...SHIPPING,
          couponCode: 'WELCOME10',
        } as any),
      ).rejects.toThrow(/minimum amount/);
    });

    it('increments usedCount so limits are actually enforced over time', async () => {
      prisma.cart.findUnique.mockResolvedValue(
        cartWith([cartItem({ price: 100, quantity: 1 })]),
      );
      prisma.coupon.findUnique.mockResolvedValue(validCoupon());

      await service.createFromCart('user-1', {
        ...SHIPPING,
        couponCode: 'WELCOME10',
      } as any);

      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('does not consume a coupon use when the order fails validation', async () => {
      prisma.cart.findUnique.mockResolvedValue(cartWith([cartItem()]));
      prisma.coupon.findUnique.mockResolvedValue(
        validCoupon({ isActive: false }),
      );

      await expect(
        service.createFromCart('user-1', {
          ...SHIPPING,
          couponCode: 'DEAD',
        } as any),
      ).rejects.toThrow();

      expect(prisma.coupon.update).not.toHaveBeenCalled();
    });

    it('skips coupon handling entirely when no code is given', async () => {
      prisma.cart.findUnique.mockResolvedValue(cartWith([cartItem()]));

      await service.createFromCart('user-1', SHIPPING as any);

      expect(prisma.coupon.findUnique).not.toHaveBeenCalled();
      expect(prisma.order.create.mock.calls[0][0].data.couponId).toBeUndefined();
    });
  });

  describe('findOne — access control', () => {
    const order = {
      id: 'order-1',
      userId: 'owner',
      items: [],
    };

    it('throws NotFound for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('ghost', 'owner', Role.CUSTOMER),
      ).rejects.toThrow(NotFoundException);
    });

    it('lets a customer see their own order', async () => {
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        service.findOne('order-1', 'owner', Role.CUSTOMER),
      ).resolves.toBe(order);
    });

    it("blocks a customer from reading someone else's order", async () => {
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        service.findOne('order-1', 'intruder', Role.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets staff read any order, for support purposes', async () => {
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        service.findOne('order-1', 'staff-user', Role.STAFF),
      ).resolves.toBe(order);
    });

    it('lets an admin read any order', async () => {
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        service.findOne('order-1', 'admin-user', Role.ADMIN),
      ).resolves.toBe(order);
    });
  });

  describe('updateStatus', () => {
    it('releases reserved stock when an order is cancelled', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
        items: [{ productId: 'prod-1', quantity: 2 }],
      });
      prisma.order.update.mockResolvedValue({});
      prisma.inventory.update.mockResolvedValue({});

      await service.updateStatus('order-1', OrderStatus.CANCELLED);

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { productId: 'prod-1' },
        data: { reserved: { decrement: 2 } },
      });
    });

    it('does not release stock twice for an already-cancelled order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
        items: [{ productId: 'prod-1', quantity: 2 }],
      });
      prisma.order.update.mockResolvedValue({});

      await service.updateStatus('order-1', OrderStatus.CANCELLED);

      expect(prisma.inventory.update).not.toHaveBeenCalled();
    });

    it('leaves reservations alone for ordinary status moves', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PAID,
        items: [{ productId: 'prod-1', quantity: 2 }],
      });
      prisma.order.update.mockResolvedValue({});

      await service.updateStatus('order-1', OrderStatus.SHIPPED);

      expect(prisma.inventory.update).not.toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.SHIPPED },
      });
    });

    it('throws NotFound for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('ghost', OrderStatus.SHIPPED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllForAdmin', () => {
    it('computes page count from the total', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(45);

      const result = await service.findAllForAdmin(undefined, 1, 20);

      expect(result.totalPages).toBe(3);
    });

    it('translates page/limit into skip/take', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.findAllForAdmin(undefined, 3, 10);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('filters by status when one is given', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.findAllForAdmin(OrderStatus.PENDING);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: OrderStatus.PENDING } }),
      );
    });
  });
});
