import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(InventoryService);
  });

  describe('adjustStock', () => {
    it('adds stock on a restock', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 4,
      });
      prisma.inventory.update.mockResolvedValue({ quantity: 24 });
      prisma.stockMovement.create.mockResolvedValue({});

      await service.adjustStock('prod-1', {
        quantityChange: 20,
        type: StockMovementType.RESTOCK,
        reason: 'Supplier delivery',
      } as any);

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { productId: 'prod-1' },
        data: { quantity: 24 },
      });
    });

    it('subtracts stock on a negative adjustment', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 10,
      });
      prisma.inventory.update.mockResolvedValue({ quantity: 7 });
      prisma.stockMovement.create.mockResolvedValue({});

      await service.adjustStock('prod-1', {
        quantityChange: -3,
        type: StockMovementType.ADJUSTMENT,
        reason: 'Damaged in transit',
      } as any);

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { productId: 'prod-1' },
        data: { quantity: 7 },
      });
    });

    it('refuses an adjustment that would push stock below zero', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 2,
      });

      await expect(
        service.adjustStock('prod-1', {
          quantityChange: -5,
          type: StockMovementType.ADJUSTMENT,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not touch the database when the adjustment is rejected', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 2,
      });

      await expect(
        service.adjustStock('prod-1', {
          quantityChange: -5,
          type: StockMovementType.ADJUSTMENT,
        } as any),
      ).rejects.toThrow();

      expect(prisma.inventory.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('allows an adjustment that lands exactly on zero', async () => {
      // Boundary: zero stock is a legitimate state (sold out), only
      // negative is not.
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 5,
      });
      prisma.inventory.update.mockResolvedValue({ quantity: 0 });
      prisma.stockMovement.create.mockResolvedValue({});

      await service.adjustStock('prod-1', {
        quantityChange: -5,
        type: StockMovementType.SALE,
      } as any);

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { productId: 'prod-1' },
        data: { quantity: 0 },
      });
    });

    it('writes an audit row for every adjustment', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 10,
      });
      prisma.inventory.update.mockResolvedValue({});
      prisma.stockMovement.create.mockResolvedValue({});

      await service.adjustStock('prod-1', {
        quantityChange: -2,
        type: StockMovementType.SALE,
        reason: 'Order #123',
      } as any);

      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: {
          inventoryId: 'inv-1',
          type: StockMovementType.SALE,
          quantity: -2,
          reason: 'Order #123',
        },
      });
    });

    it('records the delta, not the resulting total, so history stays reconstructable', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 100,
      });
      prisma.inventory.update.mockResolvedValue({});
      prisma.stockMovement.create.mockResolvedValue({});

      await service.adjustStock('prod-1', {
        quantityChange: 5,
        type: StockMovementType.RETURN,
      } as any);

      const movement = prisma.stockMovement.create.mock.calls[0][0].data;
      expect(movement.quantity).toBe(5);
      expect(movement.quantity).not.toBe(105);
    });

    it('updates the count and writes the audit row inside one transaction', async () => {
      // If the stock update committed but the movement row didn't, the
      // audit log would silently drift from reality.
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 10,
      });
      prisma.inventory.update.mockResolvedValue({});
      prisma.stockMovement.create.mockResolvedValue({});

      await service.adjustStock('prod-1', {
        quantityChange: 1,
        type: StockMovementType.RESTOCK,
      } as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws NotFound for a product with no inventory record', async () => {
      prisma.inventory.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustStock('ghost-product', {
          quantityChange: 1,
          type: StockMovementType.RESTOCK,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProduct', () => {
    it('throws NotFound when there is no inventory record', async () => {
      prisma.inventory.findUnique.mockResolvedValue(null);

      await expect(service.findByProduct('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the most recent movements alongside the record', async () => {
      prisma.inventory.findUnique.mockResolvedValue({
        id: 'inv-1',
        movements: [],
      });

      await service.findByProduct('prod-1');

      const args = prisma.inventory.findUnique.mock.calls[0][0];
      expect(args.include.movements.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('findAll', () => {
    it('lists the lowest stock first, so problems surface at the top', async () => {
      prisma.inventory.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { quantity: 'asc' } }),
      );
    });
  });
});
