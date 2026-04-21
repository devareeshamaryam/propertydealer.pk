import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBajriRateDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  change?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
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
