/*
 * Areas clean-up, step 1 of 2 — builds the plan. Reads only; changes nothing.
 *
 *   node scripts/areas/build-plan.js [--checklist <city>=<file.json> ...]
 *
 * Inputs
 *   scripts/areas/.live-cities.json, .live-areas.json — the live site's public
 *     /api/cities/names and /api/areas/names (download them fresh first).
 *   OpenStreetMap (© OpenStreetMap contributors, ODbL) — named neighbourhoods,
 *     suburbs and residential schemes around each city, through the Overpass
 *     API; and Nominatim for anything not found that way (1 request a second,
 *     as its usage policy asks).
 *   Optional checklists — society names a city should have.
 *
 * Output: scripts/areas/plan.json and scripts/areas/REPORT.md, for
 * apply-plan.js to carry out on the server, and for a person to read first.
 *
 * What the plan proposes (nothing is deleted, no slug — so no URL — changes):
 *   coords   — a centre for each existing area that lacks one
 *   rename   — "lake city, lahore" → "lake city" (display name only)
 *   hide     — "7.5 marla", "a block", the city's own name saved as an area
 *   merge    — duplicates of one society; apply-plan picks the one to keep by
 *              listings, moves the others' listings to it, and leaves the
 *              others' URLs working (showing the kept area, canonical to it)
 *   add      — societies and neighbourhoods the site does not have yet
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const UA = { 'User-Agent': 'PropertyDealerAreas/1.0 (+https://propertydealer.pk)', 'Accept-Language': 'en' };
const OVERPASS = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cities = JSON.parse(fs.readFileSync(path.join(DIR, '.live-cities.json'), 'utf8'));
const areas = JSON.parse(fs.readFileSync(path.join(DIR, '.live-areas.json'), 'utf8'));

// Big societies a city should have — checked against OSM / Nominatim, added only when found on the map.
const KNOWN = {
  islamabad: ['DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 5', 'Bahria Enclave', 'Gulberg Greens', 'Gulberg Residencia', 'B-17', 'Top City 1', 'Park View City', 'Capital Smart City', 'Faisal Hills', 'Faisal Town', 'Blue World City', 'Bani Gala', 'D-12', 'E-11', 'F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-9', 'G-10', 'G-11', 'G-13', 'G-14', 'G-15', 'I-8', 'I-10', 'I-14', 'Pakistan Town', 'PWD Housing Scheme', 'Soan Garden', 'National Police Foundation', 'Naval Anchorage', 'CBR Town', 'Jinnah Garden', 'Ghauri Town', 'Korang Town', 'Media Town', 'Shehzad Town', 'Tarlai', 'Bhara Kahu', 'Chak Shahzad', 'Engineers Cooperative Housing Society', 'Multi Gardens B-17', 'Mumtaz City', 'Nova City', 'Kingdom Valley', 'Eighteen'],
  rawalpindi: ['Bahria Town Phase 1', 'Bahria Town Phase 2', 'Bahria Town Phase 3', 'Bahria Town Phase 4', 'Bahria Town Phase 5', 'Bahria Town Phase 6', 'Bahria Town Phase 7', 'Bahria Town Phase 8', 'DHA Phase 2', 'Gulraiz Housing Scheme', 'Adiala Road', 'Chaklala Scheme 3', 'Satellite Town', 'Saddar', 'Westridge', 'Askari 14', 'Gulshan Abad', 'Airport Housing Society', 'Ghauri Garden', 'Al Haram City', 'Rawalpindi Housing Society', 'Commoners Sky Gardens', 'Pakistan Railway Housing Scheme', 'Fazaia Housing Scheme', 'Kashmir Road', 'Peshawar Road', 'Lalazar', 'Dhamyal'],
  karachi: ['DHA Phase 1', 'DHA Phase 2', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 7', 'DHA Phase 8', 'DHA City', 'Bahria Town Karachi', 'Clifton', 'Gulshan-e-Iqbal', 'Gulistan-e-Johar', 'North Nazimabad', 'Nazimabad', 'Federal B Area', 'Gulberg', 'Scheme 33', 'Malir Cantonment', 'Askari 4', 'Askari 5', 'PECHS', 'Tariq Road', 'Bahadurabad', 'Korangi', 'Shah Faisal Colony', 'Saadi Town', 'Naya Nazimabad', 'Gulshan-e-Maymar', 'Surjani Town', 'North Karachi', 'Garden West', 'KDA Scheme 1', 'Navy Housing Scheme Karsaz', 'Falaknaz', 'Jamshed Town', 'Lyari', 'Saddar', 'Defence View', 'Mehmoodabad', 'Gulshan-e-Hadeed', 'Bin Qasim Town', 'Landhi', 'Orangi Town'],
  multan: ['DHA Multan', 'Bahria Town Multan', 'Wapda Town', 'Buch Executive Villas', 'Royal Orchard', 'Model Town', 'Gulgasht Colony', 'Shah Rukn-e-Alam Colony', 'Bosan Road', 'Cantt', 'Shalimar Colony', 'Fatima Jinnah Town', 'Officer Colony', 'Khan Village', 'Garden Town', 'New Multan', 'Mumtazabad', 'Nishtar Road', 'Sher Shah Road', 'Gulshan Market', 'Askari Bypass', 'City Housing Multan', 'Citi Housing Multan', 'Nawab Town', 'Zakariya Town', 'Defence View'],
  faislabad: ['Citi Housing Faisalabad', 'Eden Valley', 'Wapda City', 'Gulberg', 'Madina Town', 'Peoples Colony', 'Satiana Road', 'Canal Road', 'Jinnah Colony', 'Susan Road', 'Kohinoor City', 'Abdullah Garden', 'Batala Colony', 'Millat Town', 'Samanabad', 'Ghulam Muhammad Abad', 'Officers Colony', 'Lyallpur Town', 'Muslim Town', 'Al Najaf Colony', 'FDA City', 'Eden Garden'],
  peshawar: ['Hayatabad', 'DHA Peshawar', 'University Town', 'Regi Model Town', 'Gulbahar', 'Warsak Road', 'Cantt', 'Saddar', 'Dalazak Road', 'Ring Road', 'Tehkal', 'Faisal Colony', 'Shami Road'],
  gujranwala: ['DC Colony', 'Citi Housing Gujranwala', 'Satellite Town', 'Model Town', 'Wapda Town', 'Peoples Colony', 'Master City', 'Royal Palm City', 'Garden Town', 'Rahwali Cantt'],
  sialkot: ['Cantt', 'Defence Road', 'Model Town', 'Citi Housing Sialkot', 'Paris Road', 'Kashmir Road', 'Shahab Pura', 'Ugoki'],
  bahawalpur: ['DHA Bahawalpur', 'Model Town A', 'Satellite Town', 'Shahdrah', 'Cantt', 'Al-Rehman Garden', 'Baghdad-ul-Jadeed'],
  hyderabad: ['Latifabad', 'Qasimabad', 'Citizen Colony', 'Saddar', 'Bahria Town Hyderabad', 'Hala Naka', 'Wadhu Wah'],
  sahiwal: ['Farid Town', 'Jeewan City', 'Officers Colony', 'Fareed Town', 'Al Rehman Town', 'Civil Lines'],
  quetta: ['Jinnah Town', 'Samungli Housing Scheme', 'Cantonment', 'Satellite Town', 'Shahbaz Town'],
};

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--checklist') {
    const [c, file] = args[++i].split('=');
    KNOWN[c] = [...new Set([...(KNOWN[c] || []), ...JSON.parse(fs.readFileSync(file, 'utf8'))])];
  }
}

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
/** Matching key: "Bahria Town, Sector-E, Lahore" and "bahria town sector e" agree. */
function norm(name, cityName = '') {
  let s = String(name).toLowerCase().replace(/&/g, ' and ');
  for (const w of [cityName, 'faisalabad', 'faislabad'].filter(Boolean)) s = s.replace(new RegExp(`\\b${w.toLowerCase()}\\b`, 'g'), ' ');
  s = s
    .replace(/\bdefen[cs]e housing authority\b/g, 'dha')
    .replace(/\bph(ase)?\.?\s*-?\s*([ivx]+|\d+)\b/g, (_, __, n) => ` phase ${ROMAN[n] || n} `)
    .replace(/\b(housing|society|scheme|cooperative|co operative|co-operative|the)\b/g, ' ')
    .replace(/-e-/g, ' e ')
    .replace(/[^a-z0-9]+/g, '');
  return s || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
/** "lake city, lahore" → "lake city"; leaves names alone otherwise. */
function cleanName(name, cityName) {
  let s = String(name).replace(/\s+/g, ' ').trim();
  const re = new RegExp(`[,\\s-]+${cityName.toLowerCase().replace(/[^a-z ]/g, '')}\\s*$`, 'i');
  const stripped = s.replace(re, '').replace(/[,\s-]+$/, '').trim();
  if (stripped.length >= 3 && stripped.toLowerCase() !== cityName.toLowerCase()) s = stripped;
  return s.toLowerCase();
}
const isJunk = (name, cityName) =>
  /^\s*[\d.]+\s*(marla|kanal|sq|ft)\b/i.test(name) ||
  /^\s*[a-z]\s*-?\s*block\s*$/i.test(name) ||
  /^\s*block\s*-?\s*[a-z0-9]\s*$/i.test(name) ||
  /^\s*(new|old)\s*$/i.test(name) ||
  name.trim().toLowerCase() === cityName.toLowerCase();

const dist = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) * 111; // km

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      const t = await r.text();
      if (t.trim().startsWith('{') || t.trim().startsWith('[')) return JSON.parse(t);
    } catch { /* retry */ }
    await sleep(6000 * (i + 1));
  }
  return null;
}

let lastNominatim = 0;
const CACHE_FILE = path.join(DIR, '.nominatim-cache.json');
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
async function nominatim(q, centre, km) {
  const ck = `${q}|${centre ? `${centre.lat.toFixed(2)},${centre.lng.toFixed(2)},${km}` : ''}`;
  if (ck in cache) return cache[ck];
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const d = km / 111;
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('q', q);
  u.searchParams.set('countrycodes', 'pk');
  u.searchParams.set('limit', '3');
  if (centre) {
    u.searchParams.set('viewbox', [centre.lng - d, centre.lat + d, centre.lng + d, centre.lat - d].join(','));
    u.searchParams.set('bounded', '1');
  }
  const rows = (await getJson(u.toString(), 2)) || [];
  // Not the city itself, nor a single road or shop.
  const hit = rows
    .filter((r) => !['city', 'administrative', 'road', 'shop', 'amenity'].includes(r.type) || r.class === 'place')
    .filter((r) => !['city', 'state', 'country'].includes(r.addresstype))
    .map((r) => ({ lat: +r.lat, lng: +r.lon, name: r.name, type: `${r.class}/${r.type}` }))[0] || null;
  cache[ck] = hit;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  return hit;
}

/** City centres: known ones first (Nominatim's "Lahore" is the district's middle), else Nominatim's city. */
const CENTRES = {
  lahore: [31.5204, 74.3587], karachi: [24.8607, 67.0011], islamabad: [33.6844, 73.0479], rawalpindi: [33.5973, 73.0479],
  faislabad: [31.4504, 73.135], multan: [30.1975, 71.4697], peshawar: [34.0151, 71.5249], quetta: [30.1798, 66.975],
  gujranwala: [32.1877, 74.1945], sialkot: [32.4927, 74.5319], hyderabad: [25.396, 68.3578], bahawalpur: [29.3956, 71.6836],
  sargodha: [32.0836, 72.6711], sahiwal: [30.6682, 73.1114], gujrat: [32.5731, 74.0789], sheikhupura: [31.7131, 73.9783],
  okara: [30.8138, 73.4534], kasur: [31.1187, 74.4462], jhang: [31.2681, 72.3181], jhelum: [32.9405, 73.7276],
  'rahim-yar-khan': [28.4202, 70.2952], sadiqabad: [28.3062, 70.1301], burewala: [30.1667, 72.65], 'dera-ghazi-khan': [30.0561, 70.6348],
  chiniot: [31.72, 72.9789], hafizabad: [32.0712, 73.6878], kamoke: [31.9744, 74.2233], khanewal: [30.3017, 71.9321],
  larkana: [27.559, 68.2264], sukkur: [27.7052, 68.8574], wah: [33.7715, 72.7511], 'wah-cant': [33.7953, 72.7231],
};
async function cityCentre(name) {
  const k = slugify(name);
  if (CENTRES[k]) return { lat: CENTRES[k][0], lng: CENTRES[k][1] };
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('city', name);
  u.searchParams.set('countrycodes', 'pk');
  u.searchParams.set('limit', '1');
  await sleep(1100);
  const r = ((await getJson(u.toString(), 2)) || [])[0];
  return r ? { lat: +r.lat, lng: +r.lon } : null;
}

