import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../app.module';

/**
 * Copies the seven per-material rate collections into the single
 * `materialrates` collection, stamping `materialType` on each row.
 *
 * Why: `material-rate.schema.ts` is field-for-field identical to
 * `door-rate.schema.ts` (and the wood / sand / tile / bajri / steel / bricks
 * schemas) apart from one `materialType` enum. That is seven collections,
 * seven Nest modules and seven pairs of dashboard pages doing what one of each
 * already does — and the unified table was invisible on the public site,
 * because each public rate page reads its own per-material endpoint.
 *
 * Safety properties:
 *  - **Copy, never move.** The source collections are left untouched, so this
 *    is reversible by dropping `materialrates` again.
 *  - **Idempotent.** Rows are upserted on their original `_id`, so running it
 *    twice does not duplicate anything.
 *  - **Dry run by default.** Nothing is written unless you pass `--apply`.
 *
 * Usage:
 *   npm run migrate:material-rates --workspace=apps/api            # dry run
 *   npm run migrate:material-rates --workspace=apps/api -- --apply # write
 */

/** source collection -> the materialType enum value the schema expects */
const SOURCES: Array<{
  collection: string;
  materialType: string;
  defaultUnit: string;
}> = [
  { collection: 'doorrates', materialType: 'Door', defaultUnit: 'Per Door' },
  {
    collection: 'woodrates',
    materialType: 'Wood',
    defaultUnit: 'Per Cubic Ft',
  },
  { collection: 'sandrates', materialType: 'Sand', defaultUnit: 'Per Trolley' },
  { collection: 'tilerates', materialType: 'Tile', defaultUnit: 'Per Sq Ft' },
  {
    collection: 'bajrirates',
    materialType: 'Bajri',
    defaultUnit: 'Per Trolley',
  },
  { collection: 'steelrates', materialType: 'Steel', defaultUnit: 'Per Ton' },
  {
    collection: 'bricksrates',
    materialType: 'Bricks',
    defaultUnit: 'Per 1000',
  },
];

const TARGET = 'materialrates';

async function migrate() {
  const apply = process.argv.includes('--apply');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db;
    if (!db) throw new Error('No database handle on the Mongoose connection.');

    const existingNames = new Set(
      (await db.listCollections().toArray()).map((c) => c.name),
    );

    console.log(
      apply
        ? '✍️  APPLY mode — rows will be written to `materialrates`.'
        : '🔍 DRY RUN — nothing will be written. Re-run with `-- --apply` to commit.',
    );
    console.log('');

    const target = db.collection(TARGET);
    let grandTotal = 0;
    let grandWritten = 0;
    const slugCollisions: string[] = [];

    for (const source of SOURCES) {
      if (!existingNames.has(source.collection)) {
        console.log(
          `   ${source.collection.padEnd(14)} — not present, skipping`,
        );
        continue;
      }

      const rows = await db.collection(source.collection).find({}).toArray();
      grandTotal += rows.length;

      if (rows.length === 0) {
        console.log(`   ${source.collection.padEnd(14)} — empty`);
        continue;
      }

      let written = 0;
      for (const row of rows) {
        // `slug` is indexed on MaterialRate; two materials can legitimately
        // share a brand name (e.g. a "Master" door and a "Master" tile), so
        // namespace the slug by material to keep them distinguishable.
        const baseSlug =
          typeof row.slug === 'string' && row.slug ? row.slug : '';
        const slug = baseSlug
          ? `${source.materialType.toLowerCase()}-${baseSlug}`
          : '';

        if (baseSlug) {
          const clash = await target.findOne({ slug, _id: { $ne: row._id } });
          if (clash)
            slugCollisions.push(`${source.collection}/${baseSlug} -> ${slug}`);
        }

        const doc = {
          brand: row.brand,
          slug,
          title:
            row.title ?? `${row.brand} — ${row.unit ?? source.defaultUnit}`,
          price: row.price,
          change: row.change ?? 0,
          city: row.city,
          unit: row.unit ?? source.defaultUnit,
          materialType: source.materialType,
          category: row.category ?? '',
          image: row.image,
          images: Array.isArray(row.images) ? row.images : [],
          description: row.description,
          isActive: row.isActive !== false,
          createdAt: row.createdAt ?? new Date(),
          updatedAt: row.updatedAt ?? new Date(),
        };

        if (apply) {
          // Upsert on the original _id: idempotent across repeated runs, and
          // it keeps any external reference to a rate id working.
          await target.updateOne(
            { _id: row._id },
            { $set: doc },
            { upsert: true },
          );
        }
        written += 1;
      }

      grandWritten += written;
      console.log(
        `   ${source.collection.padEnd(14)} — ${String(rows.length).padStart(4)} rows` +
          ` -> materialType "${source.materialType}"${apply ? ' ✅ written' : ''}`,
      );
    }

    console.log('');
    console.log(`   Total source rows: ${grandTotal}`);
    console.log(`   ${apply ? 'Written' : 'Would write'}: ${grandWritten}`);

    if (slugCollisions.length > 0) {
      console.warn('');
      console.warn(
        `⚠️  ${slugCollisions.length} slug collision(s) after namespacing:`,
      );
      for (const collision of slugCollisions.slice(0, 20)) {
        console.warn(`      ${collision}`);
      }
      console.warn('   Resolve these before switching the public pages over.');
    }

    if (!apply) {
      console.log('');
      console.log('   Nothing was changed. Re-run with:');
      console.log(
        '     npm run migrate:material-rates --workspace=apps/api -- --apply',
      );
    } else {
      console.log('');
      console.log('   Next steps:');
      console.log(
        '     1. Check /dashboard/material-rate shows every material.',
      );
      console.log('     2. Set MATERIAL_RATES_UNIFIED=true so the public rate');
      console.log('        pages read from the unified collection.');
      console.log(
        '     3. Verify each /today-<material>-rate-in-pakistan page.',
      );
      console.log('     4. Only then retire the seven per-material modules.');
      console.log('');
      console.log(
        '   The source collections were NOT modified — to roll back,',
      );
      console.log('   unset MATERIAL_RATES_UNIFIED and drop `materialrates`.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void migrate();
