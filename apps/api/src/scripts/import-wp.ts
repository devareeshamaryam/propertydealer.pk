import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ImportService } from '../import/import.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const importService = app.get(ImportService);

  // Check multiple possible locations for the XML file
  const possiblePaths = [
    path.join(process.cwd(), '../../propertydealer.WordPress.2026-02-12.xml'),
    path.join(process.cwd(), 'propertydealer.WordPress.2026-02-12.xml'),
    path.join(__dirname, '../../../../../../../propertydealer.WordPress.2026-02-12.xml'),
    path.join(__dirname, '../../../../../../propertydealer.WordPress.2026-02-12.xml'),
  ];

  let xmlPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      xmlPath = p;
      break;
    }
  }
  
  if (!xmlPath) {
    console.error(`❌ XML file not found. Checked:`, possiblePaths);
    process.exit(1);
  }

  console.log(`🚀 Starting import from: ${xmlPath}`);
  const xmlData = fs.readFileSync(xmlPath, 'utf-8');
  
  // Use a default admin ID or find an admin user. 
  // For this script, we'll need a valid admin user ID from the DB.
  // I will assume the first admin found or a specific ID if known.
  // For safety, I'll log that it needs an ID.
  
  // In a real scenario, you'd pass the owner ID.
  // I'll try to find the first admin user.
  const { getModelToken } = require('@nestjs/mongoose');
  const userModel = app.get(getModelToken('User'));
  const adminUser = await userModel.findOne({ role: 'ADMIN' });
  if (!adminUser) {
    console.error('❌ No admin user found to assign properties to.');
    process.exit(1);
  }

  try {
    const result = await importService.importWordPress(xmlData, adminUser._id.toString());
    console.log('✅ Import Completed Successfully!');
    console.log(`📊 Statistics:`, result);
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
