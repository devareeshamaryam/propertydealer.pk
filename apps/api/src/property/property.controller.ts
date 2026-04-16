import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors, Request, Param, Patch, Delete, Put, UploadedFile, UnauthorizedException, BadRequestException, Header } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto'; // Local DTO with validation
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';


@Controller('properties')
export class PropertyController {
  constructor(
    private readonly propertyService: PropertyService,
    // Temporarily commented out to debug DI issue
    private readonly storageService: StorageService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @Request() req,
    @Body() dto: CreatePropertyDto,
  ) {
    // Extract files from request
    const files = req.files as Express.Multer.File[]
    console.log('Received files:', files?.length || 0, 'files');
    const mainPhoto = files?.find(file => file.fieldname === 'mainPhoto')
    const additionalPhotos = files?.filter(file => file.fieldname === 'additionalPhotos') || []

    // Upload files using StorageService OR use existing URLs from body (gallery)
    let mainPhotoUrl: string | undefined;
    if (mainPhoto) {
      console.log('Uploading main photo:', mainPhoto.originalname);
      const key = await this.storageService.upload(mainPhoto, 'properties');
      mainPhotoUrl = this.storageService.getUrl(key);
      console.log('Main photo uploaded:', mainPhotoUrl);
    } else if (req.body.mainPhotoUrl) {
      // If no uploaded main photo but a URL is provided (selected from gallery), use it
      mainPhotoUrl = req.body.mainPhotoUrl;
      console.log('Using existing main photo URL from body:', mainPhotoUrl);
    }
    
    let additionalPhotosUrls: string[] = [];
    if (additionalPhotos.length > 0) {
      console.log('Uploading', additionalPhotos.length, 'additional photos');
      const uploadedUrls = await Promise.all(
        additionalPhotos.map(async (file) => {
          const key = await this.storageService.upload(file, 'properties');
          return this.storageService.getUrl(key);
        })
      );
      additionalPhotosUrls = [...additionalPhotosUrls, ...uploadedUrls];
      console.log('Additional photos uploaded:', uploadedUrls);
    }

    // Merge additional photo URLs coming directly from the body (selected from gallery)
    const bodyAdditional = (req.body.additionalPhotosUrls ??
      req.body['additionalPhotosUrls[]']) as string | string[] | undefined;
    if (bodyAdditional) {
      const bodyUrls = Array.isArray(bodyAdditional) ? bodyAdditional : [bodyAdditional];
      additionalPhotosUrls = [...additionalPhotosUrls, ...bodyUrls];
      console.log('Additional photos URLs from body:', bodyUrls);
    }

    // Extract user from request
    const user = req.user;
    console.log('Property Create - User from request:', user);
    
    if (!user || !user.userId) {
        console.error('User not found in request despite JwtAuthGuard');
        // This should theoretically be caught by the guard, but just in case
        throw new UnauthorizedException('User not authenticated');
    }

    const userId = user.userId;
    
    // Validate User ID format to prevent Mongoose cast errors
    // access Types from mongoose is needed, let's just check regex for now to avoid importing Types if not already
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(userId)) {
         console.error('Invalid user ID format:', userId);
         // If it's the temp ID causing issues, we'll see it here
         throw new BadRequestException(`Invalid user ID format: ${userId}`);
    }

    const userRole = user.role || 'USER';

