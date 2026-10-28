import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { SocietyService } from '../area/society.service';
import { MediaService } from '../media/media.service';
import { Media, MediaDocument } from '@rent-ghar/db/schemas/media.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';

/**
 * Societies from data/societies/*.json onto the live site — run on the
 * server, where the uploads folder is:
 *
 *   npm run society:setup:prod --workspace=apps/api                          (dry run, every city)
 *   npm run society:setup:prod --workspace=apps/api -- --city lahore --apply
 *   npm run society:setup:prod --workspace=apps/api -- --only bahria-town --apply
 *
 * One file per society:
 *   { city, slug,              the city and the existing area that becomes the society
 *     existing: [slugs],       areas already on the site that become its phases
 *     add: [names],            phases/blocks the site does not have yet
 *     photos: [{url,name,alt}],from the society's own site; the first is the cover
 *     context, guide }         the guide shown on /societies/<city>/<slug>
 *
 * Through the same services as Dashboard → Societies. Existing areas keep
 * their URLs and listings; a block the site already has under a slightly
 * different name ("Bahria Town Sector C Lahore") is used, not duplicated.
 * Safe to run again. The maps are separate: data/society-maps, imported when
 * the API starts.
 */

interface Society {
  city: string;
  slug: string;
  existing?: string[];
  add?: string[];
  photos?: { url: string; name: string; alt: string }[];
  context?: string;
  guide: Record<string, unknown>;
}

function repoRoot() {
  const cwd = process.cwd();
  return cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api') ? path.join(cwd, '..', '..') : cwd;
}

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** Phase order: "Phase 2" before "Phase 10", "Block A" before "Block B", then names. */
function rankName(name: string) {
  const n = name.toLowerCase();
  const num = /\b(?:phase|sector|precinct)\s*(\d+)/.exec(n);
  const letter = /\b(?:block|sector)\s*([a-z])\b/.exec(n);
  if (num) return `0${num[1]!.padStart(4, '0')}${n}`;
  if (letter) return `1${letter[1]}${n}`;
  return `2${n}`;
}

