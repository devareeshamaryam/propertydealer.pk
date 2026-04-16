import { Module, Global } from '@nestjs/common';
import { IndexNowService } from './indexnow.service';

@Global()
@Module({
  providers: [IndexNowService],
  exports: [IndexNowService],
})
export class IndexNowModule {}
