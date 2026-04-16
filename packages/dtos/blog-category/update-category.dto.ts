import { IsOptional, IsString, IsMongoId } from "class-validator";

export class UpdateCategoryDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    slug?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    metaTitle?: string;

    @IsString()
    @IsOptional()
    metaDescription?: string;

    @IsString()
    @IsOptional()
    canonicalUrl?: string;

    @IsMongoId()
    @IsOptional()
    parentId?: string;
}

