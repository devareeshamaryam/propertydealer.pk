/*
 * Read-only report: mailboxes that ended up with more than one account.
 *
 * Gmail ignores dots and "+tags" (xo.moeez@gmail.com = xomoeez@gmail.com =
 * xomoeez+ads@gmail.com), and older sign-ins compared addresses exactly, so a
 * password sign-up and a later "Continue with Google" could create two
 * accounts for one person. Sign-in now matches the mailbox, and the oldest
 * account is the one that opens. This lists any pairs made before that, with
 * how each signs in and how many listings it owns — nothing is changed.
 *
 *   node scripts/users/find-duplicate-accounts.js
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
const { MongoClient } = driver;
const ROOT = path.join(__dirname, '..', '..');

function env(name) {
  if (process.env[name]) return process.env[name];
  const file = path.join(ROOT, 'apps', 'api', '.env');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

/** The mailbox an address delivers to: lower case; for Gmail without dots or a +tag. */
function mailbox(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.split('+')[0].replace(/\./g, '');
  return `${local}@${domain}`;
}

(async () => {
  const uri = env('MONGODB_URI');
  if (!uri) throw new Error('MONGODB_URI not found (environment or apps/api/.env)');
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const users = await db
    .collection('users')
    .find({}, { projection: { email: 1, name: 1, googleId: 1, password: 1, role: 1, createdAt: 1 } })
    .toArray();
  const groups = new Map();
  for (const u of users) {
    const k = mailbox(u.email);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(u);
  }
  const dupes = [...groups.entries()].filter(([, g]) => g.length > 1);
  if (!dupes.length) {
    console.log(`No duplicates: ${users.length} accounts, one per mailbox.`);
    await client.close();
    return;
  }
  const Props = db.collection('properties');
  console.log(`${dupes.length} mailbox(es) with more than one account (oldest first — the oldest is the one that signs in now):\n`);
  for (const [box, g] of dupes) {
    console.log(box);
    g.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    for (const u of g) {
      const listings = await Props.countDocuments({ owner: { $in: [u._id, String(u._id)] } });
      const how = [u.password ? 'password' : '', u.googleId ? 'google' : ''].filter(Boolean).join(' + ') || 'none';
      console.log(`  ${String(u._id)}  ${u.email}  signs in: ${how}  role: ${u.role}  listings: ${listings}  created: ${u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '?'}`);
    }
  }
  await client.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
