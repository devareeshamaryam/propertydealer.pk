import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsMongoId, MaxLength } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  slug?: string; // Auto-generated from title if not provided

  @IsString()
  @IsNotEmpty()
  content: string;

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

  @IsMongoId()
  @IsOptional()
  categoryId?: string; // For backward compatibility - single category

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  categories?: string[]; // Array of category IDs

  @IsMongoId()
  @IsOptional()
  author?: string; // User ID - typically from auth context
}