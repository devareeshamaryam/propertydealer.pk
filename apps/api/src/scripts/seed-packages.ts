import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PackageService } from '../package/package.service';

async function seedPackages() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const packageService = app.get(PackageService);

  const packages = [
    {
      name: 'Basic',
      description: 'Perfect for individuals listing a few properties',
      price: 0,
      duration: 30,
      propertyLimit: 1,
      featuredListings: 0,
      photosPerProperty: 5,
      isActive: true,
      features: ['1 property listing', '5 photos per property', '30 days validity'],
    },
    {
      name: 'Standard',
      description: 'Great for small property owners',
      price: 2999,
      duration: 30,
      propertyLimit: 5,
      featuredListings: 1,
      photosPerProperty: 10,
      isActive: true,
      features: [
        '5 property listings',
        '1 featured listing',
        '10 photos per property',
        '30 days validity',
        'Priority support',
      ],
    },
    {
      name: 'Premium',
      description: 'Ideal for professional property dealers',
      price: 7999,
      duration: 30,
      propertyLimit: 15,
      featuredListings: 3,
      photosPerProperty: 15,
      isActive: true,
      features: [
        '15 property listings',
        '3 featured listings',
        '15 photos per property',
        '30 days validity',
        'Premium badge',
        'Priority support',
        'Premium placement',
      ],
    },
    {
      name: 'Enterprise',
      description: 'For large property management companies',
      price: 19999,
      duration: 90,
      propertyLimit: 50,
      featuredListings: 10,
      photosPerProperty: 20,
      isActive: true,
      features: [
        '50 property listings',
        '10 featured listings',
        '20 photos per property',
        '90 days validity',
        'Enterprise badge',
        'Dedicated support',
        'Premium placement',
        'Analytics dashboard',
      ],
    },
  ];

  console.log('🌱 Seeding packages...');

  try {
    for (const pkg of packages) {
      const created = await packageService.create(pkg);
      console.log(`✅ Created package: ${created.name} (Rs. ${created.price})`);
    }

    console.log('✅ Package seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding packages:', error);
  }

  await app.close();
  process.exit(0);
}

seedPackages();
