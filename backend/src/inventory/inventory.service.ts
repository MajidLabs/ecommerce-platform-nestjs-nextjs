import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.inventory.findMany({
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: { quantity: 'asc' },
    });
  }

  async findByProduct(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!inventory) throw new NotFoundException('Inventory record not found');
    return inventory;
  }

  async adjustStock(productId: string, dto: AdjustStockDto) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });
    if (!inventory) throw new NotFoundException('Inventory record not found');

    const newQuantity = inventory.quantity + dto.quantityChange;
    if (newQuantity < 0) {
      throw new BadRequestException('Resulting stock cannot be negative');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventory.update({
        where: { productId },
        data: { quantity: newQuantity },
      });
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: dto.type,
          quantity: dto.quantityChange,
          reason: dto.reason,
        },
      });
      return updated;
    });
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
