# Caching, Revalidation & Security Hardening

This document explains how the Property Dealer stack now caches data, when
caches are invalidated, and the new security guarantees baked into the API
layer. The strategy is **conservative / fresh-first** by user preference:
60-second TTLs everywhere with **instant invalidation** the moment an admin
writes anything that affects public pages.

---

## High-level data flow

```
   ┌──────────────┐    POST /api/...   ┌────────────────┐
   │  Admin / API │ ─────────────────► │ NestJS API     │
   └──────────────┘                    │                │
                                       │  ┌──────────┐  │
                                       │  │ Mongo    │  │
                                       │  └──────────┘  │
                                       │  ┌──────────┐  │
                                       │  │ Redis    │  │  ⚡ 60s cache
                                       │  └──────────┘  │
                                       │       │        │
                                       │       ▼        │
                                       │ RevalidateSvc  │
                                       │       │        │
                                       └───────┼────────┘
                                               │  POST /api/revalidate
                                               │  (x-revalidate-secret)
                                               ▼
                                       ┌────────────────┐
                                       │ Next.js (web)  │
                                       │ revalidateTag  │
                                       │ revalidatePath │
                                       └────────────────┘
```

Two independent caches serve **the same** read path:

1. **Redis (API layer)** — wraps every hot DB read in `RedisCacheService.wrap()`
   for 60 s. Skips itself silently if Redis is unreachable.
2. **Next.js fetch cache (web layer)** — every `serverApi.*` call uses
   `next.revalidate = 60` plus a `tags: [...]` array.

Writes call `RevalidateService.revalidate({ tags, paths })`, which:

- deletes the matching keys from Redis (so the next API request recomputes),
- POSTs to `/api/revalidate` on the web app, which calls
  `revalidateTag(...)` and `revalidatePath(...)`.

The webhook never throws; if it fails the worst case is the public site
shows slightly stale data until the natural 60 s TTL elapses.

---

## Required environment variables

### API (`apps/api/.env`)

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | **Required.** API now refuses to start without it (no more hardcoded Atlas fallback). |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Existing. |
| `REDIS_URL` | Default `redis://127.0.0.1:6379`. |
| `REDIS_ENABLED` | Set to `false` to bypass cache entirely. |
| `WEB_URL` | Public URL of the Next.js front-end (used to call `/api/revalidate`). |
| `REVALIDATE_SECRET` | Long random string, must match the web env. |
| `LISTING_API_KEY` | Existing — Listing-API key for n8n. |

### Web (`apps/web/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public URL of the API. |
| `INTERNAL_API_URL` | (Optional) faster URL when API is on the same host. |
| `REVALIDATE_SECRET` | **Must match** the API value above. |

Both secrets should be generated once and kept identical:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## What is cached and for how long

All TTLs are 60 s unless noted.

| Endpoint | Tag(s) | Notes |
| --- | --- | --- |
| `GET /properties` | `properties` | Full filter set is hashed into the key. |
| `GET /properties/types` | `property-types` | Tiny payload, very high QPS. |
| `GET /properties/slug/:slug` | `properties`, `property:slug:<slug>` | Per-slug bust on edit. |
| `GET /properties/stats/locations` | `properties` | Aggregation-heavy. |
| `GET /cities`, `GET /cities/name/:name` | `cities` | |
| `GET /areas`, `GET /areas?cityId=...` | `areas` | |
| `GET /blog/published` | `blogs` | `findBlogBySlug` is **not** cached because it increments view counts. |
| `GET /page/published`, `GET /page/slug/:slug` | `pages`, `page:slug:<slug>` | |
| `GET /material-rate?...`, `GET /material-rate/slug/:slug` | `material-rates` | All today-`<material>`-rate pages share this tag. |

---

## What busts what (write → invalidation table)

