import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TileCategoryController } from './tile-category.controller';
import { TileCategoryService } from './tile-category.service';
import { TileCategory, TileCategorySchema } from '@rent-ghar/db/schemas/tile-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TileCategory.name, schema: TileCategorySchema },
    ]),
  ],
  controllers: [TileCategoryController],
  providers: [TileCategoryService],
  exports: [TileCategoryService],
})
export class TileCategoryModule {}