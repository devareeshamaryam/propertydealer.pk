 import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Blog, BlogDocument } from '@rent-ghar/db/schemas/blog.schema';
import { Model, isValidObjectId } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Category } from '@rent-ghar/db/schemas/category.schema';
import { CreateBlogDto } from '@rent-ghar/dtos/blog/createblog.dto';
import { UpdateBlogDto } from '@rent-ghar/dtos/blog/updateblog.dto';
import { IndexNowService } from '../indexnow/indexnow.service';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

const TAG_BLOGS = 'blogs';

@Injectable()
export class BlogService {
    constructor(
        @InjectModel(Blog.name) private blogModel: Model<BlogDocument>,
        @InjectModel(Category.name) private categoryModel: Model<any>,
        private indexNowService: IndexNowService,
        private configService: ConfigService,
        private readonly cache: RedisCacheService,
        private readonly revalidate: RevalidateService,
    ){}

    private async bustBlogCaches(slug?: string) {
        const tags = [TAG_BLOGS];
        const paths = ['/blog', '/'];
        if (slug) {
            tags.push(`blog:slug:${slug}`);
            paths.push(`/blog/${slug}`);
        }
        await this.revalidate.revalidate({ tags, paths });
    }

    async findPublishedBlogs(): Promise<BlogDocument[]> {
        // ⚡ Cache: blog list is hit on every home-page render.
        return this.cache.wrap(
            this.cache.buildKey('blogs:published', []),
            async () => {
                try {
                    return await this.blogModel
                        .find({ status: 'published' })
                        .populate('author', 'name email')
                        .populate('categories', 'name slug')
                        .exec();
                } catch (error) {
                    console.error('Error fetching published blogs:', error);
                    return [];
                }
            },
            { ttl: 60, tags: [TAG_BLOGS] },
        );
    }

    async findActiveBlogs(): Promise<BlogDocument[]> {
        return await this.blogModel
            .find({ status: 'active' })
            .populate('author', 'name email')
            .populate('categories', 'name slug')
            .exec();
    }

    async createBlog(createBlogDto: CreateBlogDto): Promise<BlogDocument> {
        try {
            console.log('🔍 Starting blog creation with DTO:', JSON.stringify(createBlogDto, null, 2));
            
            const blogData: any = {
                title: createBlogDto.title,
                content: createBlogDto.content,
                excerpt: createBlogDto.excerpt,
                tags: createBlogDto.tags || [],
                featuredImage: createBlogDto.featuredImage,
                status: createBlogDto.status || 'draft',
                metaTitle: createBlogDto.metaTitle,
                metaDescription: createBlogDto.metaDescription,
                canonicalUrl: createBlogDto.canonicalUrl,
            };

            if (createBlogDto.slug) {
                blogData.slug = createBlogDto.slug.toLowerCase().trim();
                console.log('📋 Using provided slug:', blogData.slug);
            } else {
                console.log('📋 Slug will be auto-generated from title');
            }

            if (createBlogDto.author) {
                if (!isValidObjectId(createBlogDto.author)) {
                    throw new BadRequestException('Invalid author ID');
                }
                blogData.author = createBlogDto.author;
            }

            if (createBlogDto.categories && createBlogDto.categories.length > 0) {
                console.log('🏷️  Validating categories:', createBlogDto.categories);
                for (const categoryId of createBlogDto.categories) {
                    if (!isValidObjectId(categoryId)) {
                        throw new BadRequestException(`Invalid category ID: ${categoryId}`);
                    }
                    const category = await this.categoryModel.findById(categoryId).exec();
                    if (!category) {
                        throw new NotFoundException(`Category not found: ${categoryId}`);
                    }
                }
                blogData.categories = createBlogDto.categories;
            } else if (createBlogDto.categoryId) {
                console.log('🏷️  Validating single category:', createBlogDto.categoryId);
                if (!isValidObjectId(createBlogDto.categoryId)) {
                    throw new BadRequestException('Invalid category ID');
                }
                const category = await this.categoryModel.findById(createBlogDto.categoryId).exec();
                if (!category) {
                    throw new NotFoundException('Category not found');
                }
                blogData.categories = [createBlogDto.categoryId];
            }

            console.log('💾 Creating blog in database with data:', JSON.stringify(blogData, null, 2));
            const blog = await this.blogModel.create(blogData);
            console.log('✅ Blog created successfully with ID:', blog._id);

            if (blog.status === 'published' && blog.slug) {
                const host = this.configService.get<string>('APP_HOST') || 'propertydealer.pk';
                const url = `https://${host}/blog/${blog.slug}`;
                this.indexNowService.submitUrl(url).catch(err => {
                    console.error('Failed to submit URL to IndexNow:', err);
                });
            }

            this.bustBlogCaches(blog.slug).catch(() => {});
            return blog;
        } catch (error: any) {
            console.error('❌ Error in createBlog service:', error.message);
            console.error('Error stack:', error.stack);
            if (error.name === 'ValidationError') {
                console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
            }
            throw error;
        }
    }

