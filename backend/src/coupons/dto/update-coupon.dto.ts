import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateCouponDto extends PartialType(
  OmitType(CreateCouponDto, ['code'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
