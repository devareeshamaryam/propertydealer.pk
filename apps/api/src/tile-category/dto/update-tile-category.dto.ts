import { PartialType } from '@nestjs/mapped-types';
import { CreateTileCategoryDto } from './create-tile-category.dto';

export class UpdateTileCategoryDto extends PartialType(CreateTileCategoryDto) {}