    async findAllBlogs(status?: string): Promise<BlogDocument[]> {
        const query: any = {};
        if (status) {
            query.status = status;
        }
        return await this.blogModel
            .find(query)
            .select('-content')  // ✅ content field skip — response size kam karo
            .populate('author', 'name email')
            .populate('categories', 'name slug')
            .sort({ createdAt: -1 })
            .exec();
    }

    async findBlogById(id: string): Promise<BlogDocument> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid blog ID');
        }
        const blog = await this.blogModel
            .findById(id)
            .populate('author', 'name email')
            .populate('categories', 'name slug')
            .exec();
        if (!blog) {
            throw new NotFoundException('Blog not found');
        }
        return blog;
    }

    async findBlogBySlug(slug: string): Promise<BlogDocument> {
        const blog = await this.blogModel
            .findOne({ 
                slug: slug,
                status: 'published'
            })
            .populate('author', 'name email')
            .populate('categories', 'name slug')
            .exec();
            
        if (!blog) {
            throw new NotFoundException(`Blog not found with slug: ${slug}`);
        }
        
        blog.views += 1;
        await blog.save();
        
        return blog;
    }

    async updateBlog(id: string, updateBlogDto: UpdateBlogDto): Promise<BlogDocument> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid blog ID');
        }

        const updateData: any = { ...updateBlogDto };

        if (updateBlogDto.slug) {
            updateData.slug = updateBlogDto.slug.toLowerCase().trim();
        }

        if (updateBlogDto.categories) {
            for (const categoryId of updateBlogDto.categories) {
                if (!isValidObjectId(categoryId)) {
                    throw new BadRequestException(`Invalid category ID: ${categoryId}`);
                }
                const category = await this.categoryModel.findById(categoryId).exec();
                if (!category) {
                    throw new NotFoundException(`Category not found: ${categoryId}`);
                }
            }
        }

        const blog = await this.blogModel
            .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
            .populate('author', 'name email')
            .populate('categories', 'name slug')
            .exec();

        if (!blog) {
            throw new NotFoundException('Blog not found');
        }

        if (blog.status === 'published' && blog.slug) {
            const host = this.configService.get<string>('APP_HOST') || 'propertydealer.pk';
            const url = `https://${host}/blog/${blog.slug}`;
            this.indexNowService.submitUrl(url).catch(err => {
                console.error('Failed to submit URL to IndexNow:', err);
            });
        }

        this.bustBlogCaches(blog.slug).catch(() => {});
        return blog;
    }

    async deleteBlog(id: string): Promise<void> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid blog ID');
        }
        const blog = await this.blogModel.findByIdAndDelete(id).exec();
        if (!blog) {
            throw new NotFoundException('Blog not found');
        }
        this.bustBlogCaches(blog.slug).catch(() => {});
    }

    async incrementViews(id: string): Promise<void> {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid blog ID');
        }
        await this.blogModel.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec();
    }
}