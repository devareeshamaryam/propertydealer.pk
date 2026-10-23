/**
 * Which listings point at photos that are not on this server's disk?
 *
 * Read-only: it only reads the database and checks whether each file exists.
 * Nothing is written to the database and no file is moved or deleted.
 * Prints a summary and writes missing-photos.csv in the current folder.
 *
 *   npm run check:photos --workspace=apps/api
 *   npm run check:photos:prod --workspace=apps/api     (after a build)
 *
 * Needs MONGODB_URI (read from apps/api/.env when present).
 */
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

function loadEnv() {
  for (const f of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps', 'api', '.env'),
  ]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]!] === undefined)
        process.env[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, '');
    }
  }
}

function uploadsRoot() {
  const cwd = process.cwd();
  const inApi =
    cwd.includes(path.join('apps', 'api')) ||
    cwd.endsWith(path.join('apps', 'api'));
  return inApi
    ? path.join(cwd, '..', '..', 'uploads')
    : path.join(cwd, 'uploads');
}

/** "/uploads/properties/x.webp" or "https://…/uploads/properties/x.webp" -> "properties/x.webp" */
function keyOf(url: string): string | null {
  const m = /\/uploads\/(.+)$/.exec(url.split('?')[0]!);
  return m ? decodeURIComponent(m[1]!) : null;
}

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const root = uploadsRoot();
  console.log(`Uploads folder: ${root}`);

  await mongoose.connect(uri);
  type Row = {
    slug?: string;
    status?: string;
    createdAt?: Date | string;
    mainPhotoUrl?: unknown;
    additionalPhotosUrls?: unknown;
  };
  const props = mongoose.connection.collection<Row>('properties');
  const cursor = props.find(
    {},
    {
      projection: {
        slug: 1,
        status: 1,
        createdAt: 1,
        mainPhotoUrl: 1,
        additionalPhotosUrls: 1,
      },
    },
  );

  const rows: string[] = ['slug,status,createdAt,missing,total,firstMissing'];
  let listings = 0;
  let withMissing = 0;
  let allMissing = 0;
  let files = 0;
  let missingFiles = 0;
  const byMonth = new Map<string, number>();

  for await (const p of cursor) {
    listings++;
    const urls = [
      p.mainPhotoUrl,
      ...(Array.isArray(p.additionalPhotosUrls)
        ? (p.additionalPhotosUrls as unknown[])
        : []),
    ].filter(
      (u): u is string => typeof u === 'string' && u.includes('/uploads/'),
    );
    if (!urls.length) continue;
    const missing = urls.filter((u) => {
      const key = keyOf(u);
      return key ? !fs.existsSync(path.join(root, key)) : false;
    });
    files += urls.length;
    missingFiles += missing.length;
    if (!missing.length) continue;
    withMissing++;
    if (missing.length === urls.length) allMissing++;
    const created = p.createdAt ? new Date(p.createdAt).toISOString() : '';
    byMonth.set(
      created.slice(0, 7),
      (byMonth.get(created.slice(0, 7)) ?? 0) + 1,
    );
    rows.push(
      [p.slug, p.status, created, missing.length, urls.length, missing[0]]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
  }

  await mongoose.disconnect();
  fs.writeFileSync('missing-photos.csv', rows.join('\n'));
  console.log(`Listings: ${listings}`);
  console.log(
    `Photo files referenced: ${files}, missing on disk: ${missingFiles}`,
  );
  console.log(
    `Listings with a missing photo: ${withMissing} (all photos missing: ${allMissing})`,
  );
  console.log('By month created:', Object.fromEntries([...byMonth].sort()));
  console.log(`Details: ${path.resolve('missing-photos.csv')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
