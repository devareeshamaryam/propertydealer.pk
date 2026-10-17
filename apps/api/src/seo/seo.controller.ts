import { Controller, Get, Header } from '@nestjs/common';
import { SeoService } from './seo.service';

/** Public, cached: what the site's sitemaps list. */
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('sitemap-data')
  @Header('Cache-Control', 'public, max-age=600, s-maxage=3600')
  async sitemapData() {
    return this.seo.sitemapData();
  }
}
