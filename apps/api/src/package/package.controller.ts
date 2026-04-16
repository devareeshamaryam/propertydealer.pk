import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto, UpdatePackageDto } from '@rent-ghar/types/package';
import { PackageDocument } from '@rent-ghar/db/schemas/package.schema';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get()
  async findAll() {
    return this.packageService.findAll();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllIncludingInactive() {
    return this.packageService.findAllIncludingInactive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.packageService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() dto: CreatePackageDto) {
    return this.packageService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packageService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string) {
    return this.packageService.delete(id);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async seed() {
    const packages = [
      {
        name: 'Basic',
        description: 'Perfect for individuals listing a few properties',
        price: 0,
        duration: 30,
        propertyLimit: 1,
        featuredListings: 0,
        photosPerProperty: 5,
        isActive: true,
        features: ['1 property listing', '5 photos per property', '30 days validity'],
      },
      {
        name: 'Standard',
        description: 'Great for small property owners',
        price: 2999,
        duration: 30,
        propertyLimit: 5,
        featuredListings: 1,
        photosPerProperty: 10,
        isActive: true,
        features: [
          '5 property listings',
          '1 featured listing',
          '10 photos per property',
          '30 days validity',
          'Priority support',
        ],
      },
      {
        name: 'Premium',
        description: 'Ideal for professional property dealers',
        price: 7999,
        duration: 30,
        propertyLimit: 15,
        featuredListings: 3,
        photosPerProperty: 15,
        isActive: true,
        features: [
          '15 property listings',
          '3 featured listings',
          '15 photos per property',
          '30 days validity',
          'Premium badge',
          'Priority support',
          'Premium placement',
        ],
      },
      {
        name: 'Enterprise',
        description: 'For large property management companies',
        price: 19999,
        duration: 90,
        propertyLimit: 50,
        featuredListings: 10,
        photosPerProperty: 20,
        isActive: true,
        features: [
          '50 property listings',
          '10 featured listings',
          '20 photos per property',
          '90 days validity',
          'Enterprise badge',
          'Dedicated support',
          'Premium placement',
          'Analytics dashboard',
        ],
      },
    ];

    const created: PackageDocument[] = [];
    for (const pkg of packages) {
      const result = await this.packageService.create(pkg);
      created.push(result);
    }

    return {
      success: true,
      message: `Successfully seeded ${created.length} packages`,
      packages: created,
    };
  }
}
