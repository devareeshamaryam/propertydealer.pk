import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class IndexNowService {
  private readonly logger = new Logger(IndexNowService.name);
  private readonly apiUrl = 'https://api.indexnow.org/indexnow';

  constructor(private readonly configService: ConfigService) {}

  private get key() {
    return this.configService.get<string>('INDEXNOW_KEY');
  }

  private get host() {
    return this.configService.get<string>('APP_HOST') || 'propertydealer.pk';
  }

  private get keyLocation() {
    return `https://${this.host}/${this.key}.txt`;
  }

  async submitUrls(urls: string[]): Promise<void> {
    if (!this.key || urls.length === 0) {
      this.logger.warn('IndexNow: Key missing or empty URL list');
      return;
    }

    const payload = {
      host: this.host,
      key: this.key,
      keyLocation: this.keyLocation,
      urlList: urls,
    };

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 200) {
        this.logger.log(`IndexNow: Successfully submitted ${urls.length} URLs`);
      } else {
        this.logger.warn(`IndexNow failed: ${response.status} - ${response.statusText}`);
      }
    } catch (error: any) {
      this.logger.error(
        `IndexNow submission error: ${error.response?.status} - ${JSON.stringify(error.response?.data) || error.message}`,
      );
    }
  }

  async submitUrl(url: string): Promise<void> {
    return this.submitUrls([url]);
  }
}
