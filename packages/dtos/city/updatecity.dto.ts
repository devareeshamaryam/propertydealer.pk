import { IsOptional, IsString } from "class-validator";

export class UpdateCityDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsString()
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
}