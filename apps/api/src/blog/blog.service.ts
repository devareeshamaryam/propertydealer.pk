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
        // The API's own cached reads first, then the site's pages.
        await this.cache.invalidateTags([TAG_BLOGS]).catch(() => undefined);
        await this.revalidate.revalidate({ tags, paths });
    }

    /**
     * The published blogs, without their bodies.
     *
     * This used to return every post in full. The payload reached 6.1 MB,
     * which is over Next.js's 2MB data-cache ceiling — so the home page's
     * fetch of it was never cached and re-downloaded all six megabytes on
     * every regeneration, and Redis held a 6MB value for a list nobody reads
     * the bodies from. The two callers (the home page's blog strip and the
     * related-posts row under an article) need titles, slugs, images and
     * dates.
     *
     * `readMinutes` is computed in the pipeline rather than dropped: it is
     * the one thing a card shows that is derived from the body, and
     * $strLenCP measures the content without ever sending it. Roughly 1,100
     * characters a minute, which is about 200 words.
     *
     * The full article still comes from findBySlug, untouched.
     */
    async findPublishedBlogs(): Promise<BlogDocument[]> {
        // ⚡ Cache: blog list is hit on every home-page render.
        return this.cache.wrap(
            this.cache.buildKey('blogs:published', []),
            async () => {
                try {
                    const rows = await this.blogModel
                        .aggregate([
                            { $match: { status: 'published' } },
                            {
                                $set: {
                                    readMinutes: {
                                        $max: [
                                            1,
                                            {
                                                $ceil: {
                                                    $divide: [
                                                        { $strLenCP: { $ifNull: ['$content', ''] } },
                                                        1100,
                                                    ],
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                            { $unset: 'content' },
                            { $sort: { createdAt: -1 } },
                        ])
                        .exec();

                    // populate() works on plain objects too, so the author and
                    // category shapes stay exactly as the callers expect.
                    await this.blogModel.populate(rows, [
                        { path: 'author', select: 'name email' },
                        { path: 'categories', select: 'name slug' },
                    ]);

                    return rows as unknown as BlogDocument[];
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

    /**
     * A published post, read-only and cached. It used to add a view and save
     * the whole document on every read — a database write per page view,
     * uncacheable — and sent the author's email to every visitor. Views are
     * counted by POST /blog/:id/views from the browser.
     */
    async findBlogBySlug(slug: string): Promise<BlogDocument> {
        const blog = await this.cache.wrap(
            this.cache.buildKey('blogs:slug', [slug]),
            () =>
                this.blogModel
                    .findOne({ slug: slug, status: 'published' })
                    .populate('author', 'name')
                    .populate('categories', 'name slug')
                    .lean()
                    .exec(),
            { ttl: 600, tags: [TAG_BLOGS] },
        );

        if (!blog) {
            throw new NotFoundException(`Blog not found with slug: ${slug}`);
        }
        return blog as unknown as BlogDocument;
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