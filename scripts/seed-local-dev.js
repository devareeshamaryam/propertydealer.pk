/*
 * Local development data — NEVER for the live database.
 *
 *   MONGODB_URI=mongodb://127.0.0.1:27017/propertydealer_dev node scripts/seed-local-dev.js
 *
 * Copies a sample of public listings (with their cities and areas) from the
 * live site's public API into a LOCAL database — with each listing's real map
 * pin, read from its public detail endpoint — and creates a test admin
 * for signing in to the local dashboard. It refuses to run against anything
 * that is not on this machine.
 *
 * Test admin (local only): see DEV_ADMIN below.
 */
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const DEV_ADMIN = { email: 'admin@local.test', password: 'local-dev-admin-1234', name: 'Local Admin' };
const SOURCE = 'https://propertydealer.pk/api';
const CITIES = ['Lahore', 'Multan', 'Islamabad', 'Rawalpindi', 'Karachi', 'Faisalabad'];

const uri = process.env.MONGODB_URI || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]*dev[\w-]*$/.test(uri)) {
  console.error('Refusing: MONGODB_URI must be a local database whose name contains "dev".');
  process.exit(1);
}

const oid = (v) => (v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : undefined);

(async () => {
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const cities = new Map();
  const areas = new Map();
  const props = [];

  for (const city of CITIES) {
    const res = await fetch(`${SOURCE}/properties?limit=100&city=${encodeURIComponent(city)}`);
    const json = await res.json();
    for (const p of json.properties || []) {
      const a = p.area;
      if (!a || !a.city) continue;
      cities.set(a.city._id, { _id: oid(a.city._id), name: a.city.name, country: a.city.country, state: a.city.state });
      areas.set(a._id, { _id: oid(a._id), name: a.name, areaSlug: a.areaSlug, city: oid(a.city._id) });
      props.push(p);
    }
  }

  // The list endpoint leaves the map pin out; the detail endpoint has it (read-only).
  const pins = new Map();
  for (let i = 0; i < props.length; i += 6) {
    await Promise.all(props.slice(i, i + 6).map(async (p) => {
      try {
        const d = await (await fetch(`${SOURCE}/properties/slug/${encodeURIComponent(p.slug)}`)).json();
        const lat = Number(d?.latitude ?? d?.data?.latitude);
        const lng = Number(d?.longitude ?? d?.data?.longitude);
        if (lat > 20 && lat < 40 && lng > 58 && lng < 80) pins.set(p._id, { lat, lng });
      } catch { /* no pin */ }
    }));
  }

  const now = new Date();
  for (const c of cities.values()) await db.collection('cities').updateOne({ _id: c._id }, { $set: { ...c, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
  for (const a of areas.values()) await db.collection('areas').updateOne({ _id: a._id }, { $set: { ...a, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });

  const admin = await db.collection('users').findOneAndUpdate(
    { email: DEV_ADMIN.email },
    { $set: { email: DEV_ADMIN.email, name: DEV_ADMIN.name, role: 'ADMIN', isActive: true, provider: 'credentials', password: await bcrypt.hash(DEV_ADMIN.password, 10), updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  const ownerId = admin._id ?? admin.value?._id;

  for (const p of props) {
    const doc = {
      ...p,
      _id: oid(p._id),
      area: oid(p.area._id),
      owner: ownerId,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    };
    const pin = pins.get(p._id);
    const update = pin
      ? { $set: { ...doc, latitude: pin.lat, longitude: pin.lng } }
      : { $set: doc, $unset: { latitude: '', longitude: '' } };
    await db.collection('properties').updateOne({ _id: doc._id }, update, { upsert: true });
  }

  console.log(`cities ${cities.size}, areas ${areas.size}, listings ${props.length}, with a real pin ${pins.size}`);
  console.log(`admin: ${DEV_ADMIN.email}`);
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