| Write | Tags busted | Paths revalidated |
| --- | --- | --- |
| Property created (status=approved) / approved / edited / deleted | `properties`, `property-types`, `property:slug:<slug>` | `/`, `/properties`, `/p/<slug>` |
| Property status flipped (draft↔pending↔approved↔rejected) | same as above | same |
| City CRUD | `cities` | `/`, `/properties` |
| Area CRUD | `areas` | `/properties` |
| Blog created / updated / deleted | `blogs`, `blog:slug:<slug>` | `/`, `/blog`, `/blog/<slug>` |
| Page created / updated / deleted | `pages`, `page:slug:<slug>` | `/<slug>` |
| Material rate (cement/sand/steel/wood/door/bajri/tile/bricks) created/updated/deleted | `material-rates` | `/today-<material>-rate-in-pakistan` |

Drafts never bust caches because they aren't visible publicly.

---

## Security improvements

### Rate limiting (was previously a silent no-op)

Even though the auth controller was decorated with `@Throttle({ default: { limit: 5, ttl: 60000 } })`, **`ThrottlerModule` was never imported**, which meant the decorator did nothing. We now register `ThrottlerModule.forRoot([...])` with three buckets and bind `ThrottlerGuard` as a global guard via `APP_GUARD`. Concrete limits:

| Bucket | Window | Limit |
| --- | --- | --- |
| `short` | 1 s | 10 req/IP |
| `medium` | 60 s | 120 req/IP |
| `long` | 1 h | 5 000 req/IP |

The existing `@Throttle({ default: { limit: 5, ttl: 60000 } })` on `/auth/login` and `/auth/register` continues to work and now actually enforces the stricter cap.

### MongoDB credentials hardening

The previous `app.module.ts` fell back to a hardcoded `mongodb+srv://admin:admin1234@...` connection string when `MONGODB_URI` was missing. This was removed; the API now throws a clear startup error instead of silently connecting to a default Atlas cluster.

### Listing API guard (no change in this pass — already strong)

The `/api/listing-api/*` endpoints are still guarded by `ApiKeyGuard` with constant-time comparison and fail-closed behaviour when `LISTING_API_KEY` is missing or under 16 characters.

### Revalidation webhook

`/api/revalidate` is gated by a shared secret in the `x-revalidate-secret` header (constant-time compare in the route handler). Refuses every request when the secret isn't configured — fail-closed.

### Other security still in place (unchanged)

- `helmet` security headers + HSTS + frame-options + Content-Type protection.
- Cookies are `httpOnly`, `secure` in production, `SameSite=None` in production for cross-domain auth.
- HTTPS redirect in production.
- CSP allows `'self'` plus inline styles only; images allow http/https/data.
- Strict CORS allowlist.

---

## How to verify

### Cache hit / miss (API)

```bash
# First call — cache miss, populates Redis
curl -s http://localhost:3010/api/cities | jq '.[0].name'

# Inspect Redis
redis-cli KEYS 'pd:*' | head
redis-cli TTL "pd:cities:all:"
```

### Tag-based invalidation

```bash
# Update a city as admin in the dashboard, then watch
redis-cli MONITOR
# you should see DEL on pd:cities:all:* and the tag set 'pd:tag:cities'
```

### Web revalidation webhook

```bash
# health
curl -s https://propertydealer.pk/api/revalidate

# manual revalidation (replace SECRET with $REVALIDATE_SECRET)
curl -s -X POST https://propertydealer.pk/api/revalidate \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -H "content-type: application/json" \
  --data '{"tags":["properties"],"paths":["/properties"]}'
```

### Throttling

```bash
# 6 fast requests should produce one 429 from the auth limiter (5/min)
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://propertydealer.pk/api/auth/login \
    -H "content-type: application/json" \
    --data '{"email":"a@b.c","password":"x"}'
done
```

---

## Operational notes

- **No node_modules in repo** — after pulling these changes run `npm install` once at the root and rebuild.
- **Restart order matters**: redeploy the API first (it now requires `MONGODB_URI`), then the web.
- If Redis goes down the API keeps serving (logs a single warning, falls back to direct DB reads); response times will rise but nothing breaks.
- If `WEB_URL` / `REVALIDATE_SECRET` are unset the API runs fine but Next.js pages take up to 60 s to refresh after admin writes.
