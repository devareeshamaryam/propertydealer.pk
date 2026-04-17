 import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PropertyModule } from './property/property.module';
import { CityModule } from './city/city.module';
import { AreaModule } from './area/area.module';
import { CategoryModule } from './category/category.module';
import { BlogModule } from './blog/blog.module';
import { PageModule } from './page/page.module';
import { PackageModule } from './package/package.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { UserModule } from './user/user.module';
import { StorageModule } from '../../../packages/storage/storage.module';
import { ImportModule } from './import/import.module';
import { IndexNowModule } from './indexnow/indexnow.module';
import { CementRateModule } from './cement-rate/cement-rate.module';
import { CementOrderModule } from './cement-order/cement-order.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

const cwd = process.cwd();
const isInAppsApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
const uploadsPath = isInAppsApi ? path.join(cwd, '..', '..', 'uploads') : path.join(cwd, 'uploads');

@Module({
  imports: [
    StorageModule,
    ServeStaticModule.forRoot({
      rootPath: uploadsPath,
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI') || 'mongodb+srv://admin:admin1234@cluster0.lmunqjj.mongodb.net/rent-ghar';
        
        console.log('🔌 Attempting MongoDB connection...');
        if (!uri) {
          console.error('❌ MONGODB_URI is not defined in environment variables');
        }
        return {
          uri: uri,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              console.log('✅ MongoDB connected successfully');
            });
            connection.on('error', (err) => {
              console.error('❌ MongoDB connection error:', err.message);
            });
            connection.on('disconnected', () => {
              console.warn('⚠️ MongoDB disconnected');
            });
            return connection;
          },
        };
      },
    }),
    AuthModule,
    PropertyModule,
    CityModule,
    AreaModule,
    CategoryModule,
    BlogModule,
    PageModule,
    PackageModule,
    SubscriptionModule,
    UserModule,
    ImportModule,
    IndexNowModule,
    CementRateModule,
    CementOrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


