import { IsOptional, IsNotEmpty, IsString, IsMongoId } from "class-validator";

export class CreateAreaDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  areaSlug?: string;

  @IsNotEmpty()
  @IsMongoId()
  city: string; // City ID

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
}
