import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentReview, AgentReviewSchema } from '@rent-ghar/db/schemas/agent-review.schema';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentReview.name, schema: AgentReviewSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
  ],
  providers: [ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService],
})
export class ReviewModule {}
