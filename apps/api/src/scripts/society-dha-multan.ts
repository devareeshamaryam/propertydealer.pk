import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { SocietyService } from '../area/society.service';
import { MediaService } from '../media/media.service';
import { Media, MediaDocument } from '@rent-ghar/db/schemas/media.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';

/**
 * DHA Multan as a society, on the live site — run on the server, where the
 * uploads folder is:
 *
 *   npm run society:dha-multan --workspace=apps/api                (dry run)
 *   npm run society:dha-multan --workspace=apps/api -- --apply
 *   (after a build: npm run society:dha-multan:prod --workspace=apps/api -- --apply)
 *
 * What it does, through the same services as Dashboard → Societies:
 *   - the existing "dha multan" area becomes a society with a published guide;
 *   - the existing DHA sectors, villas and Phase 1 areas of Multan become its
 *     phases (their URLs and listings are untouched);
 *   - the sectors the site does not have yet are added as new phases;
 *   - the photos are fetched from dhamultan.org, made WebP (with thumbnails)
 *     and saved on this server's disk and in the media library.
 *
 * Safe to run again: an image already in the library is reused, and an area
 * that already exists is never duplicated.
 */

const CITY = 'multan';
const SOCIETY_SLUG = 'dha-multan';

/** Areas already on the site (by their address), in the order shown. */
const EXISTING_PHASES = [
  'dha-phase-1',
  'dha-sector-a',
  'dha-phase-1-sector-d-multan',
  'dha-phase-1-sector-h-multan',
  'dha-sector-h-multan',
  'dha-phase-1-sector-m-multan',
  'dha-phase-1-sector-n',
  'dha-phase-1-sector-r',
  'dha-phase-1-sector-t',
  'dha-phase-1-sector-u-multan',
  'dha-phase-1-sector-u-block-1-multan',
  'dha-phase-1-sector-v-multan',
  'dha-phase-1-sector-v-block-1-multan',
  'dha-phase-1-sector-w2-multan',
  'dha-villas-multan',
];

/** Sectors and parts of DHA Multan the site does not have yet. */
const NEW_PHASES = [
  'DHA Phase 1 - Sector B1',
  'DHA Phase 1 - Sector E',
  'DHA Phase 1 - Sector I',
  'DHA Phase 1 - Sector L',
  'DHA Phase 1 - Sector Q',
  'DHA Phase 1 - Sector S',
  'DHA Phase 1 - Sector Y',
  'Rumanza Golf Community',
  'DHA Southern Business District',
];

/** Photos from the official site (dhamultan.org). The first is the cover. */
const PHOTOS = [
  { url: 'https://www.dhamultan.org/assets/Images/1.jpg', name: 'dha-multan-the-arena.jpg', alt: 'The Arena, DHA Multan' },
  { url: 'https://www.dhamultan.org/18.webp', name: 'dha-multan-development-2026.webp', alt: 'DHA Multan development — roads, homes and commercial areas' },
  { url: 'https://www.dhamultan.org/assets/Images/2.jpg', name: 'dha-multan-mosque.jpg', alt: 'Mosque in DHA Multan at night' },
  { url: 'https://www.dhamultan.org/assets/Images/3.jpg', name: 'dha-multan-building.jpg', alt: 'DHA Multan building and lawns' },
  { url: 'https://www.dhamultan.org/assets/Images/5.png', name: 'dha-multan-aerial-night.png', alt: 'Aerial view of DHA Multan at night' },
];

