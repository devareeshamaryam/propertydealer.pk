
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PropertyService } from '../property/property.service';
import { getModelToken } from '@nestjs/mongoose';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const propertyModel = app.get<Model<Property>>(getModelToken(Property.name));

  const properties = await propertyModel.find({ listingType: 'rent', status: 'approved' }).limit(5).exec();
  
  console.log('--- FOUND PROPERTIES ---');
  properties.forEach(p => {
    console.log('ID:', p._id);
    console.log('Title:', p.title);
    // Log ALL keys, including those not in schema if strict is false or if using lean()
    // However, find() returns Mongoose documents based on Schema. Aggregation works on raw docs.
    // Let's inspect the raw object.
    console.log('Raw Doc:', JSON.stringify(p.toObject(), null, 2));
  });

  // Also try aggregation to see what match sees
  const city = 'karachi';
  const cityRegex = new RegExp(`^${city}$`, 'i');
  
  const aggregationResult = await propertyModel.aggregate([
    { $match: { listingType: 'rent', status: 'approved' } },
    {
        $lookup: {
            from: 'areas',
            localField: 'area',
            foreignField: '_id',
            as: 'areaDetails'
        }
    },
    { $unwind: { path: '$areaDetails', preserveNullAndEmptyArrays: true } },
    {
        $lookup: {
            from: 'cities',
            localField: 'areaDetails.city',
            foreignField: '_id',
            as: 'cityDetails'
        }
    },
    { $unwind: { path: '$cityDetails', preserveNullAndEmptyArrays: true } },
    {
        $addFields: {
            computedCityName: {
                $ifNull: ['$cityDetails.name', '$city']
            }
        }
    },
    {
        $match: {
            computedCityName: cityRegex
        }
    },
    {
        $project: {
             _id: 1,
             title: 1,
             city: 1,
             'cityDetails.name': 1,
             computedCityName: 1
        }
    }
  ]).exec();

  console.log('--- AGGREGATION RESULT ---');
  console.log(JSON.stringify(aggregationResult, null, 2));

  await app.close();
}

bootstrap();
