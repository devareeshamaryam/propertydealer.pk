import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { SocietyService } from '../area/society.service';
import { MediaService } from '../media/media.service';
import { Media, MediaDocument } from '@rent-ghar/db/schemas/media.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';

/**
 * Royal Orchard and Citi Housing (Multan) as societies, on the live site — run
 * on the server, where the uploads folder is:
 *
 *   npm run society:multan --workspace=apps/api                (dry run)
 *   npm run society:multan --workspace=apps/api -- --apply
 *   (after a build: npm run society:multan:prod --workspace=apps/api -- --apply)
 *
 * The same as the DHA Multan script, through the same services as
 * Dashboard → Societies:
 *   - the existing area of each becomes a society with a published guide;
 *   - its existing block areas become its phases (URLs and listings untouched);
 *   - the blocks the site does not have yet are added as new phases;
 *   - Royal Orchard's photos are fetched from its own site (multan.royalorchard.pk),
 *     made WebP and saved on this server's disk and in the media library.
 *
 * Their maps are separate: data/society-maps/multan-royal-orchard-multan and
 * multan-city-housing-multan, imported when the API starts.
 *
 * Safe to run again: an image already in the library is reused, and an area
 * that already exists is never duplicated.
 */

const CITY = 'multan';

interface Society {
  slug: string;
  /** Areas already on the site (by their address), in the order shown. */
  existing: string[];
  /** Blocks the site does not have yet. */
  add: string[];
  photos: { url: string; name: string; alt: string }[];
  context: string;
  guide: Record<string, unknown>;
}

const RO = 'https://multan.royalorchard.pk/wp-content/uploads/sites/2/2022/11';

