import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
