/*
 * Areas clean-up, step 2 of 2 — carries out scripts/areas/plan.json on the
 * live database. Run it ON THE SERVER, from the repo root, after deploying:
 *
 *   node scripts/areas/apply-plan.js            # dry run: prints what would change
 *   node scripts/areas/apply-plan.js --apply    # backs up, then changes
 *   node scripts/areas/apply-plan.js --plan scripts/areas/plan-2.json [--apply]   # a later plan
 *
 * It reads MONGODB_URI (and REDIS_URL) from the environment or apps/api/.env
 * and never prints them.
 *
 * Safety:
 *   - Before any change it writes scripts/areas/backup-<time>.json: every
 *     area document, and the area of every listing it may move. restore with
 *     node scripts/areas/apply-plan.js --restore scripts/areas/backup-<time>.json
 *   - Nothing is deleted. No areaSlug changes, so every URL keeps working.
 *   - Centres are only written where an area has none. Names are only changed
 *     where the name is still what the plan saw and no other area in the city
 *     has the new one. New areas are only added where neither the name nor the
 *     slug exists in that city.
 *   - Duplicates: the one with the most listings is kept; the others' listings
 *     move to it (their own pages stay the same — listing URLs do not include
 *     the area), empty SEO fields of the kept area are filled from the others,
 *     and the others are marked mergedInto: their URLs keep working, show the
 *     kept area, and declare it canonical.
 */
const fs = require('fs');
const path = require('path');
// The driver comes with mongoose (a dependency of the API); fall back to it if 'mongodb' itself isn't hoisted.
let driver;
try {
  driver = require('mongodb');
} catch {
  driver = require('mongoose').mongo;
}
const { MongoClient, ObjectId } = driver;

const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const RESTORE = argv.includes('--restore') ? argv[argv.indexOf('--restore') + 1] : null;
// --plan scripts/areas/plan-2.json runs a later plan; plan.json is the default.
const PLAN = argv.includes('--plan') ? path.resolve(argv[argv.indexOf('--plan') + 1]) : path.join(__dirname, 'plan.json');

function env(name) {
  if (process.env[name]) return process.env[name];
  const file = path.join(ROOT, 'apps', 'api', '.env');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const oid = (v) => (v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null);
const anyId = (v) => [oid(v), String(v)].filter(Boolean);
// Old areas may have no stored slug; their URL is the one generated from the name.
const slugOf = (a) => a.areaSlug || String(a.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const SEO_FIELDS = ['metaTitle', 'metaDescription', 'description', 'rentMetaTitle', 'rentMetaDescription', 'rentContent', 'saleMetaTitle', 'saleMetaDescription', 'saleContent'];

async function flushCache() {
  const url = env('REDIS_URL') || 'redis://127.0.0.1:6379';
  try {
    const Redis = require('ioredis');
    // One try, a few seconds: a missing Redis must not hang the script.
    const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null, connectTimeout: 4000 });
    r.on('error', () => undefined);
    await r.connect();
    let n = 0;
    for (const tag of ['areas', 'society-maps', 'properties', 'cities']) {
      const members = await r.smembers(`pd:tag:${tag}`);
      if (members.length) n += await r.del(...members);
      await r.del(`pd:tag:${tag}`);
    }
    await r.quit();
    console.log(`Cache: cleared ${n} entries.`);
  } catch (e) {
    console.log(`Cache not cleared (${e.message}). Restart the API: pm2 restart all`);
  }
}