const GUIDE = {
  published: true,
  tagline: "Defence Housing Authority's gated city between Bosan Road and Mattital Road, Multan",
  developer: 'Defence Housing Authority (DHA) Multan',
  approval: 'approved',
  totalArea: 'About 9,000 acres',
  launched: 'Phase 1 announced in 2014',
  possession: 'Given in Sectors A, H, M, N, Q, R, U, the Villas and Rumanza; other sectors under development',
  plotSizes: '5, 8 and 10 marla, 1 and 2 kanal residential; 4 and 8 marla commercial; villas of 6, 9 and 12 marla',
  address: 'Between Bosan Road and Mattital Road, near Bahauddin Zakariya University (BZU), Multan',
  nearby: ['Bahauddin Zakariya University (BZU)', 'Bosan Road', 'Mattital Road', 'Multan Public School (MPS) Road'],
  amenities: [
    'Gated community with security',
    'Rumanza signature golf course by Sir Nick Faldo',
    'Rumanza club house with swimming pools and gym',
    'Pearl-Continental golf resort',
    'The Arena',
    'Mosques',
    'Parks and green belts',
    'DHA Villas gated community',
    'Shopping arcade and food court',
    'Southern Business District',
    'Mango Museum in Sector A',
    'Wide boulevards',
  ],
  phone: '061-111-111-189',
  website: 'https://www.dhamultan.org',
  overview: `<p><strong>DHA Multan</strong> is the Defence Housing Authority's planned city in Multan, spread over about 9,000 acres between Bosan Road and Mattital Road, near Bahauddin Zakariya University. It is the largest gated community of South Punjab, with wide boulevards, its own security and sectors laid out for houses, villas and commercial plots.</p>
<h2>Sectors and possession</h2>
<p>Phase 1 is divided into lettered sectors. Possession has been given in Sectors A, H, M, N, Q, R and U, in the DHA Villas and in the Rumanza Golf Community, and more sectors such as I, V and B1 are being completed. Sector A, on about 236 acres, offers 1 and 2 kanal plots and is home to the Mango Museum.</p>
<h2>Plot sizes</h2>
<p>Residential plots come in 5, 8 and 10 marla and 1 and 2 kanal; commercial plots of 4 and 8 marla are in the Southern Business District on the MPS Road side. The DHA Villas are 556 ready houses of 6, 9 and 12 marla with 3 to 5 bedrooms.</p>
<h2>Rumanza Golf Community</h2>
<p>Rumanza is built around Pakistan's first signature golf course, designed by Sir Nick Faldo, with a club house, swimming pools, a gym and a Pearl-Continental golf resort. Its plots are 12 marla, 1 kanal and 2 kanal.</p>
<h2>Buying in DHA Multan</h2>
<p>Every plot and house is a DHA file: check its sector, size and dues, and transfer it through the DHA office. Browse the houses and plots for sale and rent in each sector below, and call or WhatsApp the dealer directly.</p>`,
  faqs: [
    { q: 'Where is DHA Multan?', a: 'DHA Multan lies between Bosan Road and Mattital Road, near Bahauddin Zakariya University (BZU), on the north-west side of Multan.' },
    { q: 'How big is DHA Multan?', a: 'DHA Multan is planned on about 9,000 acres. Phase 1 is divided into lettered sectors, and the Rumanza Golf Community, DHA Villas and the Southern Business District sit within it.' },
    { q: 'Which sectors of DHA Multan have possession?', a: 'Possession has been given in Sectors A, H, M, N, Q, R and U, the DHA Villas and Rumanza. Sectors such as I, V and B1 are being completed — check with DHA Multan for the latest status of a sector.' },
    { q: 'What plot sizes are available in DHA Multan?', a: 'Residential plots of 5, 8 and 10 marla and 1 and 2 kanal, commercial plots of 4 and 8 marla, and ready villas of 6, 9 and 12 marla.' },
    { q: 'What is Rumanza in DHA Multan?', a: "Rumanza is DHA Multan's golf community, built around a signature golf course designed by Sir Nick Faldo, with a club house and a Pearl-Continental golf resort. Its plots are 12 marla, 1 kanal and 2 kanal." },
    { q: 'How do I contact DHA Multan?', a: 'DHA Multan is on Muhammad Ali Jinnah Avenue, Sector H. Its helpline is 061-111-111-189 and its website is dhamultan.org.' },
  ],
  metaTitle: 'DHA Multan — Sectors, Plot Sizes, Possession & Property for Sale',
  metaDescription:
    'DHA Multan guide: location between Bosan and Mattital Road, sectors with possession, plot sizes, Rumanza golf community, villas and houses and plots for sale and rent.',
};

