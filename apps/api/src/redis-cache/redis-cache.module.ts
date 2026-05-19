import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';

/**
 * Global cache module so any service can inject `RedisCacheService` without
 * having to import `RedisCacheModule` from each feature module.
 */
@Global()
@Module({
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
