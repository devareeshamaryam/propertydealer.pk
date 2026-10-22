import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CementRate, CementRateSchema } from '@rent-ghar/db/schemas/cement-rate.schema';
import { SteelRate, SteelRateSchema } from '@rent-ghar/db/schemas/steel-rate.schema';
import { BricksRate, BricksRateSchema } from '@rent-ghar/db/schemas/bricks-rate.schema';
import { SandRate, SandRateSchema } from '@rent-ghar/db/schemas/sand-rate.schema';
import { BajriRate, BajriRateSchema } from '@rent-ghar/db/schemas/bajri-rate.schema';
import { WoodRate, WoodRateSchema } from '@rent-ghar/db/schemas/wood-rate.schema';
import { DoorRate, DoorRateSchema } from '@rent-ghar/db/schemas/door-rate.schema';
import { TileRate, TileRateSchema } from '@rent-ghar/db/schemas/tile-rate.schema';
import { CementOrder, CementOrderSchema } from '@rent-ghar/db/schemas/cement-order.schema';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { MaterialTypeModule } from '../material-type/material-type.module';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { ConstructionService } from './construction.service';
import { ConstructionController } from './construction.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CementRate.name, schema: CementRateSchema },
      { name: SteelRate.name, schema: SteelRateSchema },
      { name: BricksRate.name, schema: BricksRateSchema },
      { name: SandRate.name, schema: SandRateSchema },
      { name: BajriRate.name, schema: BajriRateSchema },
      { name: WoodRate.name, schema: WoodRateSchema },
      { name: DoorRate.name, schema: DoorRateSchema },
      { name: TileRate.name, schema: TileRateSchema },
      { name: CementOrder.name, schema: CementOrderSchema },
    ]),
    SiteSettingsModule,
    MaterialTypeModule,
  ],
  providers: [ShopService, ConstructionService],
  controllers: [ShopController, ConstructionController],
})
export class ShopModule {}