async function run() {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const societies = app.get(SocietyService);
    const media = app.get(MediaService);
    const mediaModel = app.get<Model<MediaDocument>>(getModelToken(Media.name));
    const userModel = app.get<Model<any>>(getModelToken(User.name));
    const db = mediaModel.db;

    console.log(apply ? '✍️  APPLY — writing to this database and this server.' : '🔍 DRY RUN — nothing is written. Add -- --apply to do it.');

    const city: any = (await db.collection('cities').find({}, { projection: { name: 1 } }).toArray()).find(
      (c: any) => String(c.name).trim().toLowerCase() === CITY,
    );
    if (!city) throw new Error('Multan is not a city on this site');
    const inCity = await db.collection('areas').find({ city: { $in: [city._id, String(city._id)] } }, { projection: { name: 1, areaSlug: 1, kind: 1, parent: 1, mergedInto: 1 } }).toArray();
    const bySlug = new Map(inCity.map((a: any) => [a.areaSlug, a]));
    const society: any = bySlug.get(SOCIETY_SLUG);
    if (!society) throw new Error(`No "${SOCIETY_SLUG}" area in Multan`);
    console.log(`Society: ${society.name} (${society._id}) — now: ${society.kind ?? 'area'}`);

    const existing = EXISTING_PHASES.map((s) => bySlug.get(s)).filter(Boolean) as any[];
    const missingSlugs = EXISTING_PHASES.filter((s) => !bySlug.has(s));
    console.log(`Existing areas to make phases: ${existing.length}${missingSlugs.length ? ` (not found, skipped: ${missingSlugs.join(', ')})` : ''}`);
    for (const a of existing) {
      if (a.kind === 'society' || (a.parent && String(a.parent) !== String(society._id))) console.log(`  ⚠️  ${a.name} belongs to another society — it will be left out`);
    }
    const loose = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const toAdd = NEW_PHASES.filter((n) => !inCity.some((a: any) => loose(a.name) === loose(n)));
    console.log(`New sectors to add: ${toAdd.length ? toAdd.join(', ') : 'none'}`);

    // ── Photos ──
    const admin: any = await userModel.findOne({ role: 'ADMIN' }).select('_id').lean();
    if (!admin) throw new Error('No ADMIN user — the photos need an owner in the media library');
    const urls: string[] = [];
    for (const p of PHOTOS) {
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
      const res = await fetch(p.url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) {
        console.log(`  photo ${p.name}: could not fetch (${res.status}) — skipped`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const mimetype = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      const doc = await media.uploadOne(
        { buffer, size: buffer.length, mimetype, originalname: p.name } as Express.Multer.File,
        { folder: 'areas', context: 'DHA Multan', ai: 'off' },
        String(admin._id),
      );
      await mediaModel.updateOne({ _id: doc._id }, { $set: { alt: p.alt, title: p.alt } });
      console.log(`  photo ${p.name}: saved ${doc.url}`);
      urls.push(doc.url);
    }

    if (!apply) {
      console.log('\nNothing written. Run again with -- --apply.');
      return;
    }

    // ── New sectors, then the society with every phase in order ──
    for (const name of toAdd) {
      await societies.addPhase(String(society._id), name);
      console.log(`  added ${name}`);
    }
    const now = await societies.adminGet(String(society._id));
    const phaseIds = [
      ...existing.filter((a) => a.kind !== 'society' && (!a.parent || String(a.parent) === String(society._id))).map((a) => String(a._id)),
      ...now.phases.map((p: any) => p._id).filter((id: string) => !existing.some((a) => String(a._id) === id)),
    ];
    const kept = new Map(now.phases.map((p: any) => [p._id, p]));
    // Phase 1 first, then the sectors A, B1, D, E… (a sector's blocks after it), then villas, Rumanza and the business district.
    const names = new Map<string, string>([...inCity.map((a: any) => [String(a._id), String(a.name)] as [string, string]), ...now.phases.map((p: any) => [p._id, String(p.name)] as [string, string])]);
    const rank = (id: string) => {
      const n = (names.get(id) ?? '').toLowerCase();
      if (n === 'dha phase 1') return '0';
      const m = /sector\s*([a-z]\d?)\b(.*)$/.exec(n);
      if (m) return `1${m[1]!.padEnd(3, ' ')}${m[2]!.trim()}`;
      if (n.includes('villa')) return '2';
      if (n.includes('rumanza')) return '3';
      return `4${n}`;
    };
    phaseIds.sort((a, b) => rank(a).localeCompare(rank(b)));
    await societies.save(String(society._id), {
      kind: 'society',
      guide: { ...GUIDE, image: urls[0] ?? '', gallery: urls.slice(1) },
      phases: phaseIds.map((id) => {
        const p: any = kept.get(id);
        return { id, image: p?.image ?? '', tagline: p?.tagline ?? '', overview: p?.overview ?? '' };
      }),
    });
    console.log(`\n✅ DHA Multan is a society with ${phaseIds.length} phases and ${urls.length} photos.`);
    console.log('   Page: /societies/multan/dha-multan');
  } finally {
    await app.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
