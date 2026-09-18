import { IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  shippingLine1: string;

  @IsOptional()
  @IsString()
  shippingLine2?: string;

  @IsString()
  shippingCity: string;

  @IsOptional()
  @IsString()
  shippingState?: string;

  @IsString()
  shippingPostal: string;

  @IsString()
  shippingCountry: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
