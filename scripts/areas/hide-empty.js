/*
 * Areas clean-up 3 — hides every area that has never had a listing.
 *
 *   node scripts/areas/hide-empty.js            # dry run: counts per city
 *   node scripts/areas/hide-empty.js --apply    # backs up, then hides
 *   node scripts/areas/hide-empty.js --restore scripts/areas/backup-hide-<time>.json --yes
 *
 * Hidden, not deleted: a hidden area is left out of every picker, the
 * sitemap and the area lists, and its public page answers 404 while it has
 * no listings. The first listing posted in it (an agent picking or typing
 * it) brings it back by itself. --restore undoes the whole run.
 *
 * Kept: areas with any listing (any status), areas with SEO text written by
 * the admin, areas a society map points at, merged duplicates (they already
 * redirect).
 *
 * Reads MONGODB_URI from the environment or apps/api/.env and never prints it.
 */
const fs = require('fs');
const path = require('path');
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
const TAG = 'no-listings-2026-10';

function env(name) {
  if (process.env[name]) return process.env[name];
  const file = path.join(ROOT, 'apps', 'api', '.env');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

(async () => {
  const uri = env('MONGODB_URI');
  if (!uri) throw new Error('MONGODB_URI not found (environment or apps/api/.env)');
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const Areas = db.collection('areas');

  if (RESTORE) {
    const backup = JSON.parse(fs.readFileSync(RESTORE, 'utf8'));
    if (!argv.includes('--yes')) {
      console.log(`Would show ${backup.ids.length} areas again (from ${RESTORE}). Add --yes to do it.`);
    } else {
      const r = await Areas.updateMany(
        { _id: { $in: backup.ids.map((i) => new ObjectId(i)) }, hiddenReason: TAG },
        { $unset: { hidden: '', hiddenReason: '' } },
      );
      console.log(`Shown again: ${r.modifiedCount}`);
    }
    await client.close();
    return;
  }

  const [areas, counts, maps, cities] = await Promise.all([
    Areas.find(
      { mergedInto: { $in: [null] }, hidden: { $ne: true } },
      { projection: { name: 1, city: 1, metaTitle: 1, metaDescription: 1, description: 1, saleContent: 1, rentContent: 1, saleMetaTitle: 1, rentMetaTitle: 1 } },
    ).toArray(),
    db.collection('properties').aggregate([{ $match: { area: { $nin: [null, ''] } } }, { $group: { _id: { $toString: '$area' }, n: { $sum: 1 } } }]).toArray(),
    db.collection('societymaps').find({}, { projection: { area: 1 } }).toArray(),
    db.collection('cities').find({}, { projection: { name: 1 } }).toArray(),
  ]);
  const used = new Set(counts.map((c) => String(c._id)));
  const mapped = new Set(maps.map((m) => (m.area ? String(m.area) : '')).filter(Boolean));
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const seo = (a) => [a.metaTitle, a.metaDescription, a.description, a.saleContent, a.rentContent, a.saleMetaTitle, a.rentMetaTitle].some((v) => v && String(v).trim());

  const hide = areas.filter((a) => !used.has(String(a._id)) && !mapped.has(String(a._id)) && !seo(a));
  const perCity = {};
  for (const a of hide) perCity[cityName.get(String(a.city)) || '?'] = (perCity[cityName.get(String(a.city)) || '?'] || 0) + 1;
  console.log(`Active areas: ${areas.length}. To hide (never had a listing): ${hide.length}. Left: ${areas.length - hide.length}.`);
  console.log(Object.entries(perCity).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · '));

  if (!APPLY) {
    console.log('Dry run — nothing changed. Run with --apply to hide them (a backup is written first).');
    await client.close();
    return;
  }
  const file = path.join(__dirname, `backup-hide-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), tag: TAG, ids: hide.map((a) => String(a._id)) }));
  console.log(`Backup written: ${path.relative(ROOT, file)}`);
  const r = await Areas.updateMany(
    { _id: { $in: hide.map((a) => a._id) }, hidden: { $ne: true } },
    { $set: { hidden: true, hiddenReason: TAG, updatedAt: new Date() } },
  );
  console.log(`Hidden: ${r.modifiedCount}`);
  await client.close();
  console.log('Restart the API (pm2 restart all) or wait an hour for the cached area lists to refresh.');
})().catch((e) => {
  console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>'));
  process.exit(1);
});
