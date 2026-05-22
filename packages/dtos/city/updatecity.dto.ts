 import { IsOptional, IsString, IsArray, ValidateNested, IsEnum } from "class-validator";
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

export class UpdateCityDto {
    @IsOptional()
    @IsString({ message: 'City name must be a string' })
    name?: string;

    @IsOptional()
    @IsString({ message: 'State must be a string' })
    state?: string;

    @IsOptional()
    @IsString({ message: 'Country must be a string' })
    country?: string;

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
    rentMetaTitle?: string;

    @IsOptional()
    @IsString()
    rentMetaDescription?: string;

    @IsOptional()
    @IsString()
    saleMetaTitle?: string;

    @IsOptional()
    @IsString()
    saleMetaDescription?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    rentContent?: string;

    @IsOptional()
    @IsString()
    saleContent?: string;

    @IsOptional()
    @IsString()
    buyContent?: string;

    @IsOptional()
    @IsString()
    thumbnail?: string;

    @IsOptional()
    typeContents?: {
        propertyType: string;
        purpose: 'rent' | 'sale' | 'all';
        metaTitle?: string;
        metaDescription?: string;
        content?: string;
    }[];

    // 🆕 Size-specific SEO content
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SizeContentDto)
    sizeContents?: SizeContentDto[];
}