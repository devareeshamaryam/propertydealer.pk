import { Module } from '@nestjs/common';
import { AgencyModule } from '../agency/agency.module';
import { DealersService } from './dealers.service';
import { DealersController } from './dealers.controller';

/** City-by-city directory of agencies and agents (/property-dealers-in-<city>). */
@Module({
  imports: [AgencyModule],
  providers: [DealersService],
  controllers: [DealersController],
  exports: [DealersService],
})
export class DealersModule {}
