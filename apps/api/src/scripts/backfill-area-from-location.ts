import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../app.module';

/**
 * Sets each listing's `area` from the area named in its own address.
 *
 * ## Why
 *
 * Every listing's `location` already spells out where it is — "AlRazaq Block,
 * Sahiwal", "Wapda Town Phase 1, Multan" — and the areas collection holds the
 * same names. Tying the two together makes the stored `area` match what the
 * address says, so the edit form, the area landing pages and the city filters
 * all agree with the text a visitor reads on the listing.
 *
 * ## How it decides, and how it refuses
 *
 * Matching is on normalised text: lowercased, punctuation flattened to spaces,
 * and the area name has to appear as whole words — so "DHA" never matches
 * inside "dhaba", and "Block A" never matches "Block AB".
 *
 * The longest match wins, because it is the most specific: an address holding
 * "punjab small society nagana chowk" should land on that area and not on a
 * shorter "nagana chowk" that is also in the list. When two different areas
 * tie on length, the one whose city is also named in the address wins; if
 * that still does not separate them, the listing is reported as ambiguous and
 * left alone.
 *
 * It only ever writes in two cases:
 *
 *   1. the listing has no area at all, or
 *   2. the area it has is **not named anywhere** in its address, and exactly
 *      one area is.
 *
 * If the listing's current area does appear in its address, it is left alone
 * even when a longer name also matches. Moving a listing between areas moves
 * which area page it ranks on, and that is not a thing to do on a hunch.
 *
 * ## Running it
 *
 *   node dist/apps/api/src/scripts/backfill-area-from-location.js            # report
 *   node dist/apps/api/src/scripts/backfill-area-from-location.js --apply    # write
 *
 * The report lists every change it would make. Read it before applying — this
 * is the one script here that changes which page a listing belongs to.
 */

interface AreaRow {
  _id: Types.ObjectId;
  name?: string;
  city?: unknown;
}

interface PropertyRow {
  _id: Types.ObjectId;
  title?: string;
  location?: string;
  area?: unknown;
  status?: string;
}

/**
 * Roman numerals, because addresses and area names disagree about them.
 *
 * "New City Phase II" in an address and "New City Phase 2" in the areas list
 * are the same place, and without this they do not match — which made the
 * matcher believe the listing's area was wrong and offer to move it somewhere
 * worse. Only ii–x are mapped: a bare "i" is far more often a word.
 */
const ROMAN: Record<string, string> = {
  ii: '2', iii: '3', iv: '4', v: '5',
  vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
};

/** Lowercase, punctuation to spaces, single-spaced, padded for word matching. */
function normalise(value: unknown): string {
  const words = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => ROMAN[word] ?? word);

  return ` ${words.join(' ')} `;
}

/** Two words or more, and long enough to be a place rather than a noun. */
function isSpecific(needle: string): boolean {
  return needle.includes(' ') && needle.length >= 8;
}