    const fs = require('fs');
    fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Controller: processing create request for user ${userId}\n`);
    
    try {
      const created = await this.propertyService.create(userId, dto as any, mainPhotoUrl, additionalPhotosUrls, userRole)
      fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Controller: property created successfully\n`);
      return { message: 'Property submitted for approval', property: created }
    } catch (error: any) {
      console.error('Error creating property in service:', error);
      fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Controller Error: ${(error as any)?.message}\nStack: ${(error as any)?.stack}\n`);
      throw error;
    }
  }

  @Get('stats/locations')
  async getStats(
    @Query('city') city: string, 
    @Query('listingType') listingType?: string,
    @Query('propertyType') propertyType?: string
  ) {
    if (!city) {
        throw new BadRequestException('City is required');
    }
    return this.propertyService.getLocationStats(city, listingType, propertyType);
  }

  @Get()
  @Header('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
  async findAll(
    @Query('cityId') cityId?: string, 
    @Query('city') city?: string,
    @Query('areaId') areaId?: string,

    @Query('areaSlug') areaSlug?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('areaMin') areaMin?: string,
    @Query('areaMax') areaMax?: string,
    @Query('marlaMin') marlaMin?: string,
    @Query('marlaMax') marlaMax?: string,
    @Query('beds') beds?: string,
    @Query('baths') baths?: string,
    @Query('type') type?: string,
    @Query('purpose') purpose?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {

    try {
      const filters: any = {};
      if (cityId) filters.cityId = cityId;
      if (areaId) filters.areaId = areaId;
      if (priceMin) filters.priceMin = Number(priceMin);
      if (priceMax) filters.priceMax = Number(priceMax);
      if (areaMin) filters.areaMin = Number(areaMin);
      if (areaMax) filters.areaMax = Number(areaMax);
      if (marlaMin) filters.marlaMin = Number(marlaMin);
      if (marlaMax) filters.marlaMax = Number(marlaMax);
      if (beds) filters.beds = Number(beds);
      if (baths) filters.baths = Number(baths);
      if (type) filters.type = type;
      if (purpose) filters.purpose = purpose;
      if (search) filters.search = search;
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);
      if (city) filters.cityName = city; // Pass derived city name if explicit cityId is not enough



      return await this.propertyService.findAllApproved(filters);
    } catch (error) {
      console.error('Error in findAll controller:', error);
      throw error;
    }
  }

  @Get('types')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=7200')
  async getPropertyTypes() {
    return this.propertyService.getPropertyTypes();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async findAllProperties(@Request() req, @Query('cityId') cityId?: string, @Query('areaId') areaId?: string) {
    const filters: { cityId?: string; areaId?: string } = {};
    if (cityId) filters.cityId = cityId;
    if (areaId) filters.areaId = areaId;
    
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    return this.propertyService.findAll(filters, userId, userRole)
  }

  // get property by slug (must be before :id route)
  @Get('slug/:slug')
  @Header('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400')
  async findPropertyBySlug(@Param('slug') slug: string) {
    return await this.propertyService.findPropertyBySlug(slug)
  }

  // get property by id (must be after specific routes like 'all')
  @Get(':id')
  async findPropertyById(@Param('id') id: string) {
    try {
      return await this.propertyService.findPropertyByid(id)
    } catch (error) {
      throw error
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: CreatePropertyDto,
  ) {
    try {
      // Extract files from request
      const files = req.files as Express.Multer.File[]
      const mainPhoto = files?.find(file => file.fieldname === 'mainPhoto')
      const additionalPhotos = files?.filter(file => file.fieldname === 'additionalPhotos') || []

      // Upload files using StorageService
      const mainPhotoUrl = mainPhoto 
        ? this.storageService.getUrl(await this.storageService.upload(mainPhoto, 'properties'))
        : undefined
      const additionalPhotosUrls = additionalPhotos.length > 0
        ? await Promise.all(
            additionalPhotos.map(async (file) => {
              const key = await this.storageService.upload(file, 'properties');
              return this.storageService.getUrl(key);
            })
          )
        : undefined
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      const updated = await this.propertyService.update(id, dto as any, mainPhotoUrl, additionalPhotosUrls, userId, userRole)
      return { message: 'Property updated successfully', property: updated }
    } catch (error) {
      console.error('Error in update controller:', error);
      throw error;
    }
  }

  @Patch(':id/update-status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStatus(@Param('id') id: string) {
    return await this.propertyService.updateStatus(id)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      return await this.propertyService.delete(id, userId, userRole);
    } catch (error) {
      console.error('Error in delete controller:', error);
      throw error;
    }
  }


  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async uploadImage(@Request() req) {
    const files = req.files as Express.Multer.File[];
    const file = files?.[0] || files?.find(f => f.fieldname === 'file');
    
    if (!file) {
      throw new Error('No file uploaded');
    }
    
    console.log('Uploading file:', file.originalname, 'Size:', file.size, 'bytes');
    const key = await this.storageService.upload(file, 'properties/2026');
    const url = this.storageService.getUrl(key);
    console.log('File uploaded successfully:', key, 'URL:', url);
    return { key, url };
  }

  @Get('images/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listImages(@Query('folder') folder?: string) {
    try {
      const images = await this.storageService.listFiles(folder || 'properties');
      return { images, count: images.length };
    } catch (error) {
      console.error('Error listing images:', error);
      throw error;
    }
  }

  @Delete('images/:key')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteImage(@Param('key') key: string) {
    try {
      // Decode the key (it might be URL encoded)
      const decodedKey = decodeURIComponent(key);
      const deleted = await this.storageService.deleteFile(decodedKey);
      if (deleted) {
        return { message: 'Image deleted successfully', key: decodedKey };
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
}