async function run() {
  const apply = process.argv.includes('--apply');
  const onlyCity = arg('--city')?.toLowerCase();
  const only = arg('--only')?.split(',').map((s) => s.trim().toLowerCase());
  const dir = path.join(repoRoot(), 'data', 'societies');
  const all: Society[] = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const list = all.filter((s) => (!onlyCity || s.city === onlyCity) && (!only || only.includes(s.slug)));
  if (!list.length) throw new Error('No society files match');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const societies = app.get(SocietyService);
    const media = app.get(MediaService);
    const mediaModel = app.get<Model<MediaDocument>>(getModelToken(Media.name));
    const userModel = app.get<Model<any>>(getModelToken(User.name));
    const db = mediaModel.db;

    console.log(apply ? '✍️  APPLY — writing to this database and this server.' : '🔍 DRY RUN — nothing is written. Add -- --apply to do it.');
    const cities = await db.collection('cities').find({}, { projection: { name: 1 } }).toArray();
    const admin: any = await userModel.findOne({ role: 'ADMIN' }).select('_id').lean();
    if (!admin) throw new Error('No ADMIN user — the photos need an owner in the media library');

    // "Citi" and "City" are both used; "Bahria Town Sector C Lahore" is still Sector C.
    const loose = (t: string) => t.toLowerCase().replace(/\bciti\b/g, 'city').replace(/[^a-z0-9]+/g, '');
    const sameArea = (areaName: string, want: string) => {
      const a = loose(areaName);
      const b = loose(want);
      return a === b || (a.startsWith(b) && !/^[a-z0-9]/.test(a.slice(b.length).replace(/^(lahore|multan|karachi|islamabad|rawalpindi|faisalabad)/, '')));
    };

    for (const s of list) {
      console.log(`\n── ${s.context ?? s.slug} (${s.city}) ──`);
      const city: any = cities.find((c: any) => String(c.name).trim().toLowerCase() === s.city);
      if (!city) {
        console.log(`  ⚠️  ${s.city} is not a city on this site — skipped`);
        continue;
      }
      const inCity = await db
        .collection('areas')
        .find({ city: { $in: [city._id, String(city._id)] } }, { projection: { name: 1, areaSlug: 1, kind: 1, parent: 1, mergedInto: 1 } })
        .toArray();
      const bySlug = new Map(inCity.map((a: any) => [a.areaSlug, a]));
      const society: any = bySlug.get(s.slug);
      if (!society) {
        console.log(`  ⚠️  No "${s.slug}" area in ${s.city} — skipped`);
        continue;
      }
      if (society.kind === 'phase') {
        console.log(`  ⚠️  ${society.name} is a phase of another society — skipped`);
        continue;
      }
      console.log(`  Society: ${society.name} (${society._id}) — now: ${society.kind ?? 'area'}`);

      const existing = (s.existing ?? []).map((x) => bySlug.get(x)).filter((a: any) => a && !a.mergedInto) as any[];
      const missing = (s.existing ?? []).filter((x) => !bySlug.has(x));
      for (const n of s.add ?? []) {
        for (const a of inCity) if (!a.mergedInto && sameArea(String(a.name), n) && !existing.some((e) => String(e._id) === String(a._id))) existing.push(a);
      }
      const usable = existing.filter((a) => String(a._id) !== String(society._id) && a.kind !== 'society' && (!a.parent || String(a.parent) === String(society._id)));
      for (const a of existing.filter((x) => !usable.includes(x) && String(x._id) !== String(society._id))) console.log(`  ⚠️  ${a.name} belongs to another society — left out`);
      console.log(`  Existing areas to make phases: ${usable.length}${missing.length ? ` (not found, skipped: ${missing.join(', ')})` : ''}`);
      const toAdd = (s.add ?? []).filter((n) => !inCity.some((a: any) => sameArea(String(a.name), n)));
      console.log(`  New phases to add: ${toAdd.length ? toAdd.join(', ') : 'none'}`);

      const urls: string[] = [];
      for (const p of s.photos ?? []) {
        const had: any = await mediaModel.findOne({ originalName: p.name, folder: 'areas' }).select('url').lean();
        if (had?.url) {
          console.log(`  photo ${p.name}: already in the library`);
          urls.push(had.url);
          continue;
        }
        if (!apply) {
          console.log(`  photo ${p.name}: would fetch ${p.url}`);
          continue;
        }
        try {
          const res = await fetch(p.url, { signal: AbortSignal.timeout(60_000) });
          if (!res.ok) throw new Error(String(res.status));
          const buffer = Buffer.from(await res.arrayBuffer());
          const mimetype = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
          const doc = await media.uploadOne(
            { buffer, size: buffer.length, mimetype, originalname: p.name } as Express.Multer.File,
            { folder: 'areas', context: s.context ?? s.slug, ai: 'off' },
            String(admin._id),
          );
          await mediaModel.updateOne({ _id: doc._id }, { $set: { alt: p.alt, title: p.alt } });
          console.log(`  photo ${p.name}: saved ${doc.url}`);
          urls.push(doc.url);
        } catch (e: any) {
          console.log(`  photo ${p.name}: could not fetch (${e?.message}) — skipped`);
        }
      }
      if (!apply) continue;

      for (const name of toAdd) {
        await societies.addPhase(String(society._id), name);
        console.log(`  added ${name}`);
      }
      const now = await societies.adminGet(String(society._id));
      const ids = [...usable.map((a) => String(a._id)), ...now.phases.map((p: any) => p._id).filter((id: string) => !usable.some((a) => String(a._id) === id))];
      const kept = new Map(now.phases.map((p: any) => [p._id, p]));
      const names = new Map<string, string>([...inCity.map((a: any) => [String(a._id), String(a.name)] as [string, string]), ...now.phases.map((p: any) => [p._id, String(p.name)] as [string, string])]);
      ids.sort((a, b) => rankName(names.get(a) ?? '').localeCompare(rankName(names.get(b) ?? '')));
      const old = now.guide ?? {};
      await societies.save(String(society._id), {
        kind: 'society',
        guide: { ...s.guide, image: urls[0] ?? old.image ?? '', gallery: urls.length ? urls.slice(1) : old.gallery ?? [] },
        phases: ids.map((id) => {
          const p: any = kept.get(id);
          return { id, image: p?.image ?? '', tagline: p?.tagline ?? '', overview: p?.overview ?? '' };
        }),
      });
      console.log(`  ✅ ${s.context ?? s.slug} is a society with ${ids.length} phases and ${urls.length} photos — /societies/${s.city}/${s.slug}`);
    }
    if (!apply) console.log('\nNothing written. Run again with -- --apply.');
  } finally {
    await app.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
