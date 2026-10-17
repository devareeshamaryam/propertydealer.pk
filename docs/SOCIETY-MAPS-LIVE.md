# E-Map — live site pe kya hota hai

Sab kuch **khud** hota hai. Server pe repo ke root se sirf:

```bash
git pull && npm run build && pm2 restart all
```

API start hone ke ~30 second baad, background mein, **ek hi dafa** (har data ki apni lock `datamigrations` collection mein):

| Step | Data (repo mein) | Kya karta hai |
| --- | --- | --- |
| 1 | `scripts/areas/plan.json` | Areas ki safai: duplicates merge, coordinates, naam, nayi societies. Pehle `scripts/areas/backup-<waqt>.json` banta hai. Koi URL nahi badalta. |
| 2 | `data/society-maps/<city>-<slug>/` | DHA Lahore ke 13 official master plans import; tiles background mein banti hain (bari phases ~10 min). |
| 3 | `data/society-plots/*.ndjson.gz` | DHA Lahore ke 1,20,244 plots (plot number, sector, size, outline) — plot finder aur "plot pe tap" ke liye. |
| 4 | `data/society-data/<city>.json` | Har city ki societies: OSM outline + blocks + landmarks, aur LDA ka record (approved / regularised / illegal, area, plots, blocks). Sirf jin societies ke paas asal data hai unka map page banta hai. |
| 5 | (LDA website) | LDA ke approved layout plans (~330 images) ek ek kar ke download, web-size bana kar save. Kuch ghante lag sakte hain; ruk jaye to agli restart pe wahin se. |

Admin panel mein jo map khud edit kiya ho, us ka text/blocks/landmarks overwrite **nahi** hote — sirf khali fields bharti hain aur official record taaza hota hai.

Band karna ho to API ke env mein `AUTO_SETUP=false`.

Ek dafa (PDF master plans upload ke liye): `sudo apt install -y poppler-utils`. Nginx: `client_max_body_size 120M;`

## Check

- `/emap` → cities (har city pe click → wohi city select)
- `/emap/lahore` → Lahore ki saari societies list + map
- `/emap/lahore/dha-phase-6` → master plan, plot search ("L 215"), plot pe tap
- `/emap/lahore/valencia-town` → LDA approved layout plan + status
- Admin → **Society Maps** → city / kind filter; har map ka source (OSM / LDA / Official GIS)

## Sources

- Outlines, blocks, landmarks: © OpenStreetMap contributors (ODbL) — page pe credit likha hai.
- LDA records aur plans: lda.gop.pk (approved, regularised, illegal schemes lists).
- DHA Lahore plans aur plots: DHA Lahore ka public GIS.
