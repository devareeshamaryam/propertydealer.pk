const fs = require('fs');
const path = require('path');

const materials = [
  { name: 'Door', slug: 'door', plural: 'Doors', unit: 'Per Door' },
  { name: 'Wood', slug: 'wood', plural: 'Wood', unit: 'Per Cubic Foot' },
  { name: 'Sand', slug: 'sand', plural: 'Sand', unit: 'Per Cubic Foot' },
  { name: 'Tile', slug: 'tile', plural: 'Tiles', unit: 'Per Sq Ft' },
  { name: 'Bajri', slug: 'bajri', plural: 'Bajri', unit: 'Per Cubic Foot' },
  { name: 'Steel', slug: 'steel', plural: 'Steel', unit: 'Per Kg' },
  { name: 'Bricks', slug: 'bricks', plural: 'Bricks', unit: 'Per 1000 Bricks' },
];

const apiDir = path.join(__dirname, '../apps/api/src');
const dbDir = path.join(__dirname, '../packages/db/src/schemas');

materials.forEach(material => {
  const moduleName = `${material.slug}-rate`;
  const moduleDir = path.join(apiDir, moduleName);
  const dtoDir = path.join(moduleDir, 'dto');

  // Create directories
  if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir, { recursive: true });
  if (!fs.existsSync(dtoDir)) fs.mkdirSync(dtoDir, { recursive: true });

  const capitalName = material.name;
  const camelName = material.slug.charAt(0).toUpperCase() + material.slug.slice(1);

  // ========== 1. SCHEMA ==========
  const schemaContent = `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ${camelName}RateDocument = ${camelName}Rate & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
})
export class ${camelName}Rate {
  @Prop({ required: true, trim: true })
  brand: string;

  @Prop({ lowercase: true, index: true })
  slug: string;

  @Prop({ trim: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  change: number;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ default: '${material.unit}' })
  unit: string;

  @Prop({ trim: true })
  category?: string;

  @Prop({ trim: true })
  image?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ${camelName}RateSchema = SchemaFactory.createForClass(${camelName}Rate);

${camelName}RateSchema.pre('save', function () {
  if (this.isModified('brand') || !this.slug) {
    this.slug = this.brand
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!this.title) {
    this.title = \`\${this.brand} — \${this.unit}\`;
  }
});

${camelName}RateSchema.index({ city: 1, category: 1 });
${camelName}RateSchema.index({ isActive: 1, createdAt: -1 });
`;

  fs.writeFileSync(path.join(dbDir, `${material.slug}-rate.schema.ts`), schemaContent);

  // ========== 2. DTOs ==========
  const createDtoContent = `import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class Create${camelName}RateDto {
  @IsString()
  brand: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  change?: number;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  images?: string[];
}
`;

  const updateDtoContent = `import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class Update${camelName}RateDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  change?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  images?: string[];
}
`;

  const indexDtoContent = `export * from './create-${material.slug}-rate.dto';
export * from './update-${material.slug}-rate.dto';
`;

  fs.writeFileSync(path.join(dtoDir, `create-${material.slug}-rate.dto.ts`), createDtoContent);
  fs.writeFileSync(path.join(dtoDir, `update-${material.slug}-rate.dto.ts`), updateDtoContent);
  fs.writeFileSync(path.join(dtoDir, 'index.ts'), indexDtoContent);

  // ========== 3. SERVICE ==========
  const serviceContent = `import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { ${camelName}Rate, ${camelName}RateDocument } from '@rent-ghar/db/schemas/${material.slug}-rate.schema';
import { Create${camelName}RateDto, Update${camelName}RateDto } from './dto';

@Injectable()
export class ${camelName}RateService {
  constructor(
    @InjectModel(${camelName}Rate.name)
    private ${material.slug}RateModel: Model<${camelName}RateDocument>,
  ) {}

  async findAll(city?: string, category?: string): Promise<${camelName}RateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.${material.slug}RateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<${camelName}RateDocument[]> {
    return this.${material.slug}RateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<${camelName}RateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.${material.slug}RateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('${capitalName} rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<${camelName}RateDocument> {
    const rate = await this.${material.slug}RateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(\`${capitalName} rate not found: \${slug}\`);
    return rate;
  }

  async create(dto: Create${camelName}RateDto): Promise<${camelName}RateDocument> {
    const rate = new this.${material.slug}RateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: Update${camelName}RateDto): Promise<${camelName}RateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.${material.slug}RateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('${capitalName} rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.${material.slug}RateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('${capitalName} rate not found');
  }
}
`;

  fs.writeFileSync(path.join(moduleDir, `${material.slug}-rate.service.ts`), serviceContent);

  // ========== 4. CONTROLLER ==========
  const controllerContent = `import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Request, BadRequestException,
  HttpCode, HttpStatus,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ${camelName}RateService } from './${material.slug}-rate.service';
import { Create${camelName}RateDto, Update${camelName}RateDto } from './dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StorageService } from '@rent-ghar/storage/storage.service';

@Controller('${material.slug}-rate')
export class ${camelName}RateController {
  constructor(
    private readonly ${material.slug}RateService: ${camelName}RateService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  async findAll(
    @Query('city') city?: string,
    @Query('category') category?: string,
  ) {
    return this.${material.slug}RateService.findAll(city, category);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.${material.slug}RateService.findBySlug(slug);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllAdmin() {
    return this.${material.slug}RateService.findAllAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.${material.slug}RateService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req) {
    try {
      console.log('📝 Creating ${material.slug} rate...');
      const files: any[] = req.files ?? [];
      const body = req.body;

      if (!body.brand) throw new BadRequestException('Brand is required');
      if (!body.price) throw new BadRequestException('Price is required');
      if (!body.city) throw new BadRequestException('City is required');

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        const key = await this.storageService.upload(imageFile, '${material.slug}-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, '${material.slug}-rates');
        extraUrls.push(this.storageService.getUrl(key));
      }

      const dto: Create${camelName}RateDto = {
        brand:       body.brand,
        price:       Number(body.price),
        change:      body.change ? Number(body.change) : 0,
        city:        body.city,
        unit:        body.unit || '${material.unit}',
        category:    body.category || undefined,
        title:       body.title || undefined,
        description: body.description || undefined,
        isActive:    body.isActive !== undefined ? body.isActive === 'true' || body.isActive === true : true,
        ...(imageUrl             ? { image: imageUrl }    : {}),
        ...(extraUrls.length > 0 ? { images: extraUrls } : {}),
      };

      const result = await this.${material.slug}RateService.create(dto);
      console.log('✅ ${capitalName} rate created:', result._id);
      return result;
    } catch (error) {
      console.error('❌ Error creating ${material.slug} rate:', error);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(@Param('id') id: string, @Request() req) {
    try {
      const files: any[] = req.files ?? [];
      const body = req.body;

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        const key = await this.storageService.upload(imageFile, '${material.slug}-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const newExtraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, '${material.slug}-rates');
        newExtraUrls.push(this.storageService.getUrl(key));
      }

      let keptImages: string[] = [];
      if (body.existingImages) {
        keptImages = Array.isArray(body.existingImages)
          ? body.existingImages
          : [body.existingImages];
      }

      const mergedImages = [...keptImages, ...newExtraUrls];

      const dto: Update${camelName}RateDto = {
        ...(body.brand       ? { brand: body.brand }               : {}),
        ...(body.price       ? { price: Number(body.price) }       : {}),
        ...(body.change !== undefined ? { change: Number(body.change) } : {}),
        ...(body.city        ? { city: body.city }                 : {}),
        ...(body.unit        ? { unit: body.unit }                 : {}),
        ...(body.category    ? { category: body.category }         : {}),
        ...(body.title       ? { title: body.title }               : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive === 'true' || body.isActive === true } : {}),
        ...(imageUrl         ? { image: imageUrl }                 : {}),
        images: mergedImages,
      };

      return this.${material.slug}RateService.update(id, dto);
    } catch (error) {
      console.error('❌ Error updating ${material.slug} rate:', error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.${material.slug}RateService.remove(id);
  }
}
`;

  fs.writeFileSync(path.join(moduleDir, `${material.slug}-rate.controller.ts`), controllerContent);

  // ========== 5. MODULE ==========
  const moduleContent = `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${camelName}Rate, ${camelName}RateSchema } from '@rent-ghar/db/schemas/${material.slug}-rate.schema';
import { ${camelName}RateService } from './${material.slug}-rate.service';
import { ${camelName}RateController } from './${material.slug}-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ${camelName}Rate.name, schema: ${camelName}RateSchema },
    ]),
    StorageModule,
  ],
  providers: [${camelName}RateService],
  controllers: [${camelName}RateController],
  exports: [${camelName}RateService],
})
export class ${camelName}RateModule {}
`;

  fs.writeFileSync(path.join(moduleDir, `${material.slug}-rate.module.ts`), moduleContent);

  console.log(`✅ Created ${moduleName} module`);
});

console.log('\n🎉 All 7 rate modules created successfully!');
console.log('\n📝 Next steps:');
console.log('1. Register modules in app.module.ts');
console.log('2. Build backend: npm run build');
console.log('3. Restart backend server');
