# Listing API (for n8n / external automation)

This is a narrow, API-key-protected interface intended to be used by automation
tools such as n8n to push new property listings into the platform. Submissions
land as **drafts** and an admin must review/publish them before they become
visible on the public site.

> **Scope is intentionally limited.** This API does not expose user data,
> deletions, or admin actions — only enough surface to create draft listings
> and look up reference data (cities, areas, property types).

## Configuration (server)

Set the following environment variables on the API server:

| Variable | Required | Description |
| --- | --- | --- |
| `LISTING_API_KEY` | yes | Long random string (>= 32 chars). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `LISTING_API_OWNER_ID` | optional | ObjectId of the user that should own listings created via the API. Defaults to the first ADMIN. |

If `LISTING_API_KEY` is empty or shorter than 16 chars, every request to
`/api/listing-api/*` is rejected (fail-closed).

## Auth

Send the key in the `x-api-key` request header. `Authorization: Bearer <key>` is
also accepted as a fallback.

```http
x-api-key: 9f1c...your-32+char-key...3d
```

## Base URL

```
https://<your-domain>/api/listing-api
```

## Endpoints

### `GET /health`

Sanity check. Useful as the first node in an n8n workflow to verify the key is
configured correctly.

```json
{ "ok": true, "scope": "listings", "status": "authenticated" }
```

### `GET /property-types`

Returns the list of accepted `propertyType` values.

```json
{ "types": ["house", "apartment", "flat", "commercial", "land", "shop", "office", "factory", "hotel", "restaurant", "plot", "other"] }
```

### `GET /cities`

Returns all cities — useful to map a free-form city name to an `_id`.

```json
{ "cities": [ { "_id": "...", "name": "lahore" }, ... ] }
```

### `GET /areas?cityId=<id>`

Returns areas, optionally filtered by city.

```json
{ "areas": [ { "_id": "...", "name": "dha phase 5", "areaSlug": "dha-phase-5", "city": "..." } ] }
```

### `POST /uploads`

Upload one or more images (`multipart/form-data`) and get back public URL(s)
you can pass to `/listings`.

| Field | Type | Description |
| --- | --- | --- |
| `file` | file | Single image upload |
| `files` | file(s) | Multiple images — repeat the field for each file |

**Single file response:**

```json
{ "key": "properties/...", "url": "https://.../properties/..." }
```

**Multiple files response:**

```json
{
  "files": [
    { "key": "properties/...", "url": "https://.../properties/1.jpg" },
    { "key": "properties/...", "url": "https://.../properties/2.jpg" }
  ]
}
```

Allowed types: JPEG, PNG, WebP, GIF. Max size: 10 MB per file.

**cURL example (single):**

```bash
curl -X POST "https://<your-domain>/api/listing-api/uploads" \
  -H "x-api-key: YOUR_KEY" \
  -F "file=@/path/to/photo.jpg"
```

**cURL example (multiple):**

```bash
curl -X POST "https://<your-domain>/api/listing-api/uploads" \
  -H "x-api-key: YOUR_KEY" \
  -F "files=@/path/to/1.jpg" \
  -F "files=@/path/to/2.jpg"
```

### `POST /listings`

Create a draft property. Supports **two content types**:

#### Option A — JSON with image URLs

Use when images are already hosted, or after uploading via `/uploads`.

`Content-Type: application/json`

Either provide `area` (an Area ObjectId) **or** both `cityName` + `areaName`
(the API will look up / auto-create the area for you).

```json
{
  "listingType": "sale",
  "propertyType": "house",
  "cityName": "Lahore",
  "areaName": "DHA Phase 5",
  "title": "5 Marla Modern House",
  "location": "Street 12, DHA Phase 5",
  "bedrooms": 3,
  "bathrooms": 3,
  "areaSize": 1125,
  "price": 32500000,
  "marla": 5,
  "kanal": 0,
  "description": "Beautifully designed corner house ...",
  "contactNumber": "923001234567",
  "whatsappNumber": "923001234567",
  "features": ["Marble flooring", "Solar ready"],
  "latitude": 31.4697,
  "longitude": 74.4039,
  "mainPhotoUrl": "https://.../properties/main.jpg",
  "additionalPhotosUrls": [
    "https://.../properties/1.jpg",
    "https://.../properties/2.jpg"
  ]
}
```

#### Option B — multipart with direct image upload

Upload images in the same request (same field names as the dashboard).

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `listingType` | text | yes | `rent` or `sale` |
| `propertyType` | text | yes | e.g. `house`, `apartment` |
| `cityName` + `areaName` | text | yes* | Area lookup / auto-create |
| `area` | text | yes* | Area ObjectId (alternative to names) |
| `title` | text | yes | Listing title |
| `location` | text | yes | Address / location |
| `bedrooms` | text | yes | Number |
| `bathrooms` | text | yes | Number |
| `areaSize` | text | yes | Size in sq ft |
| `price` | text | yes | Price in PKR |
| `description` | text | yes | Full description |
| `contactNumber` | text | yes | e.g. `923001234567` |
| `mainPhoto` | file | no | Main property image |
| `additionalPhotos` | file(s) | no | Extra images — repeat field |
| `features[0]`, `features[1]`, … | text | no | Feature list |

\* Provide either `area` **or** both `cityName` + `areaName`.

**cURL example (with images):**

```bash
curl -X POST "https://<your-domain>/api/listing-api/listings" \
  -H "x-api-key: YOUR_KEY" \
  -F "listingType=sale" \
  -F "propertyType=house" \
  -F "cityName=Lahore" \
  -F "areaName=DHA Phase 5" \
  -F "title=5 Marla Modern House" \
  -F "location=Street 12, DHA Phase 5" \
  -F "bedrooms=3" \
  -F "bathrooms=3" \
  -F "areaSize=1125" \
  -F "price=32500000" \
  -F "description=Beautiful corner house" \
  -F "contactNumber=923001234567" \
  -F "mainPhoto=@/path/to/main.jpg" \
  -F "additionalPhotos=@/path/to/1.jpg" \
  -F "additionalPhotos=@/path/to/2.jpg"
```

You can also mix uploaded files with URL fields (`mainPhotoUrl`,
`additionalPhotosUrls`) in the same multipart request.

Response:

```json
{
  "success": true,
  "message": "Draft listing created. An admin will review and publish it.",
  "id": "...",
  "status": "draft",
  "slug": "5-marla-modern-house"
}
```

### `GET /listings/:id`

Returns a minimal status payload — handy for n8n to poll/log the result.

```json
{ "id": "...", "slug": "...", "title": "...", "status": "draft", "source": "api", "createdAt": "...", "updatedAt": "..." }
```

## Workflow notes

- **Images — two supported flows:**
  1. **Direct upload:** send `mainPhoto` / `additionalPhotos` files in
     `POST /listings` (multipart), same as the dashboard.
  2. **Upload then create:** call `POST /uploads` for each image (or batch via
     `files`), then pass returned `url` values as `mainPhotoUrl` /
     `additionalPhotosUrls` in `POST /listings` (JSON). Useful for n8n loops.
- Every API-created listing is forced to `status: 'draft'` and tagged
  `source: 'api'` — an admin reviews and publishes them from the dashboard.
- Drafts are excluded from all public-facing endpoints (`/api/properties`, slug
  lookup, sitemap, etc.) and do not consume any subscription quota.
- An admin can publish a draft from the dashboard property list (Send icon) or
  from the property edit page (Publish button shown when status is draft).
