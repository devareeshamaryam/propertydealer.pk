import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCityDto {
    @IsNotEmpty({ message: 'City name is required' })
    @IsString({ message: 'City name must be a string' })
    name: string;

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
}