async function overpass(centre, radius) {
  const around = `(around:${radius},${centre.lat},${centre.lng})`;
  const parts = [
    `nwr["place"~"^(suburb|neighbourhood|quarter)$"]["name"]${around};`,
    `way["landuse"="residential"]["name"]${around};`,
    `relation["landuse"="residential"]["name"]${around};`,
  ];
  const out = [];
  for (const p of parts) {
    const j = await getJson(`${OVERPASS}?data=${encodeURIComponent(`[out:json][timeout:170];(${p});out center tags;`)}`);
    if (j?.elements) out.push(...j.elements);
    await sleep(1500);
  }
  return out
    .map((e) => ({ name: e.tags['name:en'] || e.tags.name, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, kind: e.tags.place || e.tags.landuse, osm: `${e.type}/${e.id}` }))
    .filter((x) => x.lat && x.name && /^[\x20-\x7e]+$/.test(x.name));
}

const SOCIETY = /(town|city|garden|gardens|housing|society|scheme|colony|villa|avenue|enclave|estate|park|homes|residenc|dha|defen[cs]e|bahria|askari|phase|valley|orchard|cantt|model|abad|pura|nagar|greens|heights|farms|bagh|\b[a-i]-\d{1,2}\b)/i;
const NOT_SOCIETY = /(block|apartment|appartment|hostel|flats?\b|plaza|tower|mall|market|bazaar|street|road$|chowk|hospital|school|college|university|library|club|mosque|masjid|factory|mill|office|depot|station|camp|jail|graveyard|qabristan|house$)/i;


