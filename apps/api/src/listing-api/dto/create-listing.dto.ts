import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsUrl,
} from 'class-validator';

/**
 * CreateListingDto
 * ----------------
 * Payload for the public listing API used by automation tools (e.g. n8n).
 *
 * Notes:
 *  - Designed to be consumed as JSON (`application/json`), not multipart.
 *    Photos are referenced by URL — callers should first upload images via
 *    `POST /listing-api/uploads` (or provide already-hosted URLs) and then
 *    include those URLs here.
 *  - Either `area` (an Area ObjectId) or both (`cityName` + `areaName`) must
 *    be provided. The service will auto-resolve / create the area when names
 *    are given so that n8n flows don't have to manage IDs.
 */
export class CreateListingDto {
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
  propertyType: string;

  // Either provide area ObjectId directly...
  @IsOptional()
  @IsMongoId()
  area?: string;

  // ...or provide names for resolution / auto-creation
  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsString()
  areaName?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

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

  // Already-hosted image URLs. The first becomes mainPhotoUrl unless
  // mainPhotoUrl is explicitly provided.
  @IsOptional()
  @IsString()
  mainPhotoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalPhotosUrls?: string[];
}
