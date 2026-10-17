// node scripts/areas/report.js — writes REPORT.md from plan.json (what apply-plan.js will do).
const fs = require('fs');
const path = require('path');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan.json'), 'utf8'));
const t = plan.cities.reduce((s, c) => ({ coords: s.coords + c.coords.length, rename: s.rename + c.rename.length, hide: s.hide + c.hide.length, merge: s.merge + c.merge.length, add: s.add + c.add.length }), { coords: 0, rename: 0, hide: 0, merge: 0, add: 0 });
const out = [
  '# Areas plan',
  '',
  `Built ${plan.generatedAt}. Places from ${plan.source}. Nothing changes until \`node scripts/areas/apply-plan.js --apply\` runs on the server.`,
  '',
  `**Totals:** centres for ${t.coords} areas · ${t.rename} names cleaned · ${t.hide} hidden · ${t.merge} duplicate groups merged · ${t.add} societies added`,
  '',
];
for (const c of plan.cities) {
  if (!c.coords.length && !c.rename.length && !c.hide.length && !c.merge.length && !c.add.length) continue;
  out.push(`## ${c.city}`, '', `centres ${c.coords.length} · renamed ${c.rename.length} · hidden ${c.hide.length} · duplicate groups ${c.merge.length} · added ${c.add.length}`, '');
  if (c.merge.length) out.push('**Duplicates** (the one with most listings is kept, the others point to it):', ...c.merge.map((m) => `- ${m.names.join('  ·  ')}`), '');
  if (c.hide.length) out.push('**Hidden** (URL keeps working, not offered in lists):', ...c.hide.map((h) => `- ${h.name}`), '');
  if (c.rename.length) out.push('**Names cleaned** (URL unchanged):', ...c.rename.map((r) => `- ${r.from} → ${r.to}`), '');
  if (c.add.length) out.push('**Added**:', c.add.map((r) => r.name).join(', '), '');
}
fs.writeFileSync(path.join(__dirname, 'REPORT.md'), out.join('\n'));
console.log(t);
