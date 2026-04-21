import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMaterialRateDto {
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

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  unit?: string; // e.g., "50 Kg", "Per Cubic Foot", "Per Sq Ft"

  @IsEnum(['Door', 'Wood', 'Sand', 'Tile', 'Bajri', 'Steel', 'Bricks'])
  materialType: string;

  @IsOptional()
  @IsString()
  category?: string; // e.g., "Teak Wood", "Solid Door", "Fine Sand"

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
