import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

/*
 * What the site's sitemaps list, in one light, cached read:
 *
 *   - every live listing (slug, last change, main photo),
 *   - every published blog post,
 *   - the archive pages that actually have listings: city, city + type,
 *     city + area and city + area + type, per purpose (sale / rent / all).
 *
 * The sitemaps used to list every city × area × type × purpose combination
 * (15,600 URLs, most of them empty pages), listing URLs under a route that
 * does not exist (/p/<slug>, all 404), only the first 50 listings, and a blog
 * sitemap that never finished. Raw collections throughout: `area`, `city` and
 * `owner` are stored as ObjectId on some rows and as strings on others.
 */

const TYPES = new Set(['house', 'apartment', 'flat', 'plot', 'shop', 'office', 'land', 'commercial', 'factory', 'hotel', 'restaurant']);
const slugOf = (s: string) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, '-');

@Injectable()
export class SeoService {
  constructor(
    @InjectConnection() private readonly db: Connection,
    private readonly cache: RedisCacheService,
  ) {}

  async sitemapData() {
    return this.cache.wrap(this.cache.buildKey('seo:sitemap-data', []), () => this.build(), { ttl: 3600, tags: ['properties', 'blogs', 'areas', 'cities'] });
  }

  private async build() {
    const graceDays = 15;
    const graceCutoff = new Date(Date.now() - graceDays * 864e5);
    const live = {
      status: 'approved',
      $or: [{ availability: { $nin: ['sold', 'rented'] } }, { availabilityChangedAt: { $gt: graceCutoff } }],
    };

    const [props, areas, cities, blogs] = await Promise.all([
      this.db
        .collection('properties')
        .find(live, { projection: { slug: 1, updatedAt: 1, createdAt: 1, area: 1, listingType: 1, propertyType: 1, mainPhotoUrl: 1, title: 1, availability: 1 } })
        .toArray(),
      this.db.collection('areas').find({}, { projection: { areaSlug: 1, city: 1, mergedInto: 1, hidden: 1, updatedAt: 1 } }).toArray(),
      this.db.collection('cities').find({}, { projection: { name: 1, updatedAt: 1 } }).toArray(),
      this.db
        .collection('blogs')
        .find({ status: 'published' }, { projection: { slug: 1, updatedAt: 1, createdAt: 1, featuredImage: 1, title: 1 } })
        .toArray(),
    ]);

    const citySlug = new Map(cities.map((c: any) => [String(c._id), slugOf(c.name)]));
    const areaById = new Map(areas.map((a: any) => [String(a._id), a]));
    // A merged duplicate's listings belong to the area it points to (whose page is the canonical one).
    const resolveArea = (id: string) => {
      let a: any = areaById.get(id);
      for (let i = 0; a?.mergedInto && i < 3; i++) a = areaById.get(String(a.mergedInto)) ?? a;
      return a;
    };

    const counts = new Map<string, { path: string; n: number; lastmod: number }>();
    const add = (path: string, at: number) => {
      const c = counts.get(path);
      if (c) {
        c.n++;
        c.lastmod = Math.max(c.lastmod, at);
      } else counts.set(path, { path, n: 1, lastmod: at });
    };

    const listings: { slug: string; lastmod: string; image?: string; title?: string }[] = [];
    for (const p of props as any[]) {
      if (!p.slug) continue;
      const at = new Date(p.updatedAt ?? p.createdAt ?? Date.now()).getTime();
      listings.push({ slug: p.slug, lastmod: new Date(at).toISOString().slice(0, 10), image: p.mainPhotoUrl || undefined, title: p.title || undefined });

      const area = p.area ? resolveArea(String(p.area)) : null;
      if (!area || area.hidden) continue;
      const city = citySlug.get(String(area.city));
      if (!city) continue;
      const purpose = p.listingType === 'rent' ? 'rent' : 'sale';
      const type = String(p.propertyType ?? '').toLowerCase();
      for (const pp of [purpose, 'all']) {
        add(`/properties/${pp}/${city}`, at);
        if (TYPES.has(type)) add(`/properties/${pp}/${city}/${type}`, at);
        if (area.areaSlug) {
          add(`/properties/${pp}/${city}/${area.areaSlug}`, at);
          if (TYPES.has(type)) add(`/properties/${pp}/${city}/${area.areaSlug}/${type}`, at);
        }
      }
    }

    const day = (t: number) => new Date(t).toISOString().slice(0, 10);
    const archives = [...counts.values()]
      .map((c) => ({ path: c.path, count: c.n, lastmod: day(c.lastmod), depth: c.path.split('/').length - 1 }))
      .sort((a, b) => a.depth - b.depth || b.count - a.count);

    return {
      generatedAt: new Date().toISOString(),
      listings,
      archives,
      blogs: (blogs as any[])
        .filter((b) => b.slug)
        .map((b) => ({
          slug: b.slug,
          lastmod: day(new Date(b.updatedAt ?? b.createdAt ?? Date.now()).getTime()),
          image: b.featuredImage || undefined,
          title: b.title || undefined,
        })),
    };
  }
}

export const isObjectId = (v: unknown) => Types.ObjectId.isValid(String(v));
