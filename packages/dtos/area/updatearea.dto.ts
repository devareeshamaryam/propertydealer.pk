 import { IsOptional, IsString, IsMongoId, IsArray, ValidateNested, IsEnum } from "class-validator";
import { Type } from "class-transformer";

export class SizeContentDto {
  @IsEnum(['2marla', '3marla', '5marla', '10marla', '1kanal'])
  size: '2marla' | '3marla' | '5marla' | '10marla' | '1kanal';

  @IsEnum(['rent', 'sale', 'all'])
  purpose: 'rent' | 'sale' | 'all';

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  areaSlug?: string;

  @IsOptional()
  @IsMongoId()
  city?: string; // City ID

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rentMetaTitle?: string;

  @IsOptional()
  @IsString()
  rentMetaDescription?: string;

  @IsOptional()
  @IsString()
  rentContent?: string;

  @IsOptional()
  @IsString()
  saleMetaTitle?: string;

  @IsOptional()
  @IsString()
  saleMetaDescription?: string;

  @IsOptional()
  @IsString()
  saleContent?: string;

  // 🆕 Size-specific SEO content
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeContentDto)
  sizeContents?: SizeContentDto[];
}