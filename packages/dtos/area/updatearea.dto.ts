import { IsOptional, IsString, IsMongoId } from "class-validator";

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
}
