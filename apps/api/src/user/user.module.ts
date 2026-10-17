import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PublicProfileController } from './public-profile.controller';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AgencyModule } from '../agency/agency.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SubscriptionModule,
    AgencyModule,
  ],
  providers: [UserService],
  controllers: [UserController, PublicProfileController],
  exports: [UserService],
})
export class UserModule {}