/*
 * Keep a new area only when it is a place people buy and rent in: a society,
 * town, colony or a city's main suburb — not an old-city kucha or mohallah, a
 * village, a sub-sector (G-9/3) or a numbered survey block — and only in the
 * city whose centre it is nearest to (Rawalpindi's circle reaches Islamabad).
 */
const JUNK_ADD = /\b(kucha|kocha|mohall?ah?|mohalla|haveli|galli|gali|dhok[ea]?|goth|basti|theh|survey no|chak|pind|dera|killa|kot)\b|\/\d|^sector\s*[\d-]+[a-z]?$|^zone\b|^\d/i;
function keepAdd(a, citySlug, centres) {
  if (JUNK_ADD.test(a.name)) return false;
  const near = Object.entries(centres).sort((x, y) => Math.hypot(x[1].lat - a.lat, x[1].lng - a.lng) - Math.hypot(y[1].lat - a.lat, y[1].lng - a.lng))[0];
  if (near && near[0] !== citySlug) return false;
  if (a.how.startsWith('checklist')) return true;
  if (/osm:(suburb|quarter|town)/.test(a.how)) return true;
  return SOCIETY.test(a.name);
}
/** Same words in another order ("phase 9 town dha" / "dha phase 9 town") is the same place. */
function wordsKey(name, cityName) {
  return norm(name, cityName).length ? String(name).toLowerCase().replace(new RegExp(cityName, 'ig'), ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => w && !['housing', 'society', 'scheme', 'the', 'and'].includes(w)).sort().join(' ') : '';
}
function refine(plan) {
  const centres = Object.fromEntries(plan.cities.map((c) => [c.citySlug, c.centre]));
  for (const c of plan.cities) {
    const seen = new Set(areas.filter((a) => a.city === c.cityId).map((a) => wordsKey(a.name, c.city)));
    c.add = c.add.filter((a) => {
      if (!keepAdd(a, c.citySlug, centres)) return false;
      const k = wordsKey(a.name, c.city);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return plan;
}

if (process.argv.includes("--refine-only")) {
  const plan = refine(JSON.parse(fs.readFileSync(path.join(DIR, "plan.json"), "utf8")));
  fs.writeFileSync(path.join(DIR, "plan.json"), JSON.stringify(plan, null, 1));
  const n = plan.cities.reduce((t, c) => t + c.add.length, 0);
  console.log("refined: adds now", n);
  process.exit(0);
}

(async () => {
  const plan = { generatedAt: new Date().toISOString(), source: '© OpenStreetMap contributors (ODbL)', cities: [] };
  const report = ['# Areas plan', '', `Generated ${plan.generatedAt}. Nothing is changed until apply-plan.js runs with --apply.`, ''];

  for (const city of cities) {
    const cityAreas = areas.filter((a) => a.city === city._id);
    const cslug = slugify(city.name);
    const centre = await cityCentre(city.name);
    if (!centre) {
      report.push(`## ${city.name}\n\nCity not found on the map — skipped.\n`);
      continue;
    }
    const big = cityAreas.length > 60 || ['lahore', 'karachi'].includes(cslug);
    const radiusKm = big ? 25 : ['islamabad', 'rawalpindi', 'faislabad', 'multan'].includes(cslug) ? 18 : 10;
    console.log(`${city.name}: ${cityAreas.length} areas, OSM within ${radiusKm} km…`);
    const osm = await overpass(centre, radiusKm * 1000);

    // OSM by key, the nearest to the city centre winning.
    const osmBy = new Map();
    for (const o of osm) {
      const k = norm(o.name, city.name);
      const prev = osmBy.get(k);
      if (!prev || dist(o, centre) < dist(prev, centre)) osmBy.set(k, o);
    }

    const entry = { cityId: city._id, city: city.name, citySlug: cslug, centre, coords: [], rename: [], hide: [], merge: [], add: [] };

    // ── Existing areas ──
    const groups = new Map();
    for (const a of cityAreas) {
      if (isJunk(a.name, city.name)) {
        entry.hide.push({ id: a._id, name: a.name, slug: a.areaSlug });
        continue;
      }
      const k = norm(a.name, city.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }
    const taken = new Set(cityAreas.map((a) => a.name.toLowerCase()));
    for (const [k, list] of groups) {
      if (list.length > 1) entry.merge.push({ key: k, ids: list.map((a) => a._id), names: list.map((a) => `${a.name} [${a.areaSlug}]`) });
      for (const a of list) {
        const clean = cleanName(a.name, city.name);
        if (clean !== a.name.toLowerCase() && !taken.has(clean) && list.length === 1) {
          entry.rename.push({ id: a._id, from: a.name, to: clean });
          taken.add(clean);
        }
      }
      // A centre for the group, from OSM, else Nominatim.
      let at = osmBy.get(k);
      let how = 'osm';
      if (!at) {
        at = await nominatim(`${cleanName(list[0].name, city.name)}, ${city.name}, Pakistan`, centre, radiusKm + 10);
        how = 'nominatim';
      }
      if (at && dist(at, centre) <= radiusKm + 15) {
        for (const a of list) entry.coords.push({ id: a._id, lat: +at.lat.toFixed(6), lng: +at.lng.toFixed(6), how });
      }
    }

    // ── New ones ──
    const have = new Set([...groups.keys()]);
    const cityKey = norm(city.name);
    const addKey = (k, row) => {
      if (have.has(k) || k.length < 3 || k === cityKey || /locality|chak ?no|^chak\b|\bjb\b|\bgb\b|village|^\s*(faisalabad|faislabad)\s*$/i.test(row.name) || row.name.trim() === city.name.toLowerCase()) return;
      have.add(k);
      entry.add.push(row);
    };
    for (const name of KNOWN[cslug] || []) {
      const k = norm(name, city.name);
      if (have.has(k)) continue;
      const at = osmBy.get(k) || (await nominatim(`${name}, ${city.name}, Pakistan`, centre, radiusKm + 10));
      if (at && dist(at, centre) <= radiusKm + 15) {
        addKey(k, { name: name.toLowerCase(), slug: slugify(name), lat: +at.lat.toFixed(6), lng: +at.lng.toFixed(6), how: osmBy.get(k) ? 'checklist+osm' : 'checklist+nominatim', sourceId: at.osm || '' });
      }
    }
    for (const o of osmBy.values()) {
      const named = o.name.trim();
      if (named.length < 4 || named.length > 60 || NOT_SOCIETY.test(named)) continue;
      const place = o.kind === 'suburb' || o.kind === 'neighbourhood' || o.kind === 'quarter';
      if (!place && !SOCIETY.test(named)) continue;
      addKey(norm(named, city.name), { name: named.toLowerCase(), slug: slugify(named), lat: +o.lat.toFixed(6), lng: +o.lng.toFixed(6), how: `osm:${o.kind}`, sourceId: o.osm });
    }
    // Slugs unique within the city.
    const slugs = new Set(cityAreas.map((a) => a.areaSlug));
    for (const r of entry.add) {
      let s = r.slug || 'area';
      for (let n = 2; slugs.has(s); n++) s = `${r.slug}-${n}`;
      r.slug = s;
      slugs.add(s);
    }

    plan.cities.push(entry);
    report.push(
      `## ${city.name}`,
      '',
      `${cityAreas.length} areas now · centre found for ${entry.coords.length} · ${entry.rename.length} names cleaned · ${entry.hide.length} hidden · ${entry.merge.length} duplicate groups · ${entry.add.length} to add`,
      '',
      ...(entry.merge.length ? ['**Duplicates** (kept one is chosen on the server by listings):', ...entry.merge.map((m) => `- ${m.names.join('  ·  ')}`), ''] : []),
      ...(entry.hide.length ? ['**Hidden** (URL keeps working):', ...entry.hide.map((h) => `- ${h.name}`), ''] : []),
      ...(entry.rename.length ? ['**Renamed** (slug unchanged):', ...entry.rename.slice(0, 400).map((r) => `- ${r.from} → ${r.to}`), ''] : []),
      ...(entry.add.length ? ['**Added**:', entry.add.map((r) => r.name).join(', '), ''] : []),
    );
    fs.writeFileSync(path.join(DIR, 'plan.json'), JSON.stringify(plan, null, 1));
    fs.writeFileSync(path.join(DIR, 'REPORT.md'), report.join('\n'));
  }
  refine(plan);
  fs.writeFileSync(path.join(DIR, "plan.json"), JSON.stringify(plan, null, 1));
  const t = plan.cities.reduce((s, c) => ({ coords: s.coords + c.coords.length, rename: s.rename + c.rename.length, hide: s.hide + c.hide.length, merge: s.merge + c.merge.length, add: s.add + c.add.length }), { coords: 0, rename: 0, hide: 0, merge: 0, add: 0 });
  report.splice(3, 0, `**Totals:** centres ${t.coords} · renamed ${t.rename} · hidden ${t.hide} · duplicate groups ${t.merge} · added ${t.add}`, '');
  fs.writeFileSync(path.join(DIR, 'REPORT.md'), report.join('\n'));
  console.log('done', t);
})();
