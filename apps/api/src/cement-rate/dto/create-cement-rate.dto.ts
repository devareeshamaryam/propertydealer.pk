import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCementRateDto {
  @IsString()
  brand: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  change?: number;


  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  weightKg?: number;

  @IsOptional()
  @IsEnum(['OPC Cement', 'SRC Cement', 'White Cement', 'Sulphate Resistant'])
  category?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  images?: string[];
}
