import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import sharp from 'sharp';
import { AppModule } from '../app.module';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { Media, MediaDocument } from '@rent-ghar/db/schemas/media.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';

/**
 * Brings images that are already on disk into the media library.
 *
 * Without this the library is empty on day one even though the site is full of
 * pictures, and nobody can re-use anything they uploaded before.
 *
 * ⚠️ URLs are never touched. The site is live and ranked, so every existing
 * file keeps its exact path and extension — this only writes a database row
 * pointing at it, marked `imported: true`. Nothing is converted, renamed,
 * moved or deleted. Only images uploaded from now on go through the WebP
 * pipeline with readable names.
 *
 * Dry run by default:
 *   npm run import:media --workspace=apps/api
 *   npm run import:media --workspace=apps/api -- --apply
 */

/** Files the library should not show. */
const SKIP = /(-thumb\.webp|\.meta\.json|\.DS_Store|thumbs\.db)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i;

/** "property-photos/5-marla-house-dha.jpg" -> "5 marla house dha" */
function altFromKey(key: string): string {
  const base = key.split('/').pop() ?? key;
  return (
    base
      .replace(/\.[a-z0-9]+$/i, '')
      // Drop a trailing UUID or hash so the alt text reads as words.
      .replace(/[-_][0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Guess a folder from the top-level directory the file already sits in. */
function folderFromKey(key: string): string {
  const head = key.split('/')[0]?.toLowerCase() ?? '';
  if (head.startsWith('propert')) return 'properties';
  if (head.includes('blog')) return 'blog';
  if (head.includes('rate')) return 'rates';
  if (head.includes('cit')) return 'cities';
  if (head.includes('area')) return 'areas';
  if (head.includes('tile')) return 'tile-categories';
  if (head.includes('page')) return 'pages';
  return 'general';
}

async function importExisting() {
  const apply = process.argv.includes('--apply');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const storage = app.get(StorageService);
    const mediaModel = app.get<Model<MediaDocument>>(getModelToken(Media.name));
    const userModel = app.get<Model<any>>(getModelToken(User.name));

    // Imported rows are attributed to an admin, so they show in the admin
    // library. Agents' own uploads from here on are attributed to them.
    const admin = (await userModel
      .findOne({ role: 'ADMIN' })
      .select('_id')
      .lean()) as { _id: unknown } | null;
    if (!admin) {
      throw new Error('No ADMIN user found — imported images need an owner.');
    }

    console.log(
      apply
        ? '✍️  APPLY mode — library rows will be written. Files are NOT modified.'
        : '🔍 DRY RUN — nothing will be written. Re-run with `-- --apply` to commit.',
    );
    console.log('');

    const files = await storage.listFiles('');
    const images = files.filter(
      (f) => IMAGE_EXT.test(f.key) && !SKIP.test(f.key),
    );

    console.log(
      `   Found ${files.length} files, ${images.length} of them images.`,
    );

    let created = 0;
    let skipped = 0;
    let unreadable = 0;

    for (const file of images) {
      const url = storage.getUrl(file.key);

      // Idempotent: a second run adds nothing.
      if (await mediaModel.exists({ key: file.key })) {
        skipped += 1;
        continue;
      }

      let width = 0;
      let height = 0;
      try {
        const buffer = await storage.readBuffer(file.key);
        if (buffer) {
          const meta = await sharp(buffer).metadata();
          width = meta.width ?? 0;
          height = meta.height ?? 0;
        }
      } catch {
        unreadable += 1;
      }

      if (apply) {
        await mediaModel.create({
          url,
          // No separate thumbnail exists for these — the grid uses the full
          // image, which is why only new uploads get a real thumb.
          thumbUrl: url,
          key: file.key,
          mime: 'image/*',
          width,
          height,
          sizeBytes: file.size ?? 0,
          originalName: file.key.split('/').pop() ?? file.key,
          title: altFromKey(file.key),
          alt: altFromKey(file.key),
          caption: '',
          altSource: 'auto',
          aiStatus: 'skipped',
          folder: folderFromKey(file.key),
          uploadedBy: admin._id,
          imported: true,
          createdAt: file.modified ?? new Date(),
        });
      }
      created += 1;
    }

    console.log('');
    console.log(`   ${apply ? 'Imported' : 'Would import'}: ${created}`);
    console.log(`   Already in the library: ${skipped}`);
    if (unreadable)
      console.log(`   Could not read dimensions for: ${unreadable}`);

    if (!apply) {
      console.log('');
      console.log('   Nothing was changed. Re-run with:');
      console.log('     npm run import:media --workspace=apps/api -- --apply');
    } else {
      console.log('');
      console.log('   Every file kept its original URL — no path changed, so');
      console.log(
        '   nothing that is indexed moved. Alt text was guessed from',
      );
      console.log('   the file name; open any image in the library and press');
      console.log('   "Write with AI" to improve it.');
    }
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void importExisting();