async function backfillAreas() {
  const apply = process.argv.includes('--apply');
  /*
   * Filling a blank area can only improve a listing. Moving one between areas
   * changes which area page it ranks on, so it never happens by accident —
   * read the "would be corrected" list first, then opt in.
   */
  const fixMismatched = process.argv.includes('--fix-mismatched');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db;
    if (!db) throw new Error('No database connection');

    const areaRows = (await db
      .collection('areas')
      .find({})
      .project({ _id: 1, name: 1, city: 1 })
      .toArray()) as unknown as AreaRow[];

    const cityRows = await db
      .collection('cities')
      .find({})
      .project({ _id: 1, name: 1 })
      .toArray();

    const cityNameById = new Map<string, string>();
    for (const row of cityRows) {
      cityNameById.set(String(row._id), String(row.name ?? ''));
    }

    /*
     * Two-character names would match half the collection. Three is still
     * short but covers real ones like "G 9" once normalised.
     */
    const areas = areaRows
      .map((row) => ({
        id: row._id,
        name: String(row.name ?? ''),
        needle: normalise(row.name).trim(),
        cityName: cityNameById.get(String(row.city)) ?? '',
      }))
      .filter((row) => row.needle.length >= 3);

    const areaNameById = new Map<string, string>();
    for (const row of areas) areaNameById.set(String(row.id), row.name);

    const properties = (await db
      .collection('properties')
      .find({})
      .project({ _id: 1, title: 1, location: 1, area: 1, status: 1 })
      .toArray()) as unknown as PropertyRow[];

    console.log(
      `\n${properties.length} listings, ${areas.length} usable area names.\n`,
    );

    const fills: { row: PropertyRow; area: (typeof areas)[number] }[] = [];
    const moves: {
      row: PropertyRow;
      from: string;
      area: (typeof areas)[number];
    }[] = [];
    const ambiguous: { row: PropertyRow; names: string[] }[] = [];
    let keptCorrect = 0;
    let noMatch = 0;

    for (const row of properties) {
      const haystack = `${normalise(row.location)}${normalise(row.title)}`;

      const matches = areas.filter((area) =>
        haystack.includes(` ${area.needle} `),
      );

      if (matches.length === 0) {
        noMatch++;
        continue;
      }

      // Longest first; then the one whose city is also named in the address.
      const longest = Math.max(...matches.map((m) => m.needle.length));
      let best = matches.filter((m) => m.needle.length === longest);

      if (best.length > 1) {
        const withCity = best.filter(
          (m) => m.cityName && haystack.includes(normalise(m.cityName)),
        );
        if (withCity.length > 0) best = withCity;
      }

      const uniqueIds = new Set(best.map((m) => String(m.id)));
      if (uniqueIds.size > 1) {
        ambiguous.push({ row, names: best.map((m) => m.name) });
        continue;
      }

      const chosen = best[0];
      if (!chosen) {
        noMatch++;
        continue;
      }

      const currentId = row.area ? String(row.area) : '';

      if (!currentId) {
        fills.push({ row, area: chosen });
        continue;
      }

      if (currentId === String(chosen.id)) {
        keptCorrect++;
        continue;
      }

      /*
       * It already points somewhere else. Only move it when that somewhere
       * else is not in the address at all — otherwise both readings are
       * defensible and the stored one wins.
       */
      const currentName = areaNameById.get(currentId);
      const currentIsNamed =
        currentName && haystack.includes(` ${normalise(currentName).trim()} `);

      if (currentIsNamed) {
        keptCorrect++;
      } else if (isSpecific(chosen.needle)) {
        /*
         * Only a specific, multi-word name may displace an area that is
         * already set. Run against production this rule earned its keep
         * immediately: two of the three moves it would otherwise have made
         * were wrong, both of them an address reading "New City Phase II"
         * being dragged onto an area literally named "city" because the
         * Roman numeral stopped the real one matching. The numerals are
         * handled above now, and single-word names can no longer move
         * anything.
         */
        moves.push({
          row,
          from: currentName ?? `(unknown area ${currentId})`,
          area: chosen,
        });
      } else {
        keptCorrect++;
      }
    }

    console.log(`  already correct .......... ${keptCorrect}`);
    console.log(`  empty, would be filled ... ${fills.length}`);
    console.log(`  would be corrected ....... ${moves.length}`);
    console.log(`  ambiguous, left alone .... ${ambiguous.length}`);
    console.log(`  no area name in address .. ${noMatch}\n`);

    if (fills.length > 0) {
      console.log('--- empty, would be filled ---');
      for (const item of fills.slice(0, 40)) {
        console.log(`  ${item.area.name}  ←  ${String(item.row.location ?? '').slice(0, 64)}`);
      }
      if (fills.length > 40) console.log(`  … and ${fills.length - 40} more`);
      console.log('');
    }

    if (moves.length > 0) {
      console.log('--- would be corrected (read these) ---');
      for (const item of moves.slice(0, 60)) {
        console.log(
          `  ${item.from}  →  ${item.area.name}\n      ${String(item.row.location ?? '').slice(0, 72)}`,
        );
      }
      if (moves.length > 60) console.log(`  … and ${moves.length - 60} more`);
      console.log('');
    }

    if (ambiguous.length > 0) {
      console.log('--- ambiguous, nothing done ---');
      for (const item of ambiguous.slice(0, 20)) {
        console.log(
          `  ${item.names.join(' / ')}\n      ${String(item.row.location ?? '').slice(0, 72)}`,
        );
      }
      console.log('');
    }

    const writes = fixMismatched ? [...fills, ...moves] : [...fills];

    if (moves.length > 0 && !fixMismatched) {
      console.log(
        `ℹ️  ${moves.length} listing(s) above point at an area their address does not mention.\n` +
          '   They are NOT touched by a normal run. If the list looks right,\n' +
          '   add --fix-mismatched to move them too.\n',
      );
    }

    if (writes.length === 0) {
      console.log('✅ Nothing to change.\n');
      return;
    }

    if (!apply) {
      console.log(
        `🔍 Report only. ${writes.length} listing(s) would be changed.` +
          '\n   Re-run with --apply once the list above looks right.\n',
      );
      return;
    }

    const operations = writes.map((item) => ({
      updateOne: {
        filter: { _id: item.row._id },
        // A real ObjectId, not a string: the rest of the codebase queries this
        // field by ObjectId, and a string is invisible to those queries.
        update: { $set: { area: new Types.ObjectId(item.area.id) } },
      },
    }));

    const result = await db
      .collection('properties')
      .bulkWrite(operations, { ordered: false });

    console.log(`\n✅ Updated ${result.modifiedCount} of ${writes.length} listing(s).`);
    console.log(
      'ℹ️  Lists are cached for 60 seconds — give it a minute, or restart the API.\n',
    );
  } catch (error) {
    console.error('❌ Could not backfill areas:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void backfillAreas();
