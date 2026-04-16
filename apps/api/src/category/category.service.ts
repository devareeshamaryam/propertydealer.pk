import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Category, CategoryDocument } from '@rent-ghar/db/schemas/category.schema';
import { CreateCategoryDto } from '@rent-ghar/dtos/blog-category/create-category.dto';
import { UpdateCategoryDto } from '@rent-ghar/dtos/blog-category/update-category.dto';
import slug from 'slug';

@Injectable()
export class CategoryService {
    constructor(@InjectModel(Category.name) private categoryModel: Model<CategoryDocument>) {}
    
    async createCategory(createCategoryDto: CreateCategoryDto): Promise<CategoryDocument> {
        // Generate slug from name if not provided (slug is required in schema)
        if (!createCategoryDto.slug) {
            if (!createCategoryDto.name) {
                throw new BadRequestException('Category name is required to generate slug');
            }
            createCategoryDto.slug = slug(createCategoryDto.name, { lower: true });
        }
        
        // Map parentId to parent if provided
        const categoryData: any = {
            name: createCategoryDto.name,
            slug: createCategoryDto.slug,
            description: createCategoryDto.description,
        };

        if (createCategoryDto.metaTitle) categoryData.metaTitle = createCategoryDto.metaTitle;
        if (createCategoryDto.metaDescription) categoryData.metaDescription = createCategoryDto.metaDescription;
        if (createCategoryDto.canonicalUrl) categoryData.canonicalUrl = createCategoryDto.canonicalUrl;
        
        if (createCategoryDto.parentId) {
            if (!isValidObjectId(createCategoryDto.parentId)) {
                throw new BadRequestException('Invalid parent category ID');
            }
            // Verify parent category exists
            const parentCategory = await this.categoryModel.findById(createCategoryDto.parentId).exec();
            if (!parentCategory) {
                throw new NotFoundException('Parent category not found');
            }
            categoryData.parent = createCategoryDto.parentId;
        }
        
        const category = await this.categoryModel.create(categoryData);
        return category;
    }

    async findAllCategories(): Promise<CategoryDocument[]> {
        return await this.categoryModel.find().populate('parent', 'name slug').sort({ createdAt: -1 }).exec();
    }

    async findCategoryById(id: string): Promise<CategoryDocument> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid category ID');
        }
        const category = await this.categoryModel.findById(id).populate('parent', 'name slug').exec();
        if (!category) {
            throw new NotFoundException('Category not found');
        }
        return category;
    }

    async findCategoryBySlug(slug: string): Promise<CategoryDocument> {
        const category = await this.categoryModel.findOne({ slug }).populate('parent', 'name slug').exec();
        if (!category) {
            throw new NotFoundException('Category not found');
        }
        return category;
    }

    async updateCategory(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryDocument> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid category ID');
        }

        // Generate slug from name if name is being updated and slug is not provided
        if (updateCategoryDto.name && !updateCategoryDto.slug) {
            updateCategoryDto.slug = slug(updateCategoryDto.name, { lower: true });
        }

        // Map parentId to parent if provided
        const updateData: any = { ...updateCategoryDto };
        if (updateCategoryDto.parentId !== undefined) {
            if (updateCategoryDto.parentId === null) {
                updateData.parent = null;
            } else {
            if (!isValidObjectId(updateCategoryDto.parentId)) {
                throw new BadRequestException('Invalid parent category ID');
            }
                // Prevent self-reference
                if (updateCategoryDto.parentId === id) {
                    throw new BadRequestException('Category cannot be its own parent');
                }
                // Verify parent category exists
                const parentCategory = await this.categoryModel.findById(updateCategoryDto.parentId).exec();
                if (!parentCategory) {
                    throw new NotFoundException('Parent category not found');
                }
                updateData.parent = updateCategoryDto.parentId;
            }
            delete updateData.parentId;
        }

        const category = await this.categoryModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('parent', 'name slug').exec();

        if (!category) {
            throw new NotFoundException('Category not found');
        }
        return category;
    }
    
    async deleteCategory(id: string): Promise<void> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid category ID');
        }
        const category = await this.categoryModel.findByIdAndDelete(id).exec();
        if (!category) {
            throw new NotFoundException('Category not found');
        }
    }
}
