import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePropertyDto {
  @IsEnum(['rent', 'sale'])
  listingType: 'rent' | 'sale';

  @IsEnum([
    'house',
    'apartment',
    'flat',
    'commercial',
    'land',
    'shop',
    'office',
    'factory',
    'other',
    'hotel',
    'restaurant',
    'plot',
  ])
  propertyType:
    | 'house'
    | 'apartment'
    | 'flat'
    | 'commercial'
    | 'land'
    | 'shop'
    | 'office'
    | 'factory'
    | 'other'
    | 'hotel'
    | 'restaurant'
    | 'plot';

  @IsOptional()
  @IsString()
  slug?: string;

  @IsMongoId()
  area: string;

  @IsString()
  title: string;

  @IsString()
  location: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bedrooms: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bathrooms: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSize: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marla?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kanal?: number;

  @IsString()
  description: string;

  @IsString()
  contactNumber: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingPhotos?: string[];
}
