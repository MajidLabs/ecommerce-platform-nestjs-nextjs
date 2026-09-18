import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CouponType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.findOne(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async validate(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid coupon');
    }
    if (coupon.validUntil && coupon.validUntil < new Date()) {
      throw new BadRequestException('Coupon expired');
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount is ${coupon.minOrderAmount}`,
      );
    }

    let discountAmount =
      coupon.type === CouponType.PERCENTAGE
        ? subtotal * (Number(coupon.value) / 100)
        : Number(coupon.value);
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount));
    }

    return { valid: true, discountAmount, code: coupon.code };
  }
}
