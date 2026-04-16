import { Controller, Post, Body, Get, Param, Delete, Put, NotFoundException, BadRequestException } from '@nestjs/common';
import { PageService } from './page.service';
import { CreatePageDto } from '@rent-ghar/dtos/page/createpage.dto';
import { UpdatePageDto } from '@rent-ghar/dtos/page/updatepage.dto';

@Controller('page')
export class PageController {
    constructor(private readonly pageService: PageService) {}
    
    @Post()
    async createPage(@Body() createPageDto: CreatePageDto){
        try {
            return await this.pageService.create(createPageDto);
        } catch (error: any) {
            if (error.code === 11000) {
                // Duplicate key error (likely duplicate slug)
                throw new BadRequestException('A page with this slug already exists. Please use a different title.');
            }
            throw error;
        }
    }

    @Get()
    getAllPages(){
        return this.pageService.getAll();
    }

    @Get('published')
    getPublishedPages(){
        return this.pageService.getPublished();
    }

    @Get(':id')
    async getPageById(@Param('id') id: string){
        const page = await this.pageService.getById(id);
        if (!page) {
            throw new NotFoundException(`Page with ID ${id} not found`);
        }
        return page;
    }

    @Get('slug/:slug')
    async getPageBySlug(@Param('slug') slug: string){
        const page = await this.pageService.getBySlug(slug);
        if (!page) {
            throw new NotFoundException(`Page with slug ${slug} not found`);
        }
        return page;
    }

    @Put(':id')
    updatePage(@Param('id') id: string, @Body() updatePageDto: UpdatePageDto){
        return this.pageService.update(id, updatePageDto);
    }

    @Delete(':id')
    deletePage(@Param('id') id: string){
        return this.pageService.delete(id);
    }
}
