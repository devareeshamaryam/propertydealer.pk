import { Controller, Post, Get, Put, Delete, Body, Param, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreateBlogDto } from '@rent-ghar/dtos/blog/createblog.dto';
import { UpdateBlogDto } from '@rent-ghar/dtos/blog/updateblog.dto';
import { BlogDocument } from '@rent-ghar/db/schemas/blog.schema';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';

@Controller('blog')
export class BlogController {
    constructor(private readonly blogService: BlogService){}
    // get published blogs for the users 
    @Get('published')
    async getPublishedBlogs(): Promise<BlogDocument[]> {
        return this.blogService.findPublishedBlogs();
    }
    // Create a new blog
    @Post()
    @UseGuards(JwtAuthGuard, AdminGuard)
    @HttpCode(HttpStatus.CREATED)
    async createBlog(@Body() createBlogDto: CreateBlogDto): Promise<BlogDocument> {
        try {
            console.log('📝 Creating blog with DTO:', createBlogDto);
            const result = await this.blogService.createBlog(createBlogDto);
            console.log('✅ Blog created successfully:', result._id);
            return result;
        } catch (error: any) {
            console.error('❌ Error creating blog:', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    }

    // Get all blogs (optionally filtered by status)
    @Get()
    async getAllBlogs(@Query('status') status?: string): Promise<BlogDocument[]> {
        return this.blogService.findAllBlogs(status);
    }

    // Get blog by slug (must come before :id route)
    @Get('slug/:slug')
    async getBlogBySlug(@Param('slug') slug: string): Promise<BlogDocument> {

        return this.blogService.findBlogBySlug(slug);

    }

    // Get blog by ID
    @Get(':id')
    async getBlogById(@Param('id') id: string): Promise<BlogDocument> {
        return this.blogService.findBlogById(id);
    }

    // Update blog
    @Put(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async updateBlog(
        @Param('id') id: string,
        @Body() updateBlogDto: UpdateBlogDto
    ): Promise<BlogDocument> {
        return this.blogService.updateBlog(id, updateBlogDto);
    }

    // Delete blog
    @Delete(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteBlog(@Param('id') id: string): Promise<void> {
        return this.blogService.deleteBlog(id);
    }

    // Increment views (for analytics)
    @Post(':id/views')
    @HttpCode(HttpStatus.NO_CONTENT)
    async incrementViews(@Param('id') id: string): Promise<void> {
        return this.blogService.incrementViews(id);
    }
}
