import { IsString, IsOptional, IsArray, IsEnum, IsMongoId, MaxLength } from 'class-validator';

export class UpdateBlogDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  featuredImage?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsEnum(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160, { message: 'Meta description must be at most 160 characters' })
  metaDescription?: string;

  @IsString()
  @IsOptional()
  canonicalUrl?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  categories?: string[];
}

