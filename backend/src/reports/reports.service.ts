import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PAID_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async salesSummary(startDate?: string, endDate?: string) {
    const where = {
      status: { in: PAID_STATUSES },
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [aggregate, orderCount] = await Promise.all([
      this.prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.order.count({ where }),
    ]);

    const totalRevenue = Number(aggregate._sum.totalAmount || 0);
    return {
      totalRevenue,
      totalOrders: orderCount,
      averageOrderValue: orderCount ? totalRevenue / orderCount : 0,
    };
  }

  revenueByDay(days = 30) {
    return this.prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt") as date,
             SUM("totalAmount")::float as revenue,
             COUNT(*)::int as orders
      FROM orders
      WHERE status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
        AND "createdAt" >= NOW() - (${days} || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  async topProducts(limit = 10) {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = grouped.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    return grouped.map((g) => ({
      product: products.find((p) => p.id === g.productId),
      totalSold: g._sum.quantity,
    }));
  }

  lowStock() {
    return this.prisma.$queryRaw`
      SELECT i.*, p.name, p.slug FROM inventory i
      JOIN products p ON p.id = i."productId"
      WHERE i.quantity <= i."reorderLevel"
      ORDER BY i.quantity ASC
    `;
  }
}
