 import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { TileCategory, TileCategoryDocument } from '@rent-ghar/db/schemas/tile-category.schema';
import { CreateTileCategoryDto, UpdateTileCategoryDto } from './dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TileCategoryService {
  private readonly uploadsDir: string;

  constructor(
    @InjectModel(TileCategory.name)
    private tileCategoryModel: Model<TileCategoryDocument>,
  ) {
    // Same uploads path logic as app.module.ts
    const cwd = process.cwd();
    const isInAppsApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
    this.uploadsDir = isInAppsApi
      ? path.join(cwd, '..', '..', 'uploads', 'tile-category')
      : path.join(cwd, 'uploads', 'tile-category');

    // Folder na ho to bana lo
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // ── Image save helper ──────────────────────────────────────────
  private saveImage(file: Express.Multer.File): string {
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `tile-cat-${Date.now()}${ext}`;
    const filepath = path.join(this.uploadsDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    return `/uploads/tile-category/${filename}`;
  }

  private deleteImage(imageUrl: string) {
    try {
      const cwd = process.cwd();
      const isInAppsApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
      const base = isInAppsApi
        ? path.join(cwd, '..', '..', 'uploads')
        : path.join(cwd, 'uploads');
      const filepath = path.join(base, imageUrl.replace('/uploads/', ''));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch (_) {}
  }

  // ── CRUD ───────────────────────────────────────────────────────
  async findAll(): Promise<TileCategoryDocument[]> {
    return this.tileCategoryModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .exec();
  }

  async findAllAdmin(): Promise<TileCategoryDocument[]> {
    return this.tileCategoryModel.find().sort({ order: 1, createdAt: 1 }).exec();
  }

  async findById(id: string): Promise<TileCategoryDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const cat = await this.tileCategoryModel.findById(id).exec();
    if (!cat) throw new NotFoundException('Tile category not found');
    return cat;
  }

  async findBySlug(slug: string): Promise<TileCategoryDocument> {
    const cat = await this.tileCategoryModel.findOne({ slug, isActive: true }).exec();
    if (!cat) throw new NotFoundException(`Tile category not found: ${slug}`);
    return cat;
  }

  async create(
    dto: CreateTileCategoryDto,
    file?: Express.Multer.File,
  ): Promise<TileCategoryDocument> {
    try {
      const data: any = { ...dto };
      if (file) data.image = this.saveImage(file);

      const cat = new this.tileCategoryModel(data);
      return await cat.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('A category with this slug already exists');
      }
      throw new BadRequestException(error.message || 'Failed to create category');
    }
  }

  async update(
    id: string,
    dto: UpdateTileCategoryDto,
    file?: Express.Multer.File,
  ): Promise<TileCategoryDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');

    const data: any = { ...dto };

    if (file) {
      // Purani image delete karo
      const existing = await this.tileCategoryModel.findById(id).exec();
      if (existing?.image) this.deleteImage(existing.image);
      data.image = this.saveImage(file);
    }

    const cat = await this.tileCategoryModel
      .findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .exec();
    if (!cat) throw new NotFoundException('Tile category not found');
    return cat;
  }

  async remove(id: string): Promise<TileCategoryDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const cat = await this.tileCategoryModel.findByIdAndDelete(id).exec();
    if (!cat) throw new NotFoundException('Tile category not found');
    // Image bhi delete karo
    if (cat.image) this.deleteImage(cat.image);
    return cat;
  }
}