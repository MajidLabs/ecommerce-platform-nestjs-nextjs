import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class AdjustStockDto {
  @IsInt()
  quantityChange: number;

  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsOptional()
  @IsString()
  reason?: string;
}
