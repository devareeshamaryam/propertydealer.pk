import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AssistantDataService, type SearchInput } from './assistant-data.service';

/**
 * Live data for the site assistant. Public — it is the same data the
 * listing pages show — and read-only. The chat itself runs on the web
 * server (apps/web/app/assistant/chat), which calls these.
 */
@Controller('assistant')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AssistantController {
  constructor(private readonly data: AssistantDataService) {}

  @Get('places')
  @Header('Cache-Control', 'public, max-age=60')
  places(@Query('q') q = '', @Query('city') city?: string) {
    return this.data.places(String(q).slice(0, 120), city ? String(city).slice(0, 60) : undefined);
  }

  @Post('search')
  search(@Body() body: SearchInput) {
    return this.data.search(body || {});
  }

  @Post('market')
  market(@Body() body: SearchInput) {
    return this.data.market(body || {});
  }
}
