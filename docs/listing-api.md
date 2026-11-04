# Listing API — add listings automatically (n8n, scripts)

**Version 2** · Updated November 2026

A private API for automations (n8n, a scraper, a script) that adds property
listings to the site under the **admin account**, keeps them up to date, and
marks them sold or rented. It runs every listing through the **same code as
the dashboard**, so an imported listing is exactly like one added by hand:
same areas, same sizes, same web address, same checks, alerts and search pages.

> Already using version 1? Your workflow keeps working — every old field and
> route still does the same thing. Read [Moving from version 1](#moving-from-version-1)
> for what changed and what to add.

---

## Contents

1. [Setup (server)](#1-setup-server)
2. [Quick start — your first listing in 3 calls](#2-quick-start)
3. [Adding a listing — every field](#3-adding-a-listing--every-field)
4. [Location: city, area, society, map pin](#4-location-city-area-society-map-pin)
5. [Size](#5-size)
6. [Photos and video](#6-photos-and-video)
7. [Published, waiting or draft](#7-published-waiting-or-draft)
8. [No duplicates: `externalId`](#8-no-duplicates-externalid)
9. [Updating, sold / rented](#9-updating-sold--rented)
10. [Reference routes](#10-reference-routes)
11. [Errors](#11-errors)
12. [An n8n workflow](#12-an-n8n-workflow)
13. [Moving from version 1](#moving-from-version-1)

---

## 1. Setup (server)

Set these on the **API server** (`apps/api/.env`), then restart the API.

| Variable | Required | What it does |
| --- | --- | --- |
| `LISTING_API_KEY` | **yes** | The password for this API. A long random string (32+ characters). Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Empty or shorter than 16 characters = the API refuses every request. |
| `LISTING_API_OWNER_ID` | no | The user id that owns imported listings. Leave empty: the **first admin** owns them (recommended). |
| `LISTING_API_DEFAULT_STATUS` | no | `auto` (default), `approved`, `pending` or `draft` — see [section 7](#7-published-waiting-or-draft). |

Imported listings belong to the admin, so they are **not limited by any plan**
(no listing limit, no photo limit, no expiry) and are tagged `source: "api"` —
in Dashboard → Properties you can tell them apart from hand-added ones.

### Auth

Every request sends the key in a header:

```http
x-api-key: YOUR_KEY
```

(`Authorization: Bearer YOUR_KEY` also works.) Keep the key secret — anyone
with it can add listings.

### Base URL

```
https://propertydealer.pk/api/listing-api
```

Check everything is set up — the response also shows which user owns imports:

```bash
curl https://propertydealer.pk/api/listing-api/health -H "x-api-key: YOUR_KEY"
```

```json
{ "ok": true, "scope": "listings", "status": "authenticated", "version": 2, "owner": "6985d10eb2bce519a1bcdac4" }
```

---

## 2. Quick start

**1 — check it (optional, nothing is saved):** send the listing with `"dryRun": true`.
**2 — add it:** send the same thing without `dryRun`.
**3 — read it back:** `GET /listings/<id>`.

```bash
curl -X POST https://propertydealer.pk/api/listing-api/listings \
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{
    "externalId": "my-source-48213",
    "listingType": "sale",
    "propertyType": "house",
    "cityName": "Lahore",
    "areaName": "DHA Phase 6",
    "location": "Street 12, Block C",
    "latitude": 31.4697,
    "longitude": 74.4039,
    "title": "10 Marla Modern House For Sale in DHA Phase 6",
    "description": "Brand new, double storey, 5 bedrooms with attached baths…",
    "price": 65000000,
    "size": 10,
    "sizeUnit": "marla",
    "bedrooms": 5,
    "bathrooms": 6,
    "features": ["Corner", "Park facing", "Solar panels", "Servant quarter"],
    "contactNumber": "03001234567",
    "whatsappNumber": "03001234567",
    "mainPhotoUrl": "https://example.com/front.jpg",
    "additionalPhotosUrls": ["https://example.com/lounge.jpg", "https://example.com/kitchen.jpg"]
  }'
```

Response:

```json
{
  "success": true,
  "message": "Listing published.",
  "id": "6a6b8015ca4b0627bf58ed6b",
  "externalId": "my-source-48213",
  "slug": "10-marla-modern-house-for-sale-in-dha-phase-6-6a6b8015ca4b0627bf58ed6b",
  "url": "https://propertydealer.pk/properties/10-marla-modern-house-for-sale-in-dha-phase-6-6a6b8015ca4b0627bf58ed6b",
  "status": "approved",
  "availability": "available",
  "source": "api",
  "area": { "id": "69c500f969531e44f895f65b", "name": "dha phase 6", "city": "Lahore", "newArea": false },
  "size": { "areaSize": 2250, "marla": 10, "kanal": 0, "marlaSqft": 225 },
  "photos": 3,
  "warnings": []
}
```

Save `id` (or use your own `externalId`) to update the listing later.

---

## 3. Adding a listing — every field

`POST /listings` — JSON (photos as links), or `multipart/form-data` (photo
files, see [section 6](#6-photos-and-video)).

### Required

| Field | Example | Notes |
| --- | --- | --- |
| `listingType` | `"sale"` | `sale` or `rent` |
| `propertyType` | `"house"` | `house`, `apartment`, `flat`, `plot`, `land`, `commercial`, `shop`, `office`, `factory`, `hotel`, `restaurant`, `other`. Everyday words work too: home, villa, bungalow, portion, farmhouse → house; residential/commercial plot, file → plot; penthouse, studio → apartment; plaza, building, warehouse → commercial. |
| **where** | `cityName` + `areaName` | Or `area` (an id), or `cityName` + `societyName` + `subArea`. [Section 4](#4-location-city-area-society-map-pin). |
| `title` | `"10 Marla House For Sale in DHA Phase 6"` | Up to 150 characters. The web address is made from it (+ the id). |
| `price` | `65000000` | In rupees, a plain number. For rent: per month. |
| **size** | `size` + `sizeUnit` | Or `areaSize` (sq ft), or `marla` / `kanal`. [Section 5](#5-size). |
| `contactNumber` | `"03001234567"` | The number buyers call (the dealer or owner). `923001234567` and `+92 300 1234567` also work. |

### Optional (but fill them — they make the listing better)

| Field | Example | Notes |
| --- | --- | --- |
| `description` | `"Brand new double storey…"` | Up to 10,000 characters. Defaults to the title. |
| `location` | `"House 12, Street 4, Block C"` | The address line shown on the listing. Defaults to "Area, City". |
| `latitude`, `longitude` | `31.4697`, `74.4039` | The exact map pin (inside Pakistan). Send both or neither. |
| `bedrooms`, `bathrooms` | `5`, `6` | Ignored (0) for plots and land. |
| `features` | `["Corner", "Park facing"]` | Up to 40. In multipart: `features[0]`, `features[1]`, … or one comma-separated value. |
| `whatsappNumber` | `"03001234567"` | Defaults to `contactNumber`. |
| `mainPhotoUrl` | `"https://…/front.jpg"` | The cover photo. If left out, the first of `additionalPhotosUrls` is the cover. |
| `additionalPhotosUrls` | `["https://…/1.jpg"]` | More photos (30 in all at most). |
| `importImages` | `true` | Copy photos from other websites onto this site (default **true**). |
| `videoUrl`, `videoPosterUrl` | `"https://…/tour.mp4"` | A walkthrough video already uploaded, and its still image. |
| `marlaSqft` | `225` | Square feet in a marla: `225`, `250` or `272.25`. Defaults to the **city's** setting — leave it out. |
| `slug` | `"my-custom-address"` | Leave it out: addresses are made from the title + id. Use only to keep an exact address. |
| `status` | `"auto"` | `auto`, `approved`, `pending`, `draft` — [section 7](#7-published-waiting-or-draft). |
| `externalId` | `"zameen-48213"` | Your own id for the listing — [section 8](#8-no-duplicates-externalid). |
| `upsert` | `true` | With `externalId`: update it if it's already there. |
| `allowNewCity` | `true` | Allow a city that isn't on the site yet ([section 4](#4-location-city-area-society-map-pin)). |
| `dryRun` | `true` | Check everything and show what would be saved — nothing is saved, nothing is downloaded. |

---

## 4. Location: city, area, society, map pin

The site keeps one list of cities and areas (Dashboard → Areas): areas,
societies and their phases/blocks, some merged into others. The API uses that
list the same way the dashboard does, so **imports don't create duplicate or
misspelled areas**.

### Three ways to say where

```jsonc
// 1. Names (most common)
{ "cityName": "Lahore", "areaName": "DHA Phase 6" }

// 2. Society + its part — the API joins them ("Bahria Town Sector C")
{ "cityName": "Lahore", "societyName": "Bahria Town", "subArea": "Sector C" }

// 3. An area id, from GET /areas — exact, nothing to match
{ "area": "69c500f969531e44f895f65b" }
```

### How names are matched

- **City** — spelling, spaces and capitals don't matter, short names work
  (`lhr`, `isb`, `khi`, `rwp`, `pindi`, `fsd`…), and a one-letter mistake is
  forgiven (`Lahorr` → Lahore). A city that isn't on the site is **refused**
  with the closest names (`"closest": ["Rawalpindi", …]`), so a typo never
  creates a new city. To really add a new city, send `"allowNewCity": true`.
- **Area** — matched ignoring spaces, dashes and capitals: `DHA Phase-6`,
  `dha phase 6` and `DHAPhase6` are the same area. "Bahria Town Lahore" in
  Lahore matches "Bahria Town".
- **Merged areas** — if the admin merged an area into another, the listing goes
  to the area it was merged into.
- **A new area** — if it really isn't there, it's added (just like when an
  agent types a new area) and the admin gets a **Discord alert** ("📍 New area
  added") to check the spelling or merge it. The response says
  `"newArea": true`.

**Preview where a name will land** — nothing is saved:

```bash
curl -X POST https://propertydealer.pk/api/listing-api/areas/resolve \
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{ "cityName": "lhr", "areaName": "DHA Phase-6" }'
```

```json
{ "city": { "id": "698da1cc…", "name": "Lahore", "marlaSqft": 225 },
  "area": { "id": "69c500f9…", "name": "dha phase 6", "existing": true } }
```

**Tip:** for the best results, keep a small table in your workflow that maps
the source site's area names to our area ids (from `GET /areas`), and send
`area` once you know it.

### The map pin

Send `latitude` and `longitude` (decimal degrees, inside Pakistan) for the
exact spot. Without them the listing still appears on the map, at its area.

---

## 5. Size

Send the size **one** of these ways — the API stores it exactly like the
dashboard (square feet, plus the marla/kanal columns the size filters and
size pages use, using the city's marla):

| You send | Means |
| --- | --- |
| `"size": 10, "sizeUnit": "marla"` | 10 marla |
| `"size": 1, "sizeUnit": "kanal"` | 1 kanal (= 20 marla) |
| `"size": 500, "sizeUnit": "sqyd"` | 500 square yards (Karachi style) |
| `"size": 1800, "sizeUnit": "sqft"` | 1,800 sq ft (flats, offices) |
| `"size": 2, "sizeUnit": "acre"` | 2 acres |
| `"areaSize": 2250` | 2,250 sq ft (version 1 style) |
| `"marla": 5` / `"kanal": 1` | 5 marla / 1 kanal (version 1 style) |
| `"kanal": 1, "marla": 5` | 1 kanal 5 marla (= 25 marla) |

Units: `marla`, `kanal`, `sqft`, `sqyd`, `sqm`, `acre`. The response shows what
was saved: `"size": { "areaSize": 2250, "marla": 10, "kanal": 0, "marlaSqft": 225 }`.

---

## 6. Photos and video

**Up to 30 photos** per listing. JPEG, PNG, WebP or GIF, under 10 MB each.
The first one (or `mainPhotoUrl`) is the cover.

**A. Links (JSON)** — `mainPhotoUrl` + `additionalPhotosUrls`. Photos on other
websites are **copied onto this site** (so they never break or get blocked
later); turn it off with `"importImages": false`. A photo that can't be
downloaded is skipped and named in `warnings`.

**B. Files in the same request (multipart)** — fields `mainPhoto` (one file)
and `additionalPhotos` (repeat for each), with the other fields as text:

```bash
curl -X POST https://propertydealer.pk/api/listing-api/listings \
  -H "x-api-key: YOUR_KEY" \
  -F "listingType=sale" -F "propertyType=house" \
  -F "cityName=Lahore" -F "areaName=Johar Town" \
  -F "title=5 Marla House For Sale in Johar Town" \
  -F "price=21500000" -F "size=5" -F "sizeUnit=marla" \
  -F "bedrooms=3" -F "bathrooms=4" -F "contactNumber=03001234567" \
  -F "features[0]=Corner" -F "features[1]=Near park" \
  -F "mainPhoto=@front.jpg" \
  -F "additionalPhotos=@lounge.jpg" -F "additionalPhotos=@kitchen.jpg"
```

**C. Upload first, then use the links** — handy in n8n loops:

```bash
curl -X POST https://propertydealer.pk/api/listing-api/uploads \
  -H "x-api-key: YOUR_KEY" -F "files=@1.jpg" -F "files=@2.jpg"
```

```json
{ "files": [ { "key": "properties/2026/…jpg", "url": "/uploads/properties/2026/…jpg" }, { "key": "…", "url": "…" } ] }
```

(One file with field `file` → `{ "key": "…", "url": "…" }`.) Then send the `url`s
as `mainPhotoUrl` / `additionalPhotosUrls`.

**Video** — `videoUrl` (a video already hosted) and `videoPosterUrl` (its
still). A listing with only a video uses the poster as its cover.

---

## 7. Published, waiting or draft

`status` (or `LISTING_API_DEFAULT_STATUS` on the server) decides what happens:

| Status | What happens |
| --- | --- |
| `auto` **(default)** | The site's **listing checker** looks at it — the same one that checks agents' listings (prices that make no sense, spam text, phone numbers in the description, copied listings…). Clean → **published at once**. Questionable → **waits** in Dashboard → Properties, and the response says why: `"heldBecause": ["…"]`. |
| `approved` | Published at once, no check. Use only for a source you fully trust. |
| `pending` | Always waits for the admin to approve. |
| `draft` | Saved but not public — publish it later from the dashboard. |

**Tip:** listings with a real description, several photos and a plausible
price per marla are published at once. A listing with no photos, a one-line
description, or a phone number written in the text is usually held.

A published listing appears straight away on its area, city, size and search
pages, the map, the sitemap and in "new in your area" alerts; Discord gets the
usual new-listing alert.

---

## 8. No duplicates: `externalId`

Automations run again and again. Send **your own id** for each listing (for
example the source website's listing number) as `externalId`:

- First time: the listing is added and remembers it.
- Sent again: nothing is added — the response is the existing listing with
  `"duplicate": true`.
- Sent again **with `"upsert": true`**: the existing listing is **updated**
  with what you sent (new price, photos…).

Without `externalId`, the API still refuses an obvious copy (same title, price
and area added through the API in the last 60 days).

Find a listing by your id: `GET /listings?externalId=my-source-48213`, or use
`ext:my-source-48213` anywhere a listing id goes.

---

## 9. Updating, sold / rented

**Change a listing** — send only what changes:

```bash
curl -X PATCH https://propertydealer.pk/api/listing-api/listings/ext:my-source-48213 \
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{ "price": 62000000, "description": "Price reduced — urgent sale." }'
```

- `:id` can be the listing id, its slug, or `ext:<your externalId>`.
- Location and size fields work as when adding (send all of `cityName` +
  `areaName`, or `area`).
- Photos sent **replace** the whole gallery; leave them out to keep the photos.
- `status` here can publish or hide it (`approved`, `pending`, `draft`).
- A changed title gives the listing a new address; the old one keeps working
  (redirects).

**Sold or rented:**

```bash
curl -X PATCH https://propertydealer.pk/api/listing-api/listings/ext:my-source-48213/availability \
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{ "availability": "sold" }'
```

`sold`, `rented`, or `available` (back on the market). A sold/rented listing
stays visible for a short while marked as such, then leaves the lists — the
same as when an agent marks it.

**Check a listing:** `GET /listings/<id>` →

```json
{ "id": "…", "externalId": "my-source-48213", "slug": "…", "url": "https://propertydealer.pk/properties/…",
  "status": "approved", "availability": "available", "source": "api",
  "title": "…", "price": 62000000, "views": 148, "expiresAt": null,
  "createdAt": "…", "updatedAt": "…" }
```

A listing waiting for approval also shows `"heldBecause": [ … ]`.

The API never deletes listings; delete from the dashboard if needed.

---

## 10. Reference routes

| Route | Gives |
| --- | --- |
| `GET /health` | Key works; who owns imports. |
| `GET /reference` | Everything at once: listing types, property types, size units, statuses, availability values, and all cities (id, name, marla size, number of areas). |
| `GET /property-types` | `{ "types": [...] }` |
| `GET /cities` | `{ "cities": [ { "_id", "name", "marlaSqft", "areas" } ] }` |
| `GET /areas?cityName=Lahore` | The city's areas: `_id`, `name`, `areaSlug`, `city`, `kind` (`area` / `society`), `parent` (the society a phase belongs to). Also `?cityId=`, `?q=bahria` to filter, `?limit=`. Merged areas are left out. |
| `POST /areas/resolve` | Where a name would land, without saving ([section 4](#4-location-city-area-society-map-pin)). |
| `POST /uploads` | Upload images ([section 6](#6-photos-and-video)). |

---

## 11. Errors

Clear messages, all problems at once:

```json
{
  "statusCode": 400,
  "message": {
    "message": "The listing could not be added.",
    "errors": [
      "propertyType \"castle\" is not known. Use one of: house, apartment, flat, …",
      "price (PKR, a number above 0) is required."
    ],
    "warnings": []
  }
}
```

| Code | Means |
| --- | --- |
| `200 / 201` | Done (check `duplicate` and `warnings`). |
| `400` | Something to fix — read `errors`. |
| `401` | Missing or wrong key, or the server has no `LISTING_API_KEY`. |
| `404` | Listing not found (update / availability / read). |
| `429` | Too fast — slow down (keep it under ~10 listings a second). |

`warnings` never stop a listing; they tell you what would make it better (no
photos, no map pin, a photo that couldn't be copied, a new area was added).

---

## 12. An n8n workflow

1. **Schedule / Webhook** — when to run.
2. **Get the listings** from your source (HTTP Request / RSS / Sheets…).
3. **Loop over items**.
4. **Map fields** (Set node): `externalId` = the source's id, `listingType`,
   `propertyType`, `cityName`, `areaName`, `title`, `description`, `price`,
   `size` + `sizeUnit`, `bedrooms`, `bathrooms`, `contactNumber`,
   `latitude`/`longitude`, `mainPhotoUrl`, `additionalPhotosUrls`, `features`.
5. **HTTP Request** → `POST https://propertydealer.pk/api/listing-api/listings`,
   header `x-api-key`, JSON body, with `"upsert": true` so re-runs update
   prices instead of adding copies.
6. **IF** `{{$json.status}}` is `pending` → send yourself the `heldBecause`
   reasons; if the request failed → log `message.errors`.
7. Later runs: listing gone from the source → `PATCH …/listings/ext:<id>/availability`
   with `sold` or `rented`.

Settings for the HTTP node: *Response → Never error* off, *Retry on fail* on
(3 tries, 5 s), *Batch size* 1–5.

---

## Moving from version 1

Everything from version 1 still works the same — same routes, same field
names, same responses (now with more fields). To get the most from version 2:

| | Version 1 | Version 2 — what to change |
| --- | --- | --- |
| **Status** | Always `draft`; the admin published each one. | `auto` by default: clean listings go **live at once**, questionable ones wait with reasons. Want the old way? `"status": "draft"` or `LISTING_API_DEFAULT_STATUS=draft`. |
| **Areas** | New area for every spelling (`DHA Phase-6` and `dha phase 6` became two areas); **cities created for any typo**. | Matched to existing areas, merged areas followed, the admin told about real new ones. Unknown cities are refused — check the error's `closest`, or send `allowNewCity`. |
| **Size** | `areaSize` + `marla`/`kanal`, with 1 kanal stored the old way. | Send `size` + `sizeUnit` (or keep `areaSize`). Stored like the dashboard (1 kanal = `marla 20, kanal 1`, the city's marla). |
| **Address** | Made from the title only. | Title + id, like every new listing (`/properties/<title>-<id>`). |
| **WhatsApp** | `whatsappNumber` was accepted but never saved. | Saved; defaults to the contact number. |
| **Photos** | Other sites' photo links were used as they were (and break when that site removes them). | Copied onto this site; up to 30; files or links. |
| **Video** | — | `videoUrl` + `videoPosterUrl`. |
| **Duplicates** | Every run added the listings again. | `externalId` (+ `upsert`) — **add this**. Obvious copies are refused even without it. |
| **After adding** | Only read the status. | `PATCH /listings/:id` to update, `PATCH /listings/:id/availability` for sold/rented. |
| **Checking** | — | `dryRun: true`, `POST /areas/resolve`, `GET /reference`. |
| **Required fields** | `location`, `description`, `bedrooms`, `bathrooms` were required. | Optional (sensible defaults). Required: listingType, propertyType, where, title, price, size, contactNumber. |
| **Upload folder** | `properties/` | `properties/<year>/` (old links keep working). |

**Checklist for the developer:**

1. Add `externalId` (the source's id) to every listing, and `upsert: true`.
2. Replace `areaSize`/`marla`/`kanal` with `size` + `sizeUnit` (optional — the old fields still work).
3. Send `latitude`/`longitude` when the source has them.
4. Decide on `status`: leave `auto` (recommended), or `draft` to keep reviewing every import.
5. Handle `duplicate: true` (skip) and `warnings` (log) in the response.
6. Add a step that marks listings `sold`/`rented` when they disappear from the source.
7. Run once with `"dryRun": true` on a few real items and check `wouldCreate`.
