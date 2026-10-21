import { AgencyService } from '../agency/agency.service';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Property } from '@rent-ghar/db/schemas/property.schema'
import { ListingBrainService } from './listing-brain.service'
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { InjectModel} from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePropertyDto } from './dto/create-property.dto';
import { Area } from '@rent-ghar/db/schemas/area.schema';
import { City } from '@rent-ghar/db/schemas/city.schema';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { IndexNowService } from '../indexnow/indexnow.service';
import { ConfigService } from '@nestjs/config';
import { distinct } from 'rxjs';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

// Cache tags used across all property reads. Any write that affects public
// listings should invalidate at least 'properties'. Slug-specific reads also
// register against 'property:slug:<slug>' so individual pages can be busted.
const TAG_PROPERTIES = 'properties';
const TAG_PROPERTY_TYPES = 'property-types';

/** Filters accepted by the dashboard list endpoint. */
export interface DashboardPropertyFilters {
    cityId?: string;
    areaId?: string;
    status?: string;
    propertyType?: string;
    listingType?: string;
    search?: string;
    page?: number;
    /** 0 means "every row in one page", capped at DASHBOARD_MAX_LIMIT. */
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    /** One agent's listings — an agency owner's team member, or anyone for an admin. */
    ownerId?: string;
}

export interface DashboardPropertyPage {
    properties: any[];
    total: number;
    totalPages: number;
    currentPage: number;
    limit: number;
}

const DASHBOARD_DEFAULT_LIMIT = 25;
/** Ceiling on a single dashboard page, including `limit=0`. */
const DASHBOARD_MAX_LIMIT = 500;

/**
 * Fields the dashboard list is allowed to sort by. Anything else falls back to
 * createdAt, so a hand-edited query string cannot make Mongo sort on an
 * unindexed field.
 */
const DASHBOARD_SORTABLE = new Set([
    'createdAt',
    'updatedAt',
    'title',
    'price',
    'status',
    // Performance: an agent's first question is which listing is working.
    'views',
    'impressions',
    'phoneClicks',
    'whatsappClicks',
    'propertyType',
    'location',
]);

/**
 * Only the fields the dashboard table and its preview actually read. The old
 * query returned whole documents including `description`, which is the single
 * largest field on a property and is never shown in the list.
 */
const DASHBOARD_LIST_FIELDS = [
    'title',
    'slug',
    'listingType',
    'propertyType',
    'location',
    'city',
    'area',
    'bedrooms',
    'bathrooms',
    'areaSize',
    'marla',
    'kanal',
    'price',
    'status',
    'isFeatured',
    // Sold / rented, and when — the row carries the control that sets it.
    'availability',
    'availabilityChangedAt',
    'source',
    'mainPhotoUrl',
    'contactNumber',
    // Why a listing is in the approval queue — shown on the row so the admin
    // does not have to open each one to find out.
    'moderationScore',
    'moderationReasons',
    'autoPublished',
    // Performance counters, shown as a column in the list.
    'views',
    'impressions',
    'phoneClicks',
    'whatsappClicks',
    'owner',
    'createdAt',
    'updatedAt',
].join(' ');

@Injectable()
export class PropertyService {
    /**
     * How long a sold or rented listing stays in the public lists.
     *
     * Long enough for anyone who saw it this week to find it again and see
     * what happened, short enough that search is not full of houses nobody
     * can buy. Zameen and OLX both keep closed listings around for roughly
     * this long before dropping them out of browse.
     */
    static readonly AVAILABILITY_GRACE_DAYS = 15;

    /** How long a Free-plan listing stays live before it needs renewing. */
    static readonly FREE_LISTING_DAYS = 30;

