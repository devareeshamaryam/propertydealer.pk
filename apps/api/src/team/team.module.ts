import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AgencyModule } from '../agency/agency.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    SubscriptionModule,
    AgencyModule,
  ],
  providers: [TeamService],
  controllers: [TeamController],
})
export class TeamModule {}
