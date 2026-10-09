import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../app.module';

/**
 * Repairs reference fields that are stored as strings instead of ObjectIds.
 *
 * ## The defect
 *
 * The schemas declare these three fields as `{ type: Types.ObjectId, ref: … }`
 * and everything written through the API today obeys that. Part of the data
 * does not: a share of the rows hold a plain 24-character string instead.
 * MongoDB treats `"698b1ee4…"` and `ObjectId("698b1ee4…")` as two different
 * values, so any query that matches on the ObjectId form silently skips them.
 *
 * Measured against production on 9 Oct 2026:
 *
 *   - `GET /areas?cityId=<multan>` returned **115** areas while the unfiltered
 *     list held **132** for the same city. The 17 missing ones include the
 *     area a listing had actually been saved with — which is why opening that
 *     listing to edit it showed an empty Area dropdown and, saved again, a
 *     different location.
 *   - `GET /properties?ownerId=<agent>` returned 0 for three of four agents,
 *     so their public profile said "This agent has no active listings right
 *     now" while their listings were live on the site.
 *
 * The same class of bug is already worked around by hand in
 * `findAllApprovedImpl`, which matches `area` as "ObjectId **or** string".
 * That workaround only covers the public search; the dashboard list, the two
 * Insights aggregations (pipelines are never cast by Mongoose, so they only
 * ever see the ObjectId form) and the free-plan usage count in
 * SubscriptionService all still miss these rows. Fixing the stored type fixes
 * every one of them at once.
 *
 * ## What it changes
 *
 * The BSON type of one field per row. The value — which city, which area,
 * which owner — is byte-for-byte the same before and after, and no other
 * field is read or written. A value that is not a valid 24-hex string is
 * reported and left alone.
 *
 * Nothing in the current code writes a string into these fields, so this is a
 * one-time repair rather than a recurring job.
 *
 * ## Running it
 *
 *   npm run migrate:owner-ids --workspace=apps/api            # report only
 *   npm run migrate:owner-ids --workspace=apps/api -- --apply # write changes
 */

interface Target {
  collection: string;
  field: string;
  /** What breaks while the field is a string, for the report. */
  note: string;
}

const TARGETS: Target[] = [
  {
    collection: 'properties',
    field: 'owner',
    note: "agent profiles show no listings; Insights reads zero; the Free plan's usage count is short",
  },
  {
    collection: 'properties',
    field: 'area',
    note: 'area and city filters miss the listing',
  },
  {
    collection: 'areas',
    field: 'city',
    note: 'the area is missing from the city dropdown when adding or editing a listing',
  },
];

interface RawRow {
  _id: Types.ObjectId;
  [key: string]: unknown;
}

async function normalizeReferenceIds() {
  const apply = process.argv.includes('--apply');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db;
    if (!db) throw new Error('No database connection');

    let totalConvertible = 0;
    let totalConverted = 0;
    const plan: { target: Target; rows: RawRow[]; malformed: RawRow[] }[] = [];

    for (const target of TARGETS) {
      /*
       * Straight to the driver, deliberately.
       *
       * Mongoose casts query values to the path's declared type, so asking it
       * for `{ city: { $type: 'string' } }` through a model would be fighting
       * the very casting that hides these rows. The raw collection sees what
       * is actually stored.
       */
      const collection = db.collection(target.collection);

      const rows = (await collection
        .find({ [target.field]: { $type: 'string' } })
        .project({ _id: 1, [target.field]: 1 })
        .toArray()) as unknown as RawRow[];

      const convertible: RawRow[] = [];
      const malformed: RawRow[] = [];

      for (const row of rows) {
        const value = String(row[target.field] ?? '').trim();
        if (/^[0-9a-f]{24}$/i.test(value)) convertible.push(row);
        else malformed.push(row);
      }

      totalConvertible += convertible.length;
      plan.push({ target, rows: convertible, malformed });

      const total = await collection.countDocuments({});
      console.log(
        `\n${target.collection}.${target.field}\n` +
          `  ${total} documents, ${convertible.length} with a string value` +
          (malformed.length ? `, ${malformed.length} malformed` : ''),
      );
      if (convertible.length > 0) console.log(`  → ${target.note}`);

      for (const row of malformed.slice(0, 10)) {
        console.log(
          `  ⚠️  ${row._id.toString()} ${target.field}=${JSON.stringify(row[target.field])}`,
        );
      }
    }

    if (totalConvertible === 0) {
      console.log('\n✅ Nothing to do — every reference is already an ObjectId.');
      return;
    }

    if (!apply) {
      console.log(
        `\n🔍 Report only. ${totalConvertible} value(s) would be converted.` +
          '\n   Re-run with --apply to write the change.\n',
      );
      return;
    }

    for (const { target, rows } of plan) {
      if (rows.length === 0) continue;

      /*
       * Matched by _id, not by the string value: matching on the value would
       * re-match rows this same batch has already converted.
       */
      const operations = rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              [target.field]: new Types.ObjectId(String(row[target.field])),
            },
          },
        },
      }));

      const result = await db
        .collection(target.collection)
        .bulkWrite(operations, { ordered: false });

      totalConverted += result.modifiedCount;
      console.log(
        `✅ ${target.collection}.${target.field}: converted ${result.modifiedCount} of ${rows.length}`,
      );
    }

    console.log(`\n✅ ${totalConverted} value(s) converted in total.`);

    for (const { target } of plan) {
      const left = await db
        .collection(target.collection)
        .countDocuments({ [target.field]: { $type: 'string' } });
      if (left > 0) {
        console.log(
          `⚠️  ${target.collection}.${target.field}: ${left} string value(s) remain (malformed — see above).`,
        );
      }
    }

    console.log(
      '\nℹ️  The API caches list responses for 60 seconds. Give it a minute, ' +
        'or restart the API, before checking the site.\n',
    );
  } catch (error) {
    console.error('❌ Could not normalise reference ids:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void normalizeReferenceIds();
