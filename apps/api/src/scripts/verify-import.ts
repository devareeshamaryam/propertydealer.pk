import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const propertyModel = app.get(getModelToken('Property'));

  const totalCount = await propertyModel.countDocuments();
  const importCount = await propertyModel.countDocuments({ status: 'approved' });
  const saleCount = await propertyModel.countDocuments({ listingType: 'sale' });
  const rentCount = await propertyModel.countDocuments({ listingType: 'rent' });

  console.log('--- IMPORT VERIFICATION ---');
  console.log(`Total Properties in DB: ${totalCount}`);
  console.log(`Approved Properties: ${importCount}`);
  console.log(`Sale Properties: ${saleCount}`);
  console.log(`Rent Properties: ${rentCount}`);

  const latest = await propertyModel.find().sort({ createdAt: -1 }).limit(3).exec();
  console.log('--- LATEST 3 PROPERTIES ---');
  latest.forEach(p => {
    console.log(`- ${p.title} (Price: ${p.price}, Type: ${p.propertyType}, Listing: ${p.listingType})`);
  });

  await app.close();
}

bootstrap();
