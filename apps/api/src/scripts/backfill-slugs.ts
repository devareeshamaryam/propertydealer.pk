import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PropertyService } from '../property/property.service';

/**
 * Backfills `slug` on any property row that lacks one.
 *
 * This used to happen implicitly on every read: both the dashboard list and
 * the public listing called `ensureSlugForProperties`, and a 404 on a slug
 * lookup scanned the whole approved set and wrote slugs for anything missing
 * one. That put find+update round trips inside GET requests. Slugs are now
 * written on create and update only, and this script covers legacy rows.
 *
 * Run once after deploying:
 *   npm run backfill:slugs --workspace=apps/api
 */
async function backfillSlugs() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const propertyService = app.get(PropertyService);
    console.log('🔎 Looking for properties without a slug…');

    const { scanned, updated } = await propertyService.backfillMissingSlugs();

    if (scanned === 0) {
      console.log('✅ Nothing to do — every property already has a slug.');
    } else {
      console.log(`✅ Found ${scanned} without a slug; wrote ${updated}.`);
      if (updated < scanned) {
        console.warn(
          `⚠️  ${scanned - updated} could not be given a slug — most likely missing a title.`,
        );
      }
    }
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void backfillSlugs();
