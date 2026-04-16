import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, MaxLength } from 'class-validator';

export class CreatePageDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    slug?: string; // Auto-generated from title if not provided

    @IsString()
    @IsOptional()
    excerpt?: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsEnum(['DRAFT', 'PUBLISHED'], { message: 'Status must be either DRAFT or PUBLISHED' })
    @IsOptional()
    status?: 'DRAFT' | 'PUBLISHED';

    // SEO fields
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

    @IsString()
    @IsOptional()
    featuredImage?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    keywords?: string[];
}