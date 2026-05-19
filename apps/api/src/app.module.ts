 import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisCacheModule } from './redis-cache/redis-cache.module';
import { RevalidateModule } from './revalidate/revalidate.module';
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
import { MaterialRateModule } from './material-rate/material-rate.module';
import { DoorRateModule } from './door-rate/door-rate.module';
import { WoodRateModule } from './wood-rate/wood-rate.module';
import { SandRateModule } from './sand-rate/sand-rate.module';
import { TileRateModule } from './tile-rate/tile-rate.module';
import { BajriRateModule } from './bajri-rate/bajri-rate.module';
import { SteelRateModule } from './steel-rate/steel-rate.module';
import { BricksRateModule } from './bricks-rate/bricks-rate.module';
import { TileCategoryModule } from './tile-category/tile-category.module';
import { ListingApiModule } from './listing-api/listing-api.module';
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
    // 🔒 SECURITY: Global rate limiter — was previously a no-op because
    // ThrottlerModule was never imported even though @Throttle() decorators
    // existed on auth/login/register. Without this module those decorators
    // do nothing.
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,        // 1 second
        limit: 10,         // 10 req/sec/IP — burst protection
      },
      {
        name: 'medium',
        ttl: 60_000,      // 1 minute
        limit: 120,        // 120 req/min/IP — typical browsing
      },
      {
        name: 'long',
        ttl: 60 * 60_000, // 1 hour
        limit: 5_000,      // hard ceiling per IP per hour
      },
    ]),
    // ⚡ Redis cache (60s default TTL) and revalidation webhook caller —
    // both are global so any service can inject them.
    RedisCacheModule,
    RevalidateModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // 🔒 SECURITY: Never fall back to a hardcoded Atlas connection. If
        // MONGODB_URI is missing we crash early and loudly so production
        // misconfiguration is visible immediately.
        const uri = configService.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error(
            'MONGODB_URI is not defined. Refusing to start with insecure default credentials.'
          );
        }

        console.log('🔌 Attempting MongoDB connection...');
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
    MaterialRateModule,
    DoorRateModule,
    WoodRateModule,
    SandRateModule,
    TileRateModule,
    BajriRateModule,
    SteelRateModule,
    BricksRateModule,
    TileCategoryModule,
    ListingApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 🔒 SECURITY: Apply ThrottlerGuard globally so the @Throttle() decorators
    // on auth endpoints (and any future endpoint) are actually enforced.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}


