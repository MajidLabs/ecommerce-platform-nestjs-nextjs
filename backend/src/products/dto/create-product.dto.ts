import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialStock?: number;
}