(async () => {
  const uri = env('MONGODB_URI');
  if (!uri) throw new Error('MONGODB_URI not found (environment or apps/api/.env)');
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const Areas = db.collection('areas');
  const Props = db.collection('properties');

  if (RESTORE) {
    const backup = JSON.parse(fs.readFileSync(RESTORE, 'utf8'));
    if (!argv.includes('--yes')) {
      console.log(`Would restore ${backup.areas.length} areas and ${backup.listings.length} listing areas from ${RESTORE}. Add --yes to do it.`);
    } else {
      const ids = backup.areas.map((a) => new ObjectId(a._id));
      // Only the fields this script changes are put back; everything else was never touched.
      const TRACKED = ['name', 'lat', 'lng', 'hidden', 'mergedInto', 'mergedIntoSlug', ...SEO_FIELDS];
      for (const a of backup.areas) {
        const $set = {};
        const $unset = {};
        for (const f of TRACKED) {
          if (a[f] === undefined || a[f] === null) $unset[f] = '';
          else $set[f] = f === 'mergedInto' ? new ObjectId(a[f]) : a[f];
        }
        await Areas.updateOne({ _id: new ObjectId(a._id) }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
      }
      // Areas the plan added are removed again.
      const added = await Areas.deleteMany({ _id: { $nin: ids }, source: { $in: ['osm', 'checklist'] } });
      for (const l of backup.listings) await Props.updateOne({ _id: new ObjectId(l._id) }, { $set: { area: l.areaIsObjectId ? new ObjectId(l.area) : l.area } });
      console.log(`Restored. Removed ${added.deletedCount} added areas.`);
      await flushCache();
    }
    await client.close();
    return;
  }

  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  console.log(`Plan: ${path.relative(ROOT, PLAN)}`);
  for (const c of plan.cities) for (const k of ['coords', 'rename', 'hide', 'merge', 'add']) c[k] = c[k] || [];
  const all = await Areas.find({}).toArray();
  const byId = new Map(all.map((a) => [String(a._id), a]));
  const totals = { coords: 0, rename: 0, hide: 0, merged: 0, moved: 0, added: 0, skipped: 0 };

  // ── Backup first ──
  const mergeIds = plan.cities.flatMap((c) => c.merge.flatMap((m) => m.ids));
  const listings = mergeIds.length
    ? await Props.find({ area: { $in: mergeIds.flatMap(anyId) } }, { projection: { area: 1 } }).toArray()
    : [];
  if (APPLY) {
    const file = path.join(__dirname, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({
        at: new Date().toISOString(),
        areas: all.map((a) => ({ ...a, _id: String(a._id), city: a.city ? String(a.city) : a.city, __cityWasObjectId: a.city instanceof ObjectId, mergedInto: a.mergedInto ? String(a.mergedInto) : undefined })),
        listings: listings.map((l) => ({ _id: String(l._id), area: String(l.area), areaIsObjectId: l.area instanceof ObjectId })),
      }),
    );
    console.log(`Backup written: ${path.relative(ROOT, file)} (${all.length} areas, ${listings.length} listings)`);
  }

  const now = new Date();
  for (const c of plan.cities) {
    const cityAreas = all.filter((a) => String(a.city) === c.cityId);
    const names = new Set(cityAreas.map((a) => String(a.name).toLowerCase()));
    const slugs = new Set(cityAreas.map((a) => a.areaSlug));
    const log = [];

    for (const x of c.coords) {
      const a = byId.get(x.id);
      if (!a || Number.isFinite(a.lat)) continue;
      totals.coords++;
      if (APPLY) await Areas.updateOne({ _id: a._id }, { $set: { lat: x.lat, lng: x.lng } });
    }
    for (const x of c.rename) {
      const a = byId.get(x.id);
      if (!a || String(a.name) !== x.from || names.has(x.to)) { totals.skipped++; continue; }
      totals.rename++;
      names.add(x.to);
      if (APPLY) await Areas.updateOne({ _id: a._id }, { $set: { name: x.to, updatedAt: now } });
    }
    for (const x of c.hide) {
      const a = byId.get(x.id);
      if (!a || a.hidden) continue;
      totals.hide++;
      if (APPLY) await Areas.updateOne({ _id: a._id }, { $set: { hidden: true } });
    }
    for (const m of c.merge) {
      const group = m.ids.map((id) => byId.get(id)).filter((a) => a && !a.mergedInto);
      if (group.length < 2) continue;
      // The planned keeper is gone (merged or deleted since): leave this group alone rather than guess.
      if (m.keep && !group.some((a) => String(a._id) === m.keep)) { totals.skipped++; continue; }
      const counts = await Promise.all(group.map((a) => Props.countDocuments({ area: { $in: anyId(a._id) } })));
      const suffix = new RegExp(`-${c.citySlug}$`);
      // m.keep names the area to keep (the clean, correctly spelt one); otherwise the one with most listings.
      const order = group
        .map((a, i) => ({ a, n: counts[i] }))
        .sort((x, y) => Number(String(y.a._id) === m.keep) - Number(String(x.a._id) === m.keep) || y.n - x.n || Number(suffix.test(slugOf(x.a))) - Number(suffix.test(slugOf(y.a))) || slugOf(x.a).length - slugOf(y.a).length);
      const keep = order[0].a;
      const fill = {};
      for (const { a } of order.slice(1)) for (const f of SEO_FIELDS) if (!keep[f] && !fill[f] && a[f]) fill[f] = a[f];
      log.push(`  keep ${slugOf(keep)} (${order[0].n})  ←  ${order.slice(1).map((o) => `${slugOf(o.a)} (${o.n})`).join(', ')}`);
      totals.merged += order.length - 1;
      totals.moved += order.slice(1).reduce((s, o) => s + o.n, 0);
      if (APPLY) {
        if (Object.keys(fill).length) await Areas.updateOne({ _id: keep._id }, { $set: fill });
        for (const { a } of order.slice(1)) {
          await Props.updateMany({ area: { $in: anyId(a._id) } }, { $set: { area: keep._id } });
          // Areas merged into this one by an earlier plan follow it to the kept area.
          await Areas.updateMany({ mergedInto: { $in: anyId(a._id) } }, { $set: { mergedInto: keep._id, mergedIntoSlug: slugOf(keep), updatedAt: now } });
          await Areas.updateOne({ _id: a._id }, { $set: { mergedInto: keep._id, mergedIntoSlug: slugOf(keep), updatedAt: now } });
        }
      }
    }
    const cityId = oid(c.cityId);
    for (const x of c.add) {
      if (names.has(x.name) || slugs.has(x.slug)) { totals.skipped++; continue; }
      names.add(x.name);
      slugs.add(x.slug);
      totals.added++;
      if (APPLY) {
        await Areas.insertOne({
          name: x.name,
          areaSlug: x.slug,
          city: cityId,
          lat: x.lat,
          lng: x.lng,
          source: x.how.includes('checklist') ? 'checklist' : 'osm',
          sourceId: x.sourceId || '',
          sizeContents: [],
          createdAt: now,
          updatedAt: now,
        }).catch((e) => { totals.added--; totals.skipped++; if (e.code !== 11000) throw e; });
      }
    }
    if (log.length) console.log(`${c.city}: merges\n${log.join('\n')}`);
  }

  console.log(`\n${APPLY ? 'Applied' : 'Dry run — nothing changed'}:`, totals);
  if (APPLY) await flushCache();
  else console.log('Run again with --apply to make these changes (a backup is written first).');
  await client.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
