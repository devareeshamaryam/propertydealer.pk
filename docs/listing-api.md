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

Upload a single image (multipart/form-data, field `file`) and get back a public
URL you can pass to `/listings`.

```json
{ "key": "properties/...", "url": "https://.../properties/..." }
```

### `POST /listings`

Create a draft property. Body is `application/json`.

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

- Every API-created listing is forced to `status: 'draft'` and tagged
  `source: 'api'` — an admin reviews and publishes them from the dashboard.
- Drafts are excluded from all public-facing endpoints (`/api/properties`, slug
  lookup, sitemap, etc.) and do not consume any subscription quota.
- An admin can publish a draft from the dashboard property list (Send icon) or
  from the property edit page (Publish button shown when status is draft).
