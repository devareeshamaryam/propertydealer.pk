import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Blog, BlogSchema } from '@rent-ghar/db/schemas/blog.schema';
import { Category, CategorySchema } from '@rent-ghar/db/schemas/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: Category.name, schema: CategorySchema }
    ])
  ],
  providers: [BlogService],
  controllers: [BlogController]
})
export class BlogModule {}