const SOCIETIES: Society[] = [
  {
    slug: 'royal-orchard-multan',
    existing: ['royal-orchard-royal-orchard-block-c-multan', 'royal-orchard-block-f-multan', 'royal-orchard-block-g'],
    add: ['Royal Orchard - Block A', 'Royal Orchard - Block B', 'Royal Orchard - Block D', 'Royal Orchard - Block E'],
    context: 'Royal Orchard Multan',
    photos: [
      { url: `${RO}/01.jpg`, name: 'royal-orchard-multan-main-gate.jpg', alt: 'Main gate and fountain of Royal Orchard Multan' },
      { url: `${RO}/ROSA-scaled-1.jpg`, name: 'royal-orchard-multan-boulevard.jpg', alt: 'Royal Boulevard from the gate, Royal Orchard Multan' },
      { url: `${RO}/02.jpg`, name: 'royal-orchard-multan-entrance.jpg', alt: 'Entrance of Royal Orchard Multan on Multan Public School Road' },
      { url: `${RO}/royal-orchard-multan.jpg`, name: 'royal-orchard-multan-night.jpg', alt: 'Royal Orchard Multan fountain at night' },
    ],
    guide: {
      published: true,
      tagline: 'Gated society between Multan Public School Road, Mattital Road and Shakh-e-Madina Road, Multan',
      developer: 'Habib Rafiq (Pvt.) Ltd. and Royal Developers & Builders (Pvt.) Ltd.',
      approvedBy: 'MDA',
      approval: 'approved',
      totalArea: 'About 4,000 kanal',
      launched: '',
      possession: 'Given; most blocks have houses built and lived in',
      plotSizes: '5, 10 and 12 marla, 1 and 2 kanal residential; villas of 5, 10 and 12 marla and 1 kanal; commercial 2, 4, 6, 8 and 10 marla',
      address: 'Gate 1, Multan Public School Road, Multan',
      nearby: ['Women University Multan (Mattital campus)', 'Gymkhana and Sports Complex', 'Northern Bypass', 'Bakhtawar Amin Hospital', 'Multan International Airport (about 9 minutes)'],
      amenities: [
        'Gated community with 24/7 security',
        'Royal Boulevard and Iqbal Boulevard',
        'Grand mosque by the central roundabout',
        'Hospital and clinic',
        'Theme park and community club',
        'Parks and playgrounds in every block',
        'Schools',
        'Mini golf club',
        'Cinema, shopping plazas and food courts',
        'Fire-fighting system',
      ],
      phone: '061-111-444-475',
      website: 'https://multan.royalorchard.pk',
      overview: `<p><strong>Royal Orchard Multan</strong> is a gated housing society on about 4,000 kanal, bounded by Multan Public School (MPS) Road, Mattital Road and Shakh-e-Madina Road, opposite Women University and the Gymkhana. Its main gate is on MPS Road, about nine minutes from Multan International Airport.</p>
<h2>Blocks</h2>
<p>The society is laid out in seven blocks, A to G, on either side of the Royal Boulevard that runs north from the MPS Road gate to Shakh-e-Madina Road. The boulevard meets Iqbal Boulevard and the eastern Royal Boulevard at the central roundabout, beside the grand mosque and the theme park. Blocks A, C and E are west of the boulevard; B, D, F and G are east of it, with the hospital and a park in Block F.</p>
<h2>Plot sizes</h2>
<p>Residential plots are 5, 10 and 12 marla and 1 and 2 kanal, with villas of 5, 10 and 12 marla and 1 kanal. Commercial plots of 2 to 10 marla line the boulevards.</p>
<h2>Buying in Royal Orchard</h2>
<p>Check a plot's block, size and dues with the society office at Gate 1 before you buy, and transfer it through the office. Browse the houses and plots for sale and rent in each block below, and call or WhatsApp the dealer directly.</p>`,
      faqs: [
        { q: 'Where is Royal Orchard Multan?', a: 'Royal Orchard is between Multan Public School Road, Mattital Road and Shakh-e-Madina Road, opposite Women University and the Gymkhana, with its main gate on MPS Road.' },
        { q: 'How many blocks does Royal Orchard Multan have?', a: 'Seven: Blocks A to G. A, C and E are west of the Royal Boulevard and B, D, F and G east of it.' },
        { q: 'What plot sizes are in Royal Orchard Multan?', a: 'Residential plots of 5, 10 and 12 marla and 1 and 2 kanal, villas of 5, 10 and 12 marla and 1 kanal, and commercial plots of 2, 4, 6, 8 and 10 marla.' },
        { q: 'Who developed Royal Orchard Multan?', a: 'Royal Orchard is developed by Habib Rafiq (Pvt.) Ltd. with Royal Developers & Builders (Pvt.) Ltd.' },
        { q: 'How do I contact Royal Orchard Multan?', a: 'The office is at Gate 1, Multan Public School Road. Its UAN is 061-111-444-475 and its website is multan.royalorchard.pk.' },
      ],
      metaTitle: 'Royal Orchard Multan — Blocks, Map, Plot Sizes & Property for Sale',
      metaDescription:
        'Royal Orchard Multan guide: location on MPS Road, Blocks A to G on the master plan map, plot sizes, amenities, and houses and plots for sale and rent.',
    },
  },
  {
    slug: 'city-housing-multan',
    existing: [],
    add: ['Citi Housing - Block A', 'Citi Housing - Block B', 'Citi Housing - Block C', 'Citi Housing - Block D', 'Citi Housing - Block E', 'Citi Housing - Jinnah Block'],
    context: 'Citi Housing Multan',
    // No photos: Citi Housing has no Multan pages of its own to take them from.
    photos: [],
    guide: {
      published: true,
      tagline: 'Gated society on Bosan Road at Lutfabad, north of BZU and DHA Multan',
      developer: 'Citi Housing (Pvt.) Ltd.',
      approvedBy: 'MDA',
      approval: 'approved',
      totalArea: 'Phase 1: 997 kanal, Phase 1 extension: 1,899 kanal',
      launched: '2020',
      possession: 'Given in Phase 1; houses being built',
      plotSizes: '5, 7 and 10 marla residential; 2.5, 5 and 8 marla commercial',
      address: 'Bosan Road, Mauza Lutfabad, Multan',
      nearby: ['Bahauddin Zakariya University (BZU)', 'DHA Multan and Rumanza Golf', 'Buch Villas', 'Bosan Road', 'Canal Road'],
      amenities: [
        'Gated community with CCTV and guards',
        'Wide main boulevard from Bosan Road',
        'Bagh-e-Jinnah park',
        'Parks in every block',
        'Mosques',
        'Schools and a hospital site',
        'Commercial areas',
      ],
      phone: '',
      website: '',
      overview: `<p><strong>Citi Housing Multan</strong> is a gated society on main Bosan Road at Mauza Lutfabad, north of Bahauddin Zakariya University and next to DHA Multan's Rumanza. It is approved by the Multan Development Authority: Phase 1 on 997 kanal and the Phase 1 extension on about 1,899 kanal.</p>
<h2>Layout</h2>
<p>The main boulevard enters from Bosan Road and runs west through the society, across the small canal that divides it. South of the boulevard is a long park with the community buildings; the north-western part reaches towards Canal Road and is laid out around a large central park. The blocks include A, B, C, D, E and the Jinnah Block.</p>
<h2>Plot sizes</h2>
<p>Residential plots are 5, 7 and 10 marla, and commercial plots 2.5, 5 and 8 marla. A second phase is planned on Old Shujabad Road.</p>
<h2>Buying in Citi Housing</h2>
<p>Check a plot's block, size and dues with the society office before you buy. Browse the houses and plots for sale and rent below, and call or WhatsApp the dealer directly.</p>`,
      faqs: [
        { q: 'Where is Citi Housing Multan?', a: 'Citi Housing Multan Phase 1 is on main Bosan Road at Mauza Lutfabad, north of Bahauddin Zakariya University and next to DHA Multan.' },
        { q: 'Is Citi Housing Multan approved?', a: 'Yes. Phase 1 (997 kanal) and the Phase 1 extension (about 1,899 kanal) are approved by the Multan Development Authority (MDA).' },
        { q: 'What plot sizes are in Citi Housing Multan?', a: 'Residential plots of 5, 7 and 10 marla, and commercial plots of 2.5, 5 and 8 marla.' },
        { q: 'Which blocks are in Citi Housing Multan?', a: 'Phase 1 has Blocks A, B, C, D and E and the Jinnah Block. Phase 2 is planned on Old Shujabad Road.' },
      ],
      metaTitle: 'Citi Housing Multan — Map, Blocks, Plot Sizes & Property for Sale',
      metaDescription:
        'Citi Housing Multan guide: location on Bosan Road, the Phase 1 master plan on the map, blocks, plot sizes, and houses and plots for sale and rent.',
    },
  },
];

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
    const admin: any = await userModel.findOne({ role: 'ADMIN' }).select('_id').lean();
    if (!admin) throw new Error('No ADMIN user — the photos need an owner in the media library');
    // "Citi" and "City" are both used for Citi Housing; "Royal Orchard Block E Multan" is still Block E.
    const loose = (t: string) => t.toLowerCase().replace(/citi/g, 'city').replace(/[^a-z0-9]+/g, '');
    const sameBlock = (areaName: string, block: string) => {
      const a = loose(areaName);
      const b = loose(block);
      return a === b || (a.startsWith(b) && !/^[a-z0-9]/.test(a.slice(b.length).replace(/^multan/, '')));
    };

    for (const s of SOCIETIES) {
      console.log(`\n── ${s.context} ──`);
      const inCity = await db
        .collection('areas')
        .find({ city: { $in: [city._id, String(city._id)] } }, { projection: { name: 1, areaSlug: 1, kind: 1, parent: 1, mergedInto: 1 } })
        .toArray();
      const bySlug = new Map(inCity.map((a: any) => [a.areaSlug, a]));
      const society: any = bySlug.get(s.slug);
      if (!society) {
        console.log(`  ⚠️  No "${s.slug}" area in Multan — skipped`);
        continue;
      }
      console.log(`  Society: ${society.name} (${society._id}) — now: ${society.kind ?? 'area'}`);

      const existing = s.existing.map((x) => bySlug.get(x)).filter(Boolean) as any[];
      // A block the site already has under a slightly different name is used as it is.
      for (const n of s.add) {
        for (const a of inCity) if (sameBlock(String(a.name), n) && !existing.some((e) => String(e._id) === String(a._id)) && !a.mergedInto) existing.push(a);
      }
      const missing = s.existing.filter((x) => !bySlug.has(x));
      console.log(`  Existing areas to make phases: ${existing.length}${missing.length ? ` (not found, skipped: ${missing.join(', ')})` : ''}`);
      for (const a of existing) {
        if (a.kind === 'society' || (a.parent && String(a.parent) !== String(society._id))) console.log(`  ⚠️  ${a.name} belongs to another society — it will be left out`);
      }
      const toAdd = s.add.filter((n) => !inCity.some((a: any) => sameBlock(String(a.name), n)));
      console.log(`  New blocks to add: ${toAdd.length ? toAdd.join(', ') : 'none'}`);

      const urls: string[] = [];
      for (const p of s.photos) {
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
          { folder: 'areas', context: s.context, ai: 'off' },
          String(admin._id),
        );
        await mediaModel.updateOne({ _id: doc._id }, { $set: { alt: p.alt, title: p.alt } });
        console.log(`  photo ${p.name}: saved ${doc.url}`);
        urls.push(doc.url);
      }

      if (!apply) continue;

      for (const name of toAdd) {
        await societies.addPhase(String(society._id), name);
        console.log(`  added ${name}`);
      }
      const now = await societies.adminGet(String(society._id));
      const ids = [
        ...existing.filter((a) => a.kind !== 'society' && (!a.parent || String(a.parent) === String(society._id))).map((a) => String(a._id)),
        ...now.phases.map((p: any) => p._id).filter((id: string) => !existing.some((a) => String(a._id) === id)),
      ];
      const kept = new Map(now.phases.map((p: any) => [p._id, p]));
      // Blocks in letter order (A, B, C…), then the named ones such as the Jinnah Block.
      const names = new Map<string, string>([...inCity.map((a: any) => [String(a._id), String(a.name)] as [string, string]), ...now.phases.map((p: any) => [p._id, String(p.name)] as [string, string])]);
      const rank = (id: string) => {
        const m = /block\s*([a-z])\b/.exec((names.get(id) ?? '').toLowerCase());
        return m ? `0${m[1]}` : `1${names.get(id) ?? ''}`;
      };
      ids.sort((a, b) => rank(a).localeCompare(rank(b)));
      await societies.save(String(society._id), {
        kind: 'society',
        guide: { ...s.guide, image: urls[0] ?? '', gallery: urls.slice(1) },
        phases: ids.map((id) => {
          const p: any = kept.get(id);
          return { id, image: p?.image ?? '', tagline: p?.tagline ?? '', overview: p?.overview ?? '' };
        }),
      });
      console.log(`  ✅ ${s.context} is a society with ${ids.length} blocks and ${urls.length} photos — /societies/multan/${s.slug}`);
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