    /** Settings → General → Listings: days a sold/rented listing stays in the lists. */
    private async graceCutoff(): Promise<Date> {
        let days = PropertyService.AVAILABILITY_GRACE_DAYS;
        try {
            days = (await this.siteSettings.get()).soldGraceDays;
        } catch {
            // settings unreachable: keep the default
        }
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    /** Fields a results card never shows — left out of list responses. */
    static readonly LIST_EXCLUDE =
      '-description -moderationScore -moderationReasons -moderationSource -autoPublished -subscriptionId -__v';

    static escapeRegex(value: string): string {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    constructor(
        @InjectModel(Property.name) private propertyModel: Model<Property>,
        @InjectModel(Area.name) private areaModel: Model<Area>,
        @InjectModel(City.name) private cityModel: Model<City>,
        private subscriptionService: SubscriptionService,
        private readonly brain: ListingBrainService,
        private readonly discord: DiscordService,
        private indexNowService: IndexNowService,
        private configService: ConfigService,
        private readonly cache: RedisCacheService,
        private readonly revalidate: RevalidateService,
        private readonly siteSettings: SiteSettingsService,
        private readonly agency: AgencyService,
    ) {}

    /**
     * Drop every cache entry tied to public property listings and ping the
     * Next.js front-end so its ISR pages re-render. Called on every write.
     * Optionally pass an `affectedSlug` to also bust the per-property page.
     */
    private async bustPropertyCaches(affectedSlug?: string) {
        const tags = [TAG_PROPERTIES, TAG_PROPERTY_TYPES];
        const paths = ['/', '/properties'];
        if (affectedSlug) {
            tags.push(`property:slug:${affectedSlug}`);
            // The listing's real address is /properties/<slug>; /p/ is the
            // short alias. Both, or a "Sold" mark waits for the cache to expire.
            paths.push(`/properties/${affectedSlug}`, `/p/${affectedSlug}`);
        }
        await this.revalidate.revalidate({ tags, paths });
    }

    private toSlug(value: string): string {
        return value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

    private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
        if (!baseSlug) return '';
        let slug = baseSlug;
        let isUnique = false;
        let counter = 1;
        
        while (!isUnique) {
            const query: any = { slug };
            if (excludeId) {
                query._id = { $ne: excludeId };
            }
            const existing = await this.propertyModel.findOne(query).select('_id').lean().exec();
            if (!existing) {
                isUnique = true;
            } else {
                slug = `${baseSlug}-${counter}`;
                counter++;
            }
        }
        return slug;
    }

    private isValidObjectId(value: unknown): boolean {
        return typeof value === 'string' && Types.ObjectId.isValid(value);
      }

    private isValidAreaRef(area: unknown): boolean {
        if (!area) return false;
        if (typeof area === 'string') return this.isValidObjectId(area);
        if (area instanceof Types.ObjectId) return true;
        if (typeof area === 'object' && '_id' in (area as any)) {
          const id = (area as any)._id;
          return typeof id === 'string' ? this.isValidObjectId(id) : id instanceof Types.ObjectId;
        }
        return false;
      }

    /**
     * One-off backfill for legacy rows created before slugs were written on
     * save. Exposed for `src/scripts/backfill-slugs.ts`; deliberately NOT
     * called from any read path — it issues a find+update per row.
     */
    async backfillMissingSlugs(): Promise<{ scanned: number; updated: number }> {
        const missing = await this.propertyModel
            .find({ $or: [{ slug: { $exists: false } }, { slug: '' }, { slug: null }] })
            .select('_id title slug')
            .exec();

        await this.ensureSlugForProperties(missing);
        return {
            scanned: missing.length,
            updated: missing.filter((p) => !!p.slug).length,
        };
    }

    private async ensureSlugForProperties(properties: Property[]) {
        const toUpdate = properties.filter(p => !p.slug && p.title);
        if (toUpdate.length === 0) {
            return;
        }

        await Promise.all(
            toUpdate.map(async p => {
                const baseSlug = this.toSlug(p.title);
                const slug = await this.generateUniqueSlug(baseSlug, p._id.toString());
                p.slug = slug;
                return this.propertyModel.updateOne({ _id: p._id }, { slug }).exec();
            })
        );
    }

    async create(userId: string, dto: CreatePropertyDto, mainPhotoUrl?: string, additionalPhotosUrls?: string[], userRole?: string, options?: { source?: string; status?: 'pending' | 'approved' | 'rejected' | 'draft' }) {
        // Validation: Verify user exists if not admin (though controller handles auth)
        // Check subscription unless user is admin
        let subscriptionId: string | undefined;

        // Resolve final status with role-based safety:
        // - ADMIN can set anything (default 'pending' for backward compatibility)
        // - non-admin can save as 'draft' or submit as 'pending' (default)
        // - non-admin cannot self-approve / reject — gets coerced to 'pending'
        const requested = options?.status ?? dto.status;
        let finalStatus: 'pending' | 'approved' | 'rejected' | 'draft' = 'pending';
        if (requested === 'draft') {
            finalStatus = 'draft';
        } else if (userRole === 'ADMIN' && requested) {
            finalStatus = requested;
        }

        const source = options?.source || 'manual';

        /*
         * The brain decides whether this needs a human.
         *
         * Every agent listing used to sit in the approval queue — honest
         * listings were invisible for hours and the queue got long enough that
         * nobody read it properly. Now a clean listing publishes itself and
         * only the suspicious ones wait, with the reasons attached so the
         * admin can decide in seconds. See listing-brain.service.ts.
         *
         * Admins are never second-guessed, drafts are not reviewed (nothing is
         * public yet), and the API/n8n import keeps its own behaviour.
         */
        let brainVerdict: Awaited<ReturnType<ListingBrainService['review']>> | null = null;

        if (finalStatus === 'pending' && userRole !== 'ADMIN' && source === 'manual' && this.brain.isEnabled()) {
            const photos = [mainPhotoUrl, ...(additionalPhotosUrls ?? [])].filter(
                (url): url is string => Boolean(url),
            );

            brainVerdict = await this.brain.review(
                {
                    title: dto.title,
                    description: dto.description,
                    price: Number(dto.price) || 0,
                    areaSize: Number(dto.areaSize) || 0,
                    marla: Number(dto.marla) || 0,
                    listingType: dto.listingType,
                    propertyType: dto.propertyType,
                    bedrooms: Number(dto.bedrooms) || 0,
                    bathrooms: Number(dto.bathrooms) || 0,
                    location: dto.location,
                    contactNumber: dto.contactNumber,
                    whatsappNumber: dto.whatsappNumber,
                    photos,
                    hasVideo: Boolean(dto.videoUrl),
                    features: dto.features,
                },
                userId,
            );

            if (brainVerdict.action === 'publish') finalStatus = 'approved';
        }


        /*
         * Plans with instant publishing (Agency, Agency Plus) skip the review
         * queue — unless the brain found something seriously wrong.
         */
        if (finalStatus === 'pending' && userRole !== 'ADMIN' && userId) {
            const plan = await this.subscriptionService.getEffectivePlan(userId).catch(() => null);
            if (plan?.perks.autoPublish && (brainVerdict?.score ?? 0) < 80) finalStatus = 'approved';
        }

        // Photos per listing, as the plan says (the admin is not limited).
        if (userRole !== 'ADMIN' && userId) {
          const limit = (await this.subscriptionService.getEffectivePlan(userId).catch(() => null))?.perks.photosPerProperty ?? 0;
          const photos = (mainPhotoUrl ? 1 : 0) + (additionalPhotosUrls?.length ?? 0);
          if (limit > 0 && photos > limit) {
            throw new BadRequestException(`Your plan allows ${limit} photos per listing — remove ${photos - limit} and try again.`);
          }
        }

        // Drafts do not consume subscription slots — they aren't published yet.
        const consumesSubscription = userRole !== 'ADMIN' && finalStatus !== 'draft';

        // On the Free plan a listing stays live for a month (renewable); paid plans' listings do not expire.
        let expiresAt: Date | undefined;
        if (consumesSubscription) {
          const effective = await this.subscriptionService.getEffectivePlan(userId).catch(() => null);
          if (effective && effective.tier === 'free' && !effective.subscription) {
            expiresAt = new Date(Date.now() + PropertyService.FREE_LISTING_DAYS * 24 * 60 * 60 * 1000);
          }
        }

        if (consumesSubscription) {
          // SYNC: Before checking subscription, ensure the count is accurate
          // The counter on the plan owner's subscription follows the team's real count.
          await this.subscriptionService.syncPropertyUsage(userId);

          const subscriptionCheck = await this.subscriptionService.canCreateProperty(userId);
          

          if (!subscriptionCheck.canCreate) {
            throw new ForbiddenException(subscriptionCheck.message || 'No active subscription');
          }
          
          // Increment property count on the subscription
          if (subscriptionCheck.subscription) {
            subscriptionId = subscriptionCheck.subscription._id.toString();
            await this.subscriptionService.incrementPropertyCount(
              subscriptionId
            );
          }
        }

        const baseSlug = dto.slug ? this.toSlug(dto.slug) : (dto.title ? this.toSlug(dto.title) : undefined);
        const slug = baseSlug ? await this.generateUniqueSlug(baseSlug) : undefined;
        
        try {
            // Convert string values from FormData to proper types
            const property = new this.propertyModel({
              listingType: dto.listingType,
              propertyType: dto.propertyType,
              area: dto.area, // Area ID (ObjectId as string, Mongoose will convert)
              slug,
              title: dto.title,
              location: dto.location,
              bedrooms: Number(dto.bedrooms),
              bathrooms: Number(dto.bathrooms),
              areaSize: Number(dto.areaSize),
              price: Number(dto.price),
              marla: dto.marla ? Number(dto.marla) : 0,
              kanal: dto.kanal ? Number(dto.kanal) : 0,
              description: dto.description,
              contactNumber: dto.contactNumber,
              /*
               * Accepted by the DTO, sent by both forms, and until now never
               * written — in create or in update. It only looked like it
               * worked because every read falls back to contactNumber, so the
               * WhatsApp box filled in at listing time came back empty the
               * next time the listing was opened to edit, which reads as "the
               * form reset itself".
               */
              whatsappNumber: dto.whatsappNumber || dto.contactNumber,
              features: dto.features || [],
              owner: userId,
              mainPhotoUrl,
              additionalPhotosUrls: additionalPhotosUrls || [],
              status: finalStatus,
              ...(expiresAt ? { expiresAt } : {}),
              source,
              latitude: dto.latitude ? Number(dto.latitude) : undefined,
              longitude: dto.longitude ? Number(dto.longitude) : undefined,
              // Walkthrough clip: already uploaded to the media library, so this
              // is just the link plus its poster frame.
              videoUrl: dto.videoUrl?.trim() || undefined,
              videoPosterUrl: dto.videoPosterUrl?.trim() || undefined,
              // Kept so the admin sees WHY something is in the queue, and so a
              // pattern across one agent's listings is visible later.
              moderationScore: brainVerdict?.score ?? 0,
              moderationReasons: brainVerdict?.reasons ?? [],
              moderationSource: brainVerdict?.source,
              autoPublished: brainVerdict?.action === 'publish',
            })
            const saved = await property.save()

            // A listing in a hidden area (an emptied-out entry) brings the area back.
            if (saved.area) {
              this.areaModel.collection
                .updateOne({ _id: new Types.ObjectId(String(saved.area)), hidden: true }, { $unset: { hidden: '', hiddenReason: '' } })
                .catch(() => undefined);
            }

            // Bust caches only when the new property is publicly visible.
            // Drafts/pending listings don't appear on the public site, so
            // there's nothing to invalidate.
            if (saved.status === 'approved') {
                this.bustPropertyCaches(saved.slug).catch(() => {});
            }

            this.announceNewListing(saved, brainVerdict, userId);

            return saved;
        } catch (error) {
            // ROLLBACK: If property creation fails, decrement the subscription count
            if (subscriptionId) {
                console.error('Property creation failed, rolling back subscription count');
                await this.subscriptionService.decrementPropertyCount(subscriptionId);
            }
            throw error;
        }
      }
    
      /**
       * Every city with how many live listings it has, most first — for the
       * round city shortcuts on the homepage and the results pages.
       *
       * One aggregation instead of one request per city: listings grouped by
       * area (stored as an ObjectId or a plain string, so both are converted),
       * areas joined to their city, then summed. Sold/rented listings past
       * their fifteen days are not counted, matching what the lists show.
       */
      /**
       * The map explorer (/emap): listings inside the visible box, lightest
       * possible fields. Listings the dealer never pinned are placed at their
       * area's centre — the average of the area's pinned listings — and
       * flagged `approx`, so the map is full without anyone re-editing old
       * listings; a small, stable offset keeps them from stacking exactly.
       */
      async mapListings(q: {
        minLat: number; maxLat: number; minLng: number; maxLng: number;
        purpose?: string; type?: string; priceMin?: number; priceMax?: number;
        /** Also place unpinned listings at their area's centre. Off: the map shows exact pins only. */
        approx?: boolean;
      }) {
        const r2 = (n: number) => Math.round(n * 100) / 100;
        const key = this.cache.buildKey('properties:map', [
          r2(q.minLat), r2(q.maxLat), r2(q.minLng), r2(q.maxLng), q.purpose ?? '', q.type ?? '', q.priceMin ?? '', q.priceMax ?? '', q.approx ? 1 : 0,
        ]);
        return this.cache.wrap(key, async () => {
          const LIMIT = 600;
          const base: Record<string, any> = { status: 'approved' };
          if (q.purpose === 'rent' || q.purpose === 'sale' || q.purpose === 'buy') {
            base.listingType = q.purpose === 'rent' ? 'rent' : 'sale';
          }
          if (q.type && q.type !== 'all') base.propertyType = new RegExp(`^${PropertyService.escapeRegex(q.type)}$`, 'i');
          if (q.priceMin || q.priceMax) {
            base.price = {};
            if (q.priceMin) base.price.$gte = q.priceMin;
            if (q.priceMax) base.price.$lte = q.priceMax;
          }
          const graceCutoff = await this.graceCutoff();
          base.$and = [{ $or: [{ availability: { $nin: ['sold', 'rented'] } }, { availabilityChangedAt: { $gt: graceCutoff } }] }];

          const FIELDS = 'title slug price listingType propertyType latitude longitude mainPhotoUrl videoPosterUrl marla kanal areaSize bedrooms bathrooms isFeatured availability area location';

          // 1. Pinned listings inside the box.
          const pinned = await this.propertyModel
            .find({
              ...base,
              latitude: { $gte: q.minLat, $lte: q.maxLat },
              longitude: { $gte: q.minLng, $lte: q.maxLng },
            })
            .select(FIELDS)
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(LIMIT)
            .lean()
            .exec();

          // 2. Unpinned listings whose area centre is inside the box (only when asked for).
          const centres = q.approx ? await this.areaCentres() : new Map<string, { lat: number; lng: number }>();
          const inBox = [...centres.entries()].filter(
            ([, c]) => c.lat >= q.minLat && c.lat <= q.maxLat && c.lng >= q.minLng && c.lng <= q.maxLng,
          );
          let approx: any[] = [];
          if (q.approx && inBox.length && pinned.length < LIMIT) {
            const ids = inBox.map(([id]) => id);
            approx = await this.propertyModel
              .find({
                ...base,
                $or: [{ latitude: { $exists: false } }, { latitude: null }, { longitude: null }],
                area: { $in: [...ids.map((id) => new Types.ObjectId(id)), ...ids] },
              } as any)
              .select(FIELDS)
              .sort({ isFeatured: -1, createdAt: -1 })
              .limit(LIMIT - pinned.length)
              .lean()
              .exec();
          }

          const jitter = (id: string, salt: number) => {
            let h = salt;
            for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
            return ((h % 1000) / 1000 - 0.5) * 0.004; // about ±200 m
          };

          const shape = (p: any, lat: number, lng: number, isApprox: boolean) => ({
            id: String(p._id),
            slug: p.slug,
            title: p.title,
            price: p.price,
            purpose: p.listingType === 'rent' ? 'rent' : 'sale',
            type: p.propertyType,
            lat,
            lng,
            approx: isApprox,
            image: p.mainPhotoUrl || p.videoPosterUrl || '',
            marla: p.marla,
            kanal: p.kanal,
            areaSize: p.areaSize,
            beds: p.bedrooms,
            baths: p.bathrooms,
            featured: !!p.isFeatured,
            closed: p.availability === 'sold' || p.availability === 'rented',
            location: p.location,
          });

          const out = pinned.map((p: any) => shape(p, p.latitude, p.longitude, false));
          for (const p of approx) {
            const c = centres.get(String(p.area));
            if (!c) continue;
            out.push(shape(p, c.lat + jitter(String(p._id), 7), c.lng + jitter(String(p._id), 13), true));
          }
          return { listings: out, truncated: out.length >= LIMIT };
        }, { ttl: 300, tags: [TAG_PROPERTIES] });
      }

      /** Each area's centre: the average position of its pinned listings. Cached for an hour. */
      private async areaCentres(): Promise<Map<string, { lat: number; lng: number }>> {
        const rows = await this.cache.wrap(this.cache.buildKey('properties:area-centres', []), async () => {
          return this.propertyModel
            .aggregate([
              { $match: { status: 'approved', latitude: { $type: 'number' }, longitude: { $type: 'number' } } },
              { $project: { area: { $toString: '$area' }, latitude: 1, longitude: 1 } },
              { $match: { area: { $nin: [null, ''] } } },
              { $group: { _id: '$area', lat: { $avg: '$latitude' }, lng: { $avg: '$longitude' } } },
            ])
            .exec();
        }, { ttl: 3600, tags: [TAG_PROPERTIES] });
        return new Map((rows as any[]).map((r) => [String(r._id), { lat: r.lat, lng: r.lng }]));
      }

      async cityPopularity(): Promise<Array<{ _id: string; name: string; slug: string; thumbnail?: string; count: number }>> {
        return this.cache.wrap(this.cache.buildKey('properties:city-popularity', []), async () => {
          const graceCutoff = await this.graceCutoff();
          const [counts, cities] = await Promise.all([
            this.propertyModel
              .aggregate([
                {
                  $match: {
                    status: 'approved',
                    $or: [
                      { availability: { $nin: ['sold', 'rented'] } },
                      { availabilityChangedAt: { $gt: graceCutoff } },
                    ],
                  },
                },
                { $project: { areaId: { $convert: { input: '$area', to: 'objectId', onError: null, onNull: null } } } },
                { $match: { areaId: { $ne: null } } },
                { $group: { _id: '$areaId', n: { $sum: 1 } } },
                { $lookup: { from: this.areaModel.collection.name, localField: '_id', foreignField: '_id', as: 'a' } },
                { $unwind: '$a' },
                { $project: { n: 1, city: { $convert: { input: '$a.city', to: 'objectId', onError: null, onNull: null } } } },
                { $group: { _id: '$city', count: { $sum: '$n' } } },
              ])
              .exec(),
            this.cityModel.find().select('name thumbnail').lean().exec(),
          ]);
          const byCity = new Map<string, number>(counts.map((c: any) => [String(c._id), c.count]));
          const POPULAR_CITIES = [
            'lahore',
            'karachi',
            'islamabad',
            'rawalpindi',
            'faisalabad',
            'faislabad',
            'multan',
            'peshawar',
            'gujranwala',
            'sialkot',
            'bahawalpur',
            'sahiwal',
            'hyderabad',
            'quetta',
            'abbottabad',
            'sargodha',
            'gujrat',
            'sheikhupura',
            'jhelum',
            'wah cantt',
            'wah',
            'rahim yar khan',
            'mardan',
            'kasur',
            'sukkur',
            'larkana',
            'dera ghazi khan',
            'dg khan',
            'nawabshah',
            'okara',
            'mirpur',
            'gwadar',
            'murree',
          ];
          const rank = (name?: string | null) => {
            if (!name) return 999;
            const norm = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const idx = POPULAR_CITIES.findIndex(c => c.replace(/[^a-z0-9]/g, '') === norm);
            return idx === -1 ? 999 : idx;
          };
          return cities
            .map((c: any) => ({
              _id: String(c._id),
              name: c.name,
              slug: String(c.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
              thumbnail: c.thumbnail || undefined,
              count: byCity.get(String(c._id)) ?? 0,
            }))
            .sort((a, b) => {
              const rA = rank(a.name);
              const rB = rank(b.name);
              if (rA !== rB) return rA - rB;
              return b.count - a.count || a.name.localeCompare(b.name);
            });
        }, { ttl: 600, tags: [TAG_PROPERTIES] });
      }

      async findAllApproved(filters?: { 
        cityId?: string; 
        cityName?: string;
        areaId?: string;
        search?: string;

        priceMin?: number;
        priceMax?: number;
        areaMin?: number;
        areaMax?: number;
        marlaMin?: number;
        marlaMax?: number;
        beds?: number;
        baths?: number;
        type?: string;
        purpose?: string;
        page?: number;
        limit?: number;
      }) {
        // ⚡ Cache: wrap the entire query in Redis (60s). Filter object is
        // serialized into the key so each unique filter combo gets its own
        // cache slot. Tag = 'properties' so any property write invalidates
        // every list page in one shot.
        const cacheKey = this.cache.buildKey('properties:list', [filters || {}]);
        // 10 minutes: every property write clears this tag, so the TTL only
        // decides how often an unchanged list is recomputed.
        const result: any = await this.cache.wrap(cacheKey, async () => this.findAllApprovedImpl(filters), {
            ttl: 600,
            tags: [TAG_PROPERTIES],
        });
        return this.withVerified(result);
      }

      /**
       * Marks each listing whose owner holds a plan with the verified badge
       * (or is an agent of such an agency). Added after the cache, so the badge
       * appears and disappears with the plan, not with the list's cache.
       */
      async withVerified<T extends { properties?: any[] }>(result: T): Promise<T> {
        if (!result?.properties?.length) return result;
        const verified = await this.agency.verifiedIds().catch(() => new Set<string>());
        return {
          ...result,
          properties: result.properties.map((p: any) => ({ ...p, ownerVerified: verified.has(String(p.owner?._id ?? p.owner ?? '')) })),
        };
      }

      /**
       * What a visitor may know about whoever posted a listing: enough to say
       * "posted by" and link to their profile. Deliberately no email, and no
       * role, flags or counters.
       */
      static readonly PUBLIC_OWNER_FIELDS = 'name companyName avatarUrl';

      private async findAllApprovedImpl(filters?: any) {
        try {
          const query: any = { status: 'approved' };
          
          if (filters?.search) {
            // Escaped: typed text is a phrase to find, not a pattern to run.
            const searchRegex = new RegExp(PropertyService.escapeRegex(filters.search.trim()), 'i');
            query.$or = [
              { title: searchRegex },
              { location: searchRegex }
            ];
          }

          if (filters?.ownerId) {
            if (!this.isValidObjectId(filters.ownerId)) {
              return { properties: [], total: 0, page: filters?.page || 1, limit: filters?.limit || 12, totalPages: 0 };
            }

            /*
             * Owners come in both stored types, like `area` below.
             *
             * Part of this collection holds `owner` as a plain 24-character
             * string rather than an ObjectId, and MongoDB does not consider
             * the two equal. Matching the ObjectId alone returned nothing for
             * three of the four agents who actually have live listings, so
             * their public profile read "This agent has no active listings
             * right now" with their listings sitting on the site.
             *
             * The ids are gathered through the raw collection, where nothing
             * is cast and both forms match, and then matched by `_id` so the
             * rest of this query — filters, sort, pagination, populate — is
             * untouched. `scripts/normalize-owner-ids.ts` repairs the stored
             * types; this keeps the page right either way.
             */
            const owned = await this.propertyModel.collection
              .find({
                owner: { $in: [new Types.ObjectId(filters.ownerId), filters.ownerId] },
              })
              .project({ _id: 1 })
              .toArray();

            if (owned.length === 0) {
              return { properties: [], total: 0, page: filters?.page || 1, limit: filters?.limit || 12, totalPages: 0 };
            }

            query._id = { $in: owned.map((row) => row._id) };
          }

          if (filters?.areaId) {
            if (!this.isValidObjectId(filters.areaId)) {
              return { properties: [], total: 0, page: filters?.page || 1, limit: filters?.limit || 12, totalPages: 0 };
            }
            
            // Try to find the area name to also search by string as fallback
            const areaDoc = await this.areaModel.findById(filters.areaId).select('name').lean();
            
            // Handle both string and ObjectId for area field to be resilient
            const areaOrConditions: any[] = [
              { area: filters.areaId }
            ];
            
            try {
               areaOrConditions.push({ area: new Types.ObjectId(filters.areaId) });
            } catch (e) {
               // Ignore if conversion fails, though isValidObjectId should have caught it
            }
            
            // A society's listings include its phases' (areas whose parent is this one).
            const phaseIds = await this.areaModel.collection
              .find({ parent: { $in: [new Types.ObjectId(filters.areaId), String(filters.areaId)] } }, { projection: { _id: 1 } })
              .toArray();
            if (phaseIds.length) {
              areaOrConditions.push({ area: { $in: [...phaseIds.map((a) => a._id), ...phaseIds.map((a) => String(a._id))] } });
            }

            if (areaDoc && areaDoc.name) {
                // Escape regex special characters
                const escapedName = areaDoc.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const areaNameRegex = new RegExp(`${escapedName}`, 'i');
                areaOrConditions.push({ location: areaNameRegex });
                areaOrConditions.push({ title: areaNameRegex });
            }
            
            if (query.$or) {
              // If we already have a search $or, we need to combine them with $and
              const searchOr = query.$or;
              delete query.$or;
              query.$and = [
                { $or: searchOr },
                { $or: areaOrConditions }
              ];
            } else {
              query.$or = areaOrConditions;
            }
          } else if (filters?.cityId || filters?.cityName) {
            const cityOrConditions: any[] = [];

            // 1. Relational match: the city's areas -> their listings.
            //
            // Most areas on the live site store `city` as a plain string, which
            // a Mongoose (cast) query never matches — a city filtered by id
            // alone found 7 of Lahore's 187 listings and none at all for most
            // cities, so a list came up empty until an area was picked. The
            // raw collection matches both forms. With only a name (or slug),
            // the city is looked up by it first.
            const cityIds: string[] = [];
            if (filters.cityId && this.isValidObjectId(filters.cityId)) cityIds.push(String(filters.cityId));
            if (filters.cityName) {
                const wanted = String(filters.cityName).trim().toLowerCase().replace(/[-_]+/g, ' ');
                const cities = await this.cityModel.collection.find({}, { projection: { name: 1 } }).toArray();
                // One letter apart counts too: the site's "Faislabad" is the "Faisalabad" people type.
                const close = (a: string, b: string) => {
                    if (a === b) return true;
                    if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 6) return false;
                    let i = 0;
                    while (i < a.length && a[i] === b[i]) i++;
                    return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
                };
                for (const c of cities as any[]) {
                    const n = String(c.name ?? '').trim().toLowerCase().replace(/[-_]+/g, ' ');
                    if (n && close(n, wanted) && !cityIds.includes(String(c._id))) cityIds.push(String(c._id));
                }
            }
            if (cityIds.length) {
                const areas = await this.areaModel.collection
                    .find({ city: { $in: cityIds.flatMap((id) => [new Types.ObjectId(id), id]) } }, { projection: { _id: 1 } })
                    .toArray();
                const areaIds = areas.map((a: any) => a._id);
                if (areaIds.length > 0) {
                    cityOrConditions.push({ area: { $in: areaIds } });
                    // Also include string versions of areaIds for resilience
                    cityOrConditions.push({ area: { $in: areaIds.map((id: any) => id.toString()) } });
                }
            }

            // 2. String match via cityName
            if (filters.cityName) {
                 // Case-insensitive match for city string field
                 const cityRegex = new RegExp(PropertyService.escapeRegex(String(filters.cityName).replace(/-/g, ' ')).replace(/ /g, '[ -]'), 'i');
                 cityOrConditions.push({ city: cityRegex });
                 cityOrConditions.push({ location: cityRegex });
                 cityOrConditions.push({ title: cityRegex });
            }

            if (cityOrConditions.length > 0) {
                if (query.$or) {
                    const searchOr = query.$or;
                    delete query.$or;
                    query.$and = [
                        { $or: searchOr },
                        { $or: cityOrConditions }
                    ];
                } else {
                    query.$or = cityOrConditions;
                }
            } else if (filters.cityId) {
                 // If cityId was provided but no areas found and no cityName provided, return empty
                 return { properties: [], total: 0, page: filters?.page || 1, limit: filters?.limit || 12, totalPages: 0 };
            }
          }


          // Price Range Filter
          if (filters?.priceMin !== undefined || filters?.priceMax !== undefined) {
            query.price = {};
            if (filters.priceMin !== undefined) query.price.$gte = filters.priceMin;
            if (filters.priceMax !== undefined) query.price.$lte = filters.priceMax;
          }

          // Area Size Filter
          if (filters?.areaMin !== undefined || filters?.areaMax !== undefined) {
            query.areaSize = {};
            if (filters.areaMin !== undefined) query.areaSize.$gte = filters.areaMin;
            if (filters.areaMax !== undefined) query.areaSize.$lte = filters.areaMax;
          }

          // Marla Filter
          if (filters?.marlaMin !== undefined || filters?.marlaMax !== undefined) {
            query.marla = {};
            if (filters.marlaMin !== undefined) query.marla.$gte = filters.marlaMin;
            if (filters.marlaMax !== undefined) query.marla.$lte = filters.marlaMax;
          }

          // Beds Filter
          if (filters?.beds !== undefined) {
            if (filters.beds >= 5) {
                query.bedrooms = { $gte: 5 }; // 5+ logic
            } else {
                query.bedrooms = filters.beds;
            }
          }

          // Baths Filter
          if (filters?.baths !== undefined) {
             if (filters.baths >= 4) {
                query.bathrooms = { $gte: 4 }; // 4+ logic
            } else {
                query.bathrooms = filters.baths;
            }
          }

          // Type Filter
          if (filters?.type && filters.type !== 'all') {
             // Case-insensitive match for property type
             query.propertyType = new RegExp(`^${filters.type}$`, 'i');
          }

          // Purpose Filter
          if (filters?.purpose && filters.purpose !== 'all') {
             // Map frontend 'buy' -> backend 'sale'
             const purposeMap: any = { 'buy': 'sale', 'rent': 'rent' };
             const mappedPurpose = purposeMap[filters.purpose] || filters.purpose;
             query.listingType = mappedPurpose;
          }
          
          /*
           * Sold and rented listings leave the lists after fifteen days.
           *
           * For the first fifteen they stay, badged and with the phone number
           * hidden — "this one went" is useful to a buyer and it is proof the
           * agent closes deals. After that they stop appearing in search, on
           * the city and area pages, and on the agent's profile.
           *
           * Only the lists. The listing's own URL keeps answering forever:
           * these pages are ranked, and a 404 or a redirect would throw that
           * away. PropertyDetail shows the "no longer available" state.
           *
           * Computed here rather than written by a cron job, so flipping a
           * listing back to available brings it straight back.
           *
           * `$nin` also matches rows where the field is missing, which is
           * every listing that existed before this was added — they stay
           * exactly as they are.
           */
          const graceCutoff = await this.graceCutoff();
          const stillListed = {
            $or: [
              { availability: { $nin: ['sold', 'rented'] } },
              { availabilityChangedAt: { $gt: graceCutoff } },
            ],
          };

          // Merged into $and so it cannot collide with the $or that the
          // search, area and city filters above may already have taken.
          query.$and = [...(query.$and ?? []), stillListed];

          const page = Math.max(1, Number(filters?.page) || 1);
          // Capped: a list never needs more than a screenful or two, and an
          // unbounded ?limit= is a way to make the server do a lot of work.
          const limit = Math.min(50, Math.max(1, Number(filters?.limit) || 12));
          const skip = (page - 1) * limit;

          const [properties, total] = await Promise.all([
            this.propertyModel.find(query)
              // Featured first, then newest. Rows written before the field
              // existed have no value, which sorts with the unfeatured.
              .sort({ isFeatured: -1, createdAt: -1 })
              .skip(skip)
              .limit(limit)
              /*
               * Lists only draw cards. The description (often several KB of
               * HTML per listing) and the moderation fields were going out
               * with every row of every results page; the listing page
               * fetches its own full document.
               */
              .select(PropertyService.LIST_EXCLUDE)
              .lean()
              .exec(),
            this.propertyModel.countDocuments(query)
          ]);
      
      // NOTE: this read path used to call ensureSlugForProperties(), issuing
      // find+update round trips from inside a GET. Slugs are written on create
      // and update; run `npm run backfill:slugs --workspace=apps/api` once for
      // any legacy rows that predate that.

      // Populate area and city - handle cases where area might be null
      if (properties.length > 0) {
        // Only populate if area exists
        const propertiesWithArea = properties.filter(p => this.isValidAreaRef(p.area));
        if (propertiesWithArea.length > 0) {
          try {
            await this.propertyModel.populate(propertiesWithArea, {
              path: 'area',
              select: 'name areaSlug',
              populate: { 
                path: 'city', 
                select: 'name areaSlug state country'
              }
            });
          } catch (populateError: any) {
            console.warn('⚠️ Non-critical: Error populating properties:', populateError.message);
          }
        }
      }
      
      return {
        properties,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error in findAllApproved:', error);
      throw error;
    }
  }
    
      /**
       * Build the Mongo query shared by the dashboard list and its stats.
       * Returns null when a filter can never match, so the caller can answer
       * with an empty page without touching the database.
       */
      private async buildDashboardQuery(
        filters: DashboardPropertyFilters,
        userId?: string,
        userRole?: string,
      ): Promise<Record<string, any> | null> {
        const query: Record<string, any> = {};

        // AGENT and USER see their own listings — and an agency owner, the whole team's.
        if (userRole !== 'ADMIN' && userId) {
          const visible = await this.agency.visibleOwners(userId);
          if (filters.ownerId) {
            if (!visible.includes(String(filters.ownerId))) return null;
            query.owner = { $in: AgencyService.anyIds([String(filters.ownerId)]) };
          } else {
            query.owner = visible.length === 1 ? userId : { $in: AgencyService.anyIds(visible) };
          }
        } else if (filters.ownerId) {
          if (!this.isValidObjectId(filters.ownerId)) return null;
          query.owner = { $in: AgencyService.anyIds([String(filters.ownerId)]) };
        }

        // `area` and an area's `city` are stored as ObjectId or string (Mixed paths): match both.
        if (filters.areaId) {
          if (!this.isValidObjectId(filters.areaId)) return null;
          query.area = { $in: AgencyService.anyIds([String(filters.areaId)]) };
        } else if (filters.cityId) {
          if (!this.isValidObjectId(filters.cityId)) return null;
          const areas = await this.areaModel.collection
            .find({ city: { $in: AgencyService.anyIds([String(filters.cityId)]) } }, { projection: { _id: 1 } })
            .toArray();
          if (areas.length === 0) return null;
          query.area = { $in: AgencyService.anyIds(areas.map((a: any) => String(a._id))) };
        }

        if (filters.status) query.status = filters.status;
        if (filters.propertyType) query.propertyType = filters.propertyType;
        if (filters.listingType) query.listingType = filters.listingType;

        if (filters.search) {
          // Escaped so a user typing "(" or "*" cannot break the regex — or
          // hand Mongo a pathological pattern to evaluate.
          const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(escaped, 'i');
          query.$or = [{ title: rx }, { location: rx }, { city: rx }, { contactNumber: rx }];
        }

        return query;
      }

      /**
       * Dashboard list — paginated, projected and lean.
       *
       * The previous implementation ran `find(query).sort().exec()` with no
       * limit, no projection and no `.lean()`, so a dashboard load hydrated
       * every visible property into a full Mongoose document (including the
       * long `description` field) and shipped the lot to the browser. On top of
       * that it called `ensureSlugForProperties` on the read path, which could
       * fire an unbounded series of find+update round trips inside a GET.
       */
      async findAll(
        filters: DashboardPropertyFilters = {},
        userId?: string,
        userRole?: string,
      ): Promise<DashboardPropertyPage> {
        try {
          const requestedLimit = filters.limit ?? DASHBOARD_DEFAULT_LIMIT;
          const limit =
            requestedLimit === 0
              ? DASHBOARD_MAX_LIMIT
              : Math.min(requestedLimit, DASHBOARD_MAX_LIMIT);
          const page = Math.max(1, filters.page ?? 1);

          const empty: DashboardPropertyPage = {
            properties: [],
            total: 0,
            totalPages: 0,
            currentPage: page,
            limit,
          };

          const query = await this.buildDashboardQuery(filters, userId, userRole);
          if (!query) return empty;

          const sortField =
            filters.sortBy && DASHBOARD_SORTABLE.has(filters.sortBy)
              ? filters.sortBy
              : 'createdAt';
          const sortDir = filters.sortDir === 'asc' ? 1 : -1;

          // countDocuments and the page itself are independent — run them
          // together rather than one after the other.
          const [total, properties] = await Promise.all([
            this.propertyModel.countDocuments(query).exec(),
            this.propertyModel
              .find(query)
              .select(DASHBOARD_LIST_FIELDS)
              .sort({ [sortField]: sortDir })
              .skip((page - 1) * limit)
              .limit(limit)
              .populate({
                path: 'area',
                select: 'name areaSlug',
                populate: { path: 'city', select: 'name areaSlug state country' },
              })
              .lean()
              .exec(),
          ]);

          return {
            properties: await this.withPosters(properties, userRole === 'ADMIN'),
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
          };
        } catch (error) {
          console.error('❌ Critical: Error in findAll:', error);
          throw error;
        }
      }

      /**
       * Who posted each listing, for the dashboard: the approval queue showed a
       * title and nothing about the account behind it. Everyone sees the
       * poster's name (an agency owner sees which of its agents posted); the
       * admin also gets contact details, role, agency and plan.
       */
      private async withPosters(rows: any[], admin: boolean) {
        if (!rows.length) return rows;
        const ids = [...new Set(rows.map((p) => String(p.owner ?? '')).filter((id) => Types.ObjectId.isValid(id)))];
        if (!ids.length) return rows;
        const db = this.propertyModel.db;
        const users = await db
          .collection('users')
          .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }, { projection: { name: 1, companyName: 1, email: 1, phone: 1, role: 1, agencyId: 1, isActive: 1, createdAt: 1 } })
          .toArray();
        const byId = new Map(users.map((u: any) => [String(u._id), u]));

        let agencies = new Map<string, any>();
        let plans = new Map<string, string>();
        let counts = new Map<string, number>();
        if (admin) {
          const agencyIds = [...new Set(users.map((u: any) => (u.agencyId ? String(u.agencyId) : '')).filter(Boolean))];
          if (agencyIds.length) {
            const rowsA = await db.collection('users').find({ _id: { $in: agencyIds.map((i) => new Types.ObjectId(i)) } }, { projection: { name: 1, companyName: 1 } }).toArray();
            agencies = new Map(rowsA.map((a: any) => [String(a._id), a]));
          }
          // The plan in force: an agent's comes from the agency.
          const planOwners = [...new Set(users.map((u: any) => String(u.agencyId ?? u._id)))];
          const subs = await db
            .collection('subscriptions')
            .find({ userId: { $in: AgencyService.anyIds(planOwners) }, status: 'active', endDate: { $gt: new Date() } }, { projection: { userId: 1, planName: 1, packageId: 1 } })
            .toArray();
          const pkgIds = [...new Set(subs.map((s: any) => String(s.packageId ?? '')).filter((i) => Types.ObjectId.isValid(i)))];
          const pkgs = pkgIds.length ? await db.collection('packages').find({ _id: { $in: pkgIds.map((i) => new Types.ObjectId(i)) } }, { projection: { name: 1 } }).toArray() : [];
          const pkgName = new Map(pkgs.map((p: any) => [String(p._id), p.name]));
          plans = new Map(subs.map((s: any) => [String(s.userId), pkgName.get(String(s.packageId)) ?? s.planName ?? 'Paid plan']));
          const agg = await this.propertyModel
            .aggregate([
              { $match: { owner: { $in: AgencyService.anyIds(ids) } } },
              { $group: { _id: { $toString: '$owner' }, n: { $sum: 1 } } },
            ])
            .exec();
          counts = new Map((agg as any[]).map((r) => [String(r._id), r.n]));
        }

        return rows.map((p) => {
          const u: any = byId.get(String(p.owner ?? ''));
          if (!u) return { ...p, poster: null };
          const base = { _id: String(u._id), name: u.name ?? '', companyName: u.companyName ?? '' };
          if (!admin) return { ...p, poster: base };
          const agency = u.agencyId ? agencies.get(String(u.agencyId)) : null;
          return {
            ...p,
            poster: {
              ...base,
              email: u.email ?? '',
              phone: u.phone ?? '',
              role: u.role ?? '',
              isActive: u.isActive !== false,
              joinedAt: u.createdAt ?? null,
              agency: agency ? { _id: String(agency._id), name: agency.companyName || agency.name || 'Agency' } : null,
              plan: plans.get(String(u.agencyId ?? u._id)) ?? 'Free',
              listings: counts.get(String(u._id)) ?? 0,
            },
          };
        });
      }

      /**
       * Counts per status for the dashboard tabs and overview cards, scoped to
       * what the caller may see. One grouped aggregation — the dashboard used
       * to derive these in the browser from a full download of every property.
       */
      async getDashboardStats(userId?: string, userRole?: string) {
        const match: Record<string, any> = {};
        if (userRole !== 'ADMIN' && userId) {
          // An aggregation does not cast for us the way find() does, and an
          // unparseable id would throw rather than simply match nothing.
          if (!this.isValidObjectId(userId)) {
            return { total: 0, byStatus: { draft: 0, pending: 0, approved: 0, rejected: 0 } };
          }
          // An agency owner's numbers cover the whole team.
          const visible = await this.agency.visibleOwners(userId);
          match.owner = visible.length === 1 ? new Types.ObjectId(userId) : { $in: AgencyService.anyIds(visible) };
        }

        const rows = await this.propertyModel
          .aggregate<{ _id: string; count: number }>([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ])
          .exec();

        const byStatus: Record<string, number> = {
          draft: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        };
        let total = 0;
        for (const row of rows) {
          if (row._id) byStatus[row._id] = row.count;
          total += row.count;
        }

        return { total, byStatus };
      }

      /**
       * "How are my listings doing?" — the numbers behind an agent's dashboard.
       *
       * Scoped exactly like the dashboard list: an admin sees the whole
       * platform, anyone else sees only the listings they own. Three
       * aggregations, no document download: the previous way to answer any of
       * this was to fetch every listing and count in the browser.
       */
      /**
       * Push the new listing to the admin's Discord channel.
       *
       * Held listings are the ones that matter — the alert carries the score,
       * the reasons and a link straight to the approval queue, so reviewing
       * happens from a phone without opening the dashboard first.
       */
      private announceNewListing(
        saved: any,
        verdict: {
          score: number;
          reasons: string[];
          action: string;
          source?: string;
        } | null,
        ownerId: string,
      ) {
        try {
          const held = saved.status === 'pending';
          const price = DiscordService.money(saved.price);

          this.discord.send({
            title: held
              ? '🕵️ New listing held for approval'
              : '✅ New listing published automatically',
            description: String(saved.title || '').slice(0, 300),
            url: held
              ? '/dashboard/property?status=pending'
              : saved.slug
                ? `/properties/${saved.slug}`
                : '/dashboard/property',
            color: held ? DISCORD_COLORS.review : DISCORD_COLORS.approved,
            fields: [
              { name: 'Price', value: `${price}${saved.listingType === 'rent' ? ' / month' : ''}` },
              { name: 'Where', value: String(saved.location || '—').slice(0, 120) },
              { name: 'Type', value: String(saved.propertyType || '—') },
              {
                name: 'Risk score',
                value: verdict ? `${verdict.score}/100 (${verdict.source ?? 'rules'})` : 'not scored',
              },
              { name: 'Agent', value: `\`${ownerId}\``, inline: false },
              ...(verdict?.reasons.length
                ? [{ name: 'Why held', value: verdict.reasons.slice(0, 6).map((r) => `• ${r}`).join('\n'), inline: false }]
                : []),
            ],
          });
        } catch {
          // An alert must never be the reason a listing fails to save.
        }
      }

      async getPerformance(userId?: string, userRole?: string) {
        const empty = {
          totals: {
            listings: 0,
            active: 0,
            views: 0,
            impressions: 0,
            phoneClicks: 0,
            whatsappClicks: 0,
            contacts: 0,
          },
          byStatus: { draft: 0, pending: 0, approved: 0, rejected: 0 } as Record<string, number>,
          listings: [] as Record<string, unknown>[],
        };

        const match: Record<string, any> = {};
        if (userRole !== 'ADMIN') {
          if (!userId || !this.isValidObjectId(userId)) return empty;
          match.owner = new Types.ObjectId(userId);
        }

        const [totalsRows, statusRows, listings] = await Promise.all([
          this.propertyModel
            .aggregate<{
              _id: null;
              listings: number;
              active: number;
              views: number;
              impressions: number;
              phoneClicks: number;
              whatsappClicks: number;
            }>([
              { $match: match },
              {
                $group: {
                  _id: null,
                  listings: { $sum: 1 },
                  active: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                  // $ifNull so listings that predate the counters count as 0
                  // rather than turning the whole sum into null.
                  views: { $sum: { $ifNull: ['$views', 0] } },
                  impressions: { $sum: { $ifNull: ['$impressions', 0] } },
                  phoneClicks: { $sum: { $ifNull: ['$phoneClicks', 0] } },
                  whatsappClicks: { $sum: { $ifNull: ['$whatsappClicks', 0] } },
                },
              },
            ])
            .exec(),

          this.propertyModel
            .aggregate<{ _id: string; count: number }>([
              { $match: match },
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ])
            .exec(),

          // The per-listing table. Busiest first — that is the question being
          // asked ("which of mine is working?"), not "which is newest".
          this.propertyModel
            .find(match)
            .select('title slug status listingType price views impressions phoneClicks whatsappClicks mainPhotoUrl createdAt marla kanal areaSize')
            .sort({ views: -1, createdAt: -1 })
            .limit(100)
            .lean()
            .exec(),
        ]);

        const totals = totalsRows[0];
        const byStatus: Record<string, number> = {
          draft: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        };
        for (const row of statusRows) {
          if (row._id) byStatus[row._id] = row.count;
        }

        return {
          totals: {
            listings: totals?.listings ?? 0,
            active: totals?.active ?? 0,
            views: totals?.views ?? 0,
            impressions: totals?.impressions ?? 0,
            phoneClicks: totals?.phoneClicks ?? 0,
            whatsappClicks: totals?.whatsappClicks ?? 0,
            contacts: (totals?.phoneClicks ?? 0) + (totals?.whatsappClicks ?? 0),
          },
          byStatus,
          listings: listings.map((row: any) => ({
            _id: String(row._id),
            title: row.title,
            slug: row.slug,
            status: row.status,
            listingType: row.listingType,
            price: row.price ?? 0,
            views: row.views ?? 0,
            impressions: row.impressions ?? 0,
            phoneClicks: row.phoneClicks ?? 0,
            whatsappClicks: row.whatsappClicks ?? 0,
            mainPhotoUrl: row.mainPhotoUrl ?? null,
            createdAt: row.createdAt,
            marla: row.marla ?? 0,
            kanal: row.kanal ?? 0,
            areaSize: row.areaSize ?? 0,
          })),
        };
      }

      async findPropertyByid(id: string) {
        const property = await this.propertyModel.findById(id).exec();
        if (!property) {
          throw new NotFoundException(`Property with ID ${id} not found`)
        }
        
        // Populate area and city - handle errors gracefully
        try {
          return await this.propertyModel.populate(property, {
            path: 'area',
            select: 'name areaSlug',
            populate: { 
              path: 'city', 
              select: 'name areaSlug state country'
            }
          });
        } catch (populateError) {
          console.error('Error populating property:', populateError);
          // Return property without population if populate fails
          return property;
        }
      }

      async findPropertyBySlug(slug: string) {
        // ⚡ Cache: per-slug page is the most-hit endpoint after the home
        // page; tag includes the slug so we can bust just one entry on edit.
        const normalizedSlug = this.toSlug(slug);
        const cacheKey = this.cache.buildKey('property:slug', [normalizedSlug]);
        const found: any = await this.cache.wrap(cacheKey, () => this.findPropertyBySlugImpl(slug), {
            ttl: 600,
            tags: [TAG_PROPERTIES, `property:slug:${normalizedSlug}`],
        });
        const doc = typeof found?.toObject === 'function' ? found.toObject() : found;
        const ownerId = String(doc?.owner?._id ?? doc?.owner ?? '');
        const [ownerVerified, agencyId, ownerProfile] = await Promise.all([
          this.agency.isVerified(ownerId).catch(() => false),
          this.agency.agencyOf(ownerId).catch(() => null),
          this.subscriptionService.hasProfilePage(ownerId).catch(() => true),
        ]);
        return { ...doc, ownerVerified, ownerAgencyId: agencyId, ownerProfile };
      }

      private async findPropertyBySlugImpl(slug: string) {
        const normalizedSlug = this.toSlug(slug);
        // A miss used to trigger ensureSlugForMissingApproved(), which scanned
        // every approved property and wrote slugs for any that lacked one.
        // That made an unknown slug — including one typed by a crawler — cost a
        // full collection scan plus writes, on an uncacheable 404 path.
        const property = await this.propertyModel
          // An expired listing's page still answers (with a notice): the URL may be ranked.
          .findOne({ slug: normalizedSlug, status: { $in: ['approved', 'expired'] } })
          .exec();
        if (!property) {
          throw new NotFoundException(`Property with slug ${slug} not found`)
        }

        // Populate area and city - handle errors gracefully
        try {
          await this.propertyModel.populate(property, {
            path: 'area',
            select: 'name areaSlug',
            populate: {
              path: 'city',
              select: 'name areaSlug state country'
            }
          });
        } catch (populateError) {
          console.error('Error populating property:', populateError);
        }

        // Who posted it, for the agent card and the "more from this agent"
        // strip. Non-critical: a listing whose owner was deleted still renders.
        try {
          await this.propertyModel.populate(property, {
            path: 'owner',
            select: PropertyService.PUBLIC_OWNER_FIELDS,
          });
        } catch (populateError) {
          console.warn('Non-critical: could not populate listing owner:', populateError);
        }

        return property;
      }

      /**
       * @param userId / @param userRole present for a non-admin caller.
       *
       * An owner may submit their own draft for review, or pull a submission
       * back to draft — nothing else. Publishing, rejecting and un-publishing
       * stay with admins, which is the same rule update() already applies to
       * a status sent with a form.
       *
       * Previously this route was AdminGuard-only while the dashboard offered
       * agents a "Submit for approval" button on their drafts, so the button
       * answered 403.
       */
      async updateStatus(
        id: string,
        status: 'pending' | 'approved' | 'rejected' | 'draft' = 'approved',
        userId?: string,
        userRole?: string,
      ) {
        const allowed: Array<'pending' | 'approved' | 'rejected' | 'draft'> = ['pending', 'approved', 'rejected', 'draft'];
        if (!allowed.includes(status)) {
            throw new BadRequestException(`Invalid status: ${status}`);
        }

        if (userRole !== 'ADMIN') {
            const existing = await this.propertyModel.findById(id).select('owner status').lean().exec();
            if (!existing) {
                throw new NotFoundException('Property not found');
            }
            if (!userId || !(await this.agency.canManage(existing.owner, userId))) {
                throw new ForbiddenException('You do not have permission to modify this property listing');
            }
            if (status !== 'draft' && status !== 'pending') {
                throw new ForbiddenException('Only an admin can publish or reject a listing');
            }
            // An approved listing may not be edited back into the queue by its
            // owner: taking something off the site is an admin decision.
            if (existing.status === 'approved') {
                throw new ForbiddenException('Ask an admin to unpublish a live listing');
            }
        }

        // Approved again after its month ran out (edited, then re-reviewed): a fresh month, not an instant re-expiry.
        const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const restart = status === 'approved'
          ? await this.propertyModel.exists({ _id: id, expiresAt: { $ne: null, $lt: soon } })
          : null;
        const property = await this.propertyModel
          .findByIdAndUpdate(
            id,
            restart ? { status, expiresAt: new Date(Date.now() + PropertyService.FREE_LISTING_DAYS * 24 * 60 * 60 * 1000) } : { status },
            { new: true },
          )
          .exec();

        if (property && property.status === 'approved' && property.slug) {
            const host = this.configService.get<string>('APP_HOST') || 'propertydealer.pk';
            const url = `https://${host}/p/${property.slug}`;
            this.indexNowService.submitUrl(url).catch(err => {
                console.error('Failed to submit URL to IndexNow:', err);
            });
        }

        // Always bust caches on any status change. Going approved->pending
        // (un-publish) must also remove the property from public lists.
        this.bustPropertyCaches(property?.slug).catch(() => {});

        return {
            success: true,
            message: 'Property status updated successfully',
            property: property
        }
      }

      /**
       * Pin a listing to the top of the public lists, or unpin it.
       *
       * Admin only, and with no reference to the owner's plan. Featuring is
       * an editorial call about what the site should be showing today — a
       * well-photographed house in a sought-after block earns the slot
       * whether or not its agent has paid for anything.
       */
      async setFeatured(
        id: string,
        isFeatured: boolean,
        userId?: string,
        userRole?: string,
      ) {
        /*
         * Two ways in, with different rules.
         *
         * An admin pins anything, for editorial reasons, with no reference to
         * anybody's plan — that is the point of the control. An agent pins
         * their own listings, up to the number their plan includes, which is
         * what the "featured listings" line on the pricing page is selling.
         * Unpinning is always allowed: nobody needs permission to take their
         * own listing out of the spotlight.
         */
        if (userRole !== 'ADMIN') {
          const existing = await this.propertyModel
            .findById(id)
            .select('owner')
            .lean()
            .exec();

          if (!existing) throw new NotFoundException('Property not found');
          if (!userId || !(await this.agency.canAdminister(existing.owner, userId))) {
            if (userId && (await this.agency.agencyOf(userId))) {
              throw new ForbiddenException('Only your agency owner can feature listings.');
            }
            throw new ForbiddenException(
              'You do not have permission to modify this property listing',
            );
          }

          if (isFeatured) {
            const plan = await this.subscriptionService.getEffectivePlan(userId);

            // Raw collection: part of this data stores `owner` as a string
            // rather than an ObjectId, and a cast query would undercount.
            const team = await this.agency.teamOf(await this.agency.planOwnerOf(userId));
            const alreadyFeatured = await this.propertyModel.collection.countDocuments({
              owner: { $in: AgencyService.anyIds(team) },
              isFeatured: true,
              _id: { $ne: new Types.ObjectId(id) },
            });

            if (alreadyFeatured >= plan.featuredLimit) {
              throw new ForbiddenException(
                plan.featuredLimit === 0
                  ? 'Featuring a listing needs a paid plan. Choose one from Buy a Plan.'
                  : `Your plan includes ${plan.featuredLimit} featured listing${plan.featuredLimit === 1 ? '' : 's'}, and they are all in use. Un-feature one first, or move up a plan.`,
              );
            }
          }
        }

        const property = await this.propertyModel
          .findByIdAndUpdate(
            id,
            {
              isFeatured,
              featuredAt: isFeatured ? new Date() : null,
              featuredBy: isFeatured ? (userRole === 'ADMIN' ? 'admin' : 'owner') : null,
            },
            { new: true },
          )
          .exec();

        if (!property) {
          throw new NotFoundException('Property not found');
        }

        this.bustPropertyCaches(property.slug ?? undefined).catch(() => {});

        return {
          success: true,
          message: isFeatured ? 'Listing featured' : 'Listing unfeatured',
          property,
        };
      }

      /**
       * Mark a listing sold, rented, or back on the market.
       *
       * The owner may do this themselves — unlike publishing, which is the
       * admin's call. Telling the site a house has gone is a favour to
       * everyone, so nothing should stand between an agent and doing it; the
       * worst case is an agent hiding their own listing, which is theirs to
       * hide.
       *
       * Only two fields move. The moderation `status` is untouched: a sold
       * house is not an unapproved one, and it must not re-enter the approval
       * queue or lose its place in search on the way back.
       */
      async setAvailability(
        id: string,
        availability: 'available' | 'sold' | 'rented',
        userId?: string,
        userRole?: string,
      ) {
        const allowed: Array<'available' | 'sold' | 'rented'> = ['available', 'sold', 'rented'];
        if (!allowed.includes(availability)) {
            throw new BadRequestException(`Invalid availability: ${availability}`);
        }

        const existing = await this.propertyModel
            .findById(id)
            .select('owner slug listingType availability')
            .lean()
            .exec();

        if (!existing) {
            throw new NotFoundException('Property not found');
        }

        if (userRole !== 'ADMIN') {
            if (!userId || !(await this.agency.canManage(existing.owner, userId))) {
                throw new ForbiddenException('You do not have permission to modify this property listing');
            }
        }

        // Back on the market clears the clock, so the fifteen-day window
        // starts again if it sells a second time.
        const property = await this.propertyModel
            .findByIdAndUpdate(
                id,
                {
                    availability,
                    availabilityChangedAt: availability === 'available' ? null : new Date(),
                },
                { new: true },
            )
            .exec();

        this.bustPropertyCaches(property?.slug ?? undefined).catch(() => {});

        return {
            success: true,
            message:
                availability === 'available'
                    ? 'Listing is back on the market'
                    : `Listing marked ${availability}`,
            property,
        };
      }

      /**
       * @param replaceAdditionalPhotos the caller sent the gallery as it should
       *   now be (dashboard forms do), so an empty list means "no extra photos"
       *   rather than "nothing to change". Older clients that post
       *   `existingPhotos` leave it false and keep the merge behaviour.
       */
      async update(id: string, dto: CreatePropertyDto, mainPhotoUrl?: string, additionalPhotosUrls?: string[], userId?: string, userRole?: string, replaceAdditionalPhotos = false) {
        try {
          const property = await this.propertyModel.findById(id).exec();
          if (!property) {
            throw new NotFoundException('Property not found');
          }

          // Allow update if user is ADMIN or the actual OWNER
          if (userRole !== 'ADMIN' && !(await this.agency.canManage(property.owner, String(userId)))) {
            throw new ForbiddenException('You do not have permission to modify this property listing');
          }

          // Build update object
          const updateData: any = {
            listingType: dto.listingType,
            propertyType: dto.propertyType,
            area: dto.area,
            title: dto.title,
            location: dto.location,
            bedrooms: Number(dto.bedrooms),
            bathrooms: Number(dto.bathrooms),
            areaSize: Number(dto.areaSize),
            price: Number(dto.price),
            marla: dto.marla ? Number(dto.marla) : 0,
            kanal: dto.kanal ? Number(dto.kanal) : 0,
            description: dto.description,
            contactNumber: dto.contactNumber,
            whatsappNumber: dto.whatsappNumber || dto.contactNumber,
            features: dto.features || [],
            latitude: dto.latitude ? Number(dto.latitude) : undefined,
            longitude: dto.longitude ? Number(dto.longitude) : undefined,
          };

          // Sent as "" when the video was removed, which has to clear the field
          // rather than read as "unchanged".
          if (dto.videoUrl !== undefined) {
            updateData.videoUrl = dto.videoUrl.trim() || null;
            updateData.videoPosterUrl = dto.videoPosterUrl?.trim() || null;
          }

          // Status changes via update() — role-based:
          // - ADMIN: any status allowed
          // - non-admin owner: can flip between 'draft' and 'pending' only
          if (dto.status) {
            if (userRole === 'ADMIN') {
              updateData.status = dto.status;
            } else if (dto.status === 'draft' || dto.status === 'pending') {
              updateData.status = dto.status;
            }
          }

          if (dto.slug && dto.slug.trim() !== '') {
            // Explicitly requested a new slug
            const baseSlug = this.toSlug(dto.slug);
            updateData.slug = await this.generateUniqueSlug(baseSlug, id);
          } else if (dto.title && dto.title !== property.title) {
            // Title has changed, update the slug based on the new title
            const baseSlug = this.toSlug(dto.title);
            updateData.slug = await this.generateUniqueSlug(baseSlug, id);
          } else if (!property.slug && dto.title) {
            // Only generate from title if the property somehow lacks a slug
            const baseSlug = this.toSlug(dto.title);
            updateData.slug = await this.generateUniqueSlug(baseSlug, id);
          }
          // Otherwise, we maintain the existing slug.

          // Only update photos if new ones are provided
          if (mainPhotoUrl) {
            updateData.mainPhotoUrl = mainPhotoUrl;
          }
           
          // Handle additional photos - combine existing and new
          const existingPhotos = dto.existingPhotos || [];
          // Ensure existingPhotos is an array (might be single string if only one sent in form data and not parsed correctly as array)
          const validExistingPhotos = Array.isArray(existingPhotos) ? existingPhotos : [existingPhotos].filter(Boolean);
          
          if (replaceAdditionalPhotos) {
             // The gallery as the user left it — including empty.
             updateData.additionalPhotosUrls = additionalPhotosUrls || [];
          } else if (validExistingPhotos.length > 0 || (additionalPhotosUrls && additionalPhotosUrls.length > 0)) {
             updateData.additionalPhotosUrls = [
                 ...validExistingPhotos,
                 ...(additionalPhotosUrls || [])
             ];
          }

          if (userRole !== 'ADMIN' && userId) {
            const limit = (await this.subscriptionService.getEffectivePlan(String(property.owner)).catch(() => null))?.perks.photosPerProperty ?? 0;
            const before = (property.mainPhotoUrl ? 1 : 0) + (property.additionalPhotosUrls?.length ?? 0);
            const after = ((updateData.mainPhotoUrl ?? property.mainPhotoUrl) ? 1 : 0) + ((updateData.additionalPhotosUrls ?? property.additionalPhotosUrls)?.length ?? 0);
            if (limit > 0 && after > limit && after > before) {
              throw new BadRequestException(`Your plan allows ${limit} photos per listing — remove ${after - Math.max(limit, before)} and save again.`);
            }
          }

          /*
           * Re-scored on edit.
           *
           * Without this, the way past the brain is obvious: post something
           * clean, let it publish, then edit a phone number into the
           * description. So a non-admin editing a live listing is screened
           * again on the new text, and anything that now fails goes back to
           * the queue. An admin's edit is never second-guessed.
           */
          if (
            userRole !== 'ADMIN' &&
            property.status === 'approved' &&
            updateData.status === undefined &&
            this.brain.isEnabled()
          ) {
            const photos = [
              (updateData.mainPhotoUrl ?? property.mainPhotoUrl) as string | undefined,
              ...((updateData.additionalPhotosUrls ?? property.additionalPhotosUrls ?? []) as string[]),
            ].filter((url): url is string => Boolean(url));

            const verdict = await this.brain.review(
              {
                title: String(updateData.title ?? property.title ?? ''),
                description: String(updateData.description ?? property.description ?? ''),
                price: Number(updateData.price ?? property.price) || 0,
                areaSize: Number(updateData.areaSize ?? property.areaSize) || 0,
                marla: Number(updateData.marla ?? property.marla) || 0,
                listingType: (updateData.listingType ?? property.listingType) as 'rent' | 'sale',
                propertyType: String(updateData.propertyType ?? property.propertyType ?? ''),
                bedrooms: Number(updateData.bedrooms ?? property.bedrooms) || 0,
                bathrooms: Number(updateData.bathrooms ?? property.bathrooms) || 0,
                location: String(updateData.location ?? property.location ?? ''),
                contactNumber: String(updateData.contactNumber ?? property.contactNumber ?? ''),
                photos,
                hasVideo: Boolean(updateData.videoUrl ?? property.videoUrl),
                features: (updateData.features ?? property.features ?? []) as string[],
              },
              // No duplicate check here: a listing is not a duplicate of itself.
              undefined,
            );

            updateData.moderationScore = verdict.score;
            updateData.moderationReasons = verdict.reasons;
            updateData.moderationSource = verdict.source;

            if (verdict.action === 'review') {
              updateData.status = 'pending';
              updateData.autoPublished = false;

              this.discord.send({
                title: '⚠️ Live listing pulled back for review after an edit',
                description: String(updateData.title ?? property.title ?? '').slice(0, 300),
                url: '/dashboard/property?status=pending',
                color: DISCORD_COLORS.review,
                fields: [
                  { name: 'Risk score', value: `${verdict.score}/100` },
                  { name: 'Listing id', value: `\`${id}\`` },
                  {
                    name: 'Why',
                    value: verdict.reasons.slice(0, 6).map((reason) => `• ${reason}`).join('\n') || '—',
                    inline: false,
                  },
                ],
              });
            }
          }

          const updatedProperty = await this.propertyModel.findByIdAndUpdate(id, updateData, { new: true }).exec();

          // Bust caches if the listing is (or just became) publicly visible.
          if (updatedProperty?.status === 'approved' || property.status === 'approved') {
              this.bustPropertyCaches(updatedProperty?.slug || property.slug).catch(() => {});
          }
          return updatedProperty;
        } catch (error) {
          console.error('Error updating property:', error);
          throw error;
        }
      }

      /**
       * Renew a Free-plan listing: another month live. An expired one comes
       * back (it takes a slot of the plan again, so the plan must have one);
       * one still live just gets its month restarted. On a paid plan the
       * listing simply stays live with no end date.
       */
      async renew(id: string, userId?: string, userRole?: string) {
        if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Property not found');
        const property = await this.propertyModel.findById(id).exec();
        if (!property) throw new NotFoundException('Property not found');
        if (userRole !== 'ADMIN' && !(await this.agency.canManage(property.owner, String(userId)))) {
          throw new ForbiddenException('You do not have permission to renew this listing');
        }
        const wasExpired = property.status === 'expired';
        if (!wasExpired && !(property.status === 'approved' && property.expiresAt)) {
          throw new BadRequestException('This listing does not need renewing');
        }
        const ownerId = String(property.owner);
        if (wasExpired) {
          const check = await this.subscriptionService.canCreateProperty(ownerId);
          if (!check.canCreate) throw new ForbiddenException(check.message || 'Your plan has no free listing slot');
        }
        const plan = await this.subscriptionService.getEffectivePlan(ownerId);
        const free = plan.tier === 'free' && !plan.subscription;
        const expiresAt = free ? new Date(Date.now() + PropertyService.FREE_LISTING_DAYS * 24 * 60 * 60 * 1000) : null;
        // A field update, not save(): older listings may lack fields today's form requires.
        await this.propertyModel.updateOne(
          { _id: property._id },
          expiresAt ? { $set: { status: 'approved', expiresAt } } : { $set: { status: 'approved' }, $unset: { expiresAt: '' } },
        );
        this.bustPropertyCaches(property.slug).catch(() => {});
        return { _id: String(property._id), status: 'approved', expiresAt };
      }

      async delete(id: string, userId?: string, userRole?: string) {
        try {
          const property = await this.propertyModel.findById(id).exec();
          if (!property) {
            throw new NotFoundException('Property not found');
          }

          // Allow delete if user is ADMIN or the actual OWNER
          // The agency deletes; its agents cannot (they can mark a listing sold or edit it).
          if (userRole !== 'ADMIN' && !(await this.agency.canAdminister(property.owner, String(userId)))) {
            throw new ForbiddenException(
              (await this.agency.agencyOf(String(userId)))
                ? 'Only your agency owner can delete listings. You can mark it sold or edit it.'
                : 'You do not have permission to delete this property listing',
            );
          }

          await this.propertyModel.findByIdAndDelete(id).exec();

          // Even if the listing wasn't approved, bust caches conservatively
          // so any stale list pages refresh immediately.
          this.bustPropertyCaches(property.slug).catch(() => {});

          return {
            success: true,
            message: 'Property deleted successfully'
          };
        } catch (error) {
          console.error('Error deleting property:', error);
          throw error;
        }
      }

      async getLocationStats(city: string, listingType?: string, propertyType?: string): Promise<any> {
        // ⚡ Cache: city stats are aggregation-heavy and rarely change.
        const cacheKey = this.cache.buildKey('properties:stats', [city, listingType, propertyType]);
        return this.cache.wrap(cacheKey, () => this.getLocationStatsImpl(city, listingType, propertyType), {
            ttl: 600,
            tags: [TAG_PROPERTIES],
        });
      }

      private async getLocationStatsImpl(city: string, listingType?: string, propertyType?: string): Promise<any> {
        try {
            const cityRegex = new RegExp(`${city}`, 'i');
            
            const matchStage: any = { status: 'approved' };
            if (listingType) {
                matchStage.listingType = listingType;
            }
            if (propertyType && propertyType !== 'all') {
                matchStage.propertyType = propertyType;
            }
            
            const stats = await this.propertyModel.aggregate([

                { $match: matchStage },
                {
                    $addFields: {
                        areaIdObj: {
                            $cond: {
                                if: { $eq: [{ $type: '$area' }, 'string'] },
                                then: { $toObjectId: '$area' },
                                else: '$area'
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'areas',
                        localField: 'areaIdObj',
                        foreignField: '_id',
                        as: 'areaDetails'
                    }
                },
                { $unwind: { path: '$areaDetails', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        cityIdObj: {
                            $cond: {
                                if: { $eq: [{ $type: '$areaDetails.city' }, 'string'] },
                                then: { $toObjectId: '$areaDetails.city' },
                                else: '$areaDetails.city'
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'cities',
                        localField: 'cityIdObj',
                        foreignField: '_id',
                        as: 'cityDetails'
                    }
                },
                { $unwind: { path: '$cityDetails', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        computedCityName: {
                            $ifNull: ['$cityDetails.name', '$city']
                        }
                    }
                },
                {
                    $match: {
                        $or: [
                            { computedCityName: cityRegex },
                            { location: cityRegex },
                            { title: cityRegex }
                        ]
                    }
                },

                {
                    $facet: {
                        locations: [
                            { 
                                $match: { 
                                    'areaDetails.name': { 
                                        $exists: true, 
                                        $ne: null,
                                        $nin: ['balcony', 'kitchen', 'furnished', 'laundry', 'parking', 'garage', 'swimming pool', 'garden']
                                    },
                                    'cityDetails.name': cityRegex
                                } 
                            },

                            {
                                    $group: {
                                        _id: { name: '$areaDetails.name', id: '$areaDetails._id', slug: '$areaDetails.areaSlug', kind: '$areaDetails.kind', parent: '$areaDetails.parent' },
                                        count: { $sum: 1 }
                                    }
                                },
                                { $sort: { count: -1 } },
                                {
                                    $project: {
                                        name: '$_id.name',
                                        id: '$_id.id',
                                        slug: '$_id.slug',
                                        kind: '$_id.kind',
                                        parent: '$_id.parent',
                                        count: 1,
                                        _id: 0
                                    }
                                }
                            ],

                        summary: [
                            {
                                $group: {
                                    _id: '$propertyType',
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        listingTypes: [
                             {
                                $group: {
                                    _id: '$listingType',
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        total: [
                            { $count: 'count' }
                        ]
                    }
                }
            ]).exec();
    
            const result = stats[0];


            return {
                locations: result.locations,
                summary: result.summary.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
                listingTypes: result.listingTypes.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
                total: result.total[0]?.count || 0
            };
    
        } catch (error) {
            console.error('Error fetching location stats:', error);
            throw error;
        }
    }

    async getPropertyTypes(): Promise<string[]> {
        // ⚡ Cache: tiny payload, very high request volume from filter UIs.
        return this.cache.wrap(
            this.cache.buildKey('properties:types', []),
            () => this.getPropertyTypesImpl(),
            { ttl: 3600, tags: [TAG_PROPERTY_TYPES] },
        );
    }

    private async getPropertyTypesImpl(): Promise<string[]> {
        try {
            const types = await this.propertyModel.distinct('propertyType').exec();
            const defaults = ['house', 'apartment', 'flat', 'commercial', 'office'];
            
            // Merge defaults and distinct types, remove duplicates
            const allTypes = Array.from(new Set([...defaults, ...types]))
                .filter(t => t.toLowerCase() !== 'warehouse');
            return allTypes.sort();
        } catch (error) {
            console.error('Error fetching property types:', error);
            return ['house', 'apartment', 'flat', 'commercial', 'office'];
        }
    }
}
