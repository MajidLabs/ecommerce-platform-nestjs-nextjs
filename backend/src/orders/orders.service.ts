import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CouponType, OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createFromCart(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: { include: { product: { include: { inventory: true } } } },
        },
      });
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      for (const item of cart.items) {
        const available =
          (item.product.inventory?.quantity || 0) -
          (item.product.inventory?.reserved || 0);
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${item.product.name}`,
          );
        }
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0,
      );

      let discountAmount = 0;
      let couponId: string | undefined;

      if (dto.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: dto.couponCode },
        });
        if (!coupon || !coupon.isActive) {
          throw new BadRequestException('Invalid coupon');
        }
        if (coupon.validUntil && coupon.validUntil < new Date()) {
          throw new BadRequestException('Coupon expired');
        }
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          throw new BadRequestException('Coupon usage limit reached');
        }
        if (
          coupon.minOrderAmount &&
          subtotal < Number(coupon.minOrderAmount)
        ) {
          throw new BadRequestException(
            'Order does not meet coupon minimum amount',
          );
        }

        discountAmount =
          coupon.type === CouponType.PERCENTAGE
            ? subtotal * (Number(coupon.value) / 100)
            : Number(coupon.value);
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(
            discountAmount,
            Number(coupon.maxDiscountAmount),
          );
        }

        couponId = coupon.id;
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      const totalAmount = subtotal - discountAmount;

      const order = await tx.order.create({
        data: {
          userId,
          subtotal,
          discountAmount,
          totalAmount,
          couponId,
          shippingLine1: dto.shippingLine1,
          shippingCity: dto.shippingCity,
          shippingState: dto.shippingState,
          shippingPostal: dto.shippingPostal,
          shippingCountry: dto.shippingCountry,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of cart.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { reserved: { increment: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } }, payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForAdmin(status?: OrderStatus, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { product: true } },
          payment: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string, role: Role) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payment: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId && role === Role.CUSTOMER) {
      throw new ForbiddenException('Not allowed to view this order');
    }
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: { reserved: { decrement: item.quantity } },
          });
        }
        await tx.order.update({ where: { id }, data: { status } });
      });
      return this.prisma.order.findUnique({ where: { id } });
    }

    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}
