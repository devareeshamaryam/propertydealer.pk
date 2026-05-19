import { Global, Module } from '@nestjs/common';
import { RevalidateService } from './revalidate.service';

/**
 * Global so any feature service can inject `RevalidateService` and trigger
 * cache + ISR invalidation after a write.
 */
@Global()
@Module({
  providers: [RevalidateService],
  exports: [RevalidateService],
})
export class RevalidateModule {}
