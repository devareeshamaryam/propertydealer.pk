/*
 * Change the admin's email and password — then this file deletes itself.
 *
 * 1. Fill in the three values below.
 * 2. Run from the repo root:   node apps/api/src/scripts/change-admin-login.js
 *
 * - Reads the database address from apps/api/.env (MONGODB_URI) — nothing secret is kept here.
 * - Only changes an account whose role is ADMIN.
 * - Signs the admin out everywhere (old sessions stop working) and unlocks the account.
 * - On success this file is deleted, so the new password does not stay on disk.
 *   If something is wrong, nothing is changed and the file is kept so you can fix the values.
 */

// ── Fill these in ─────────────────────────────────────────────
const CURRENT_EMAIL = 'user@gmail.com'; // the admin's email today
const NEW_EMAIL = 'logicalmoez@gmail.com';     // leave '' to keep the same email
const NEW_PASSWORD = 'Multanpakistan1!';  // at least 8 characters
// ──────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const fail = (msg) => {
  console.error(`\n❌ ${msg}\nNothing was changed. This file was kept — fix the values and run it again (or delete it).`);
  process.exit(1);
};

async function main() {
  const current = CURRENT_EMAIL.trim().toLowerCase();
  const next = (NEW_EMAIL.trim() || CURRENT_EMAIL).trim().toLowerCase();
  if (!current) return fail('Fill in CURRENT_EMAIL.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return fail('NEW_EMAIL does not look like an email address.');
  if (NEW_PASSWORD.length < 8) return fail('NEW_PASSWORD must be at least 8 characters.');
  if (!process.env.MONGODB_URI) return fail('MONGODB_URI is missing from apps/api/.env.');

  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');

  const admin = await users.findOne({ email: current });
  if (!admin) return fail(`No account with the email ${current}.`);
  if (admin.role !== 'ADMIN') return fail(`${current} is not an admin account (role: ${admin.role}).`);
  if (next !== current && (await users.findOne({ email: next }))) return fail(`${next} is already used by another account.`);

  await users.updateOne(
    { _id: admin._id },
    {
      $set: { email: next, password: await bcrypt.hash(NEW_PASSWORD, 10), loginAttempts: 0, isActive: true, updatedAt: new Date() },
      // Old sign-ins stop working; the account is unlocked.
      $unset: { refreshToken: '', lockUntil: '' },
    },
  );
  await mongoose.disconnect();

  console.log(`\n✅ Admin updated. Sign in with ${next} and your new password.`);
  try {
    fs.unlinkSync(__filename);
    console.log('🗑️  This script has deleted itself.');
  } catch {
    console.log(`⚠️  Could not delete this file — delete it yourself: ${__filename}`);
  }
  process.exit(0);
}

main().catch((e) => fail(e.message));
