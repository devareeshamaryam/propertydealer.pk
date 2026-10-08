import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Property } from '@rent-ghar/db/schemas/property.schema'
import { ListingBrainService } from './listing-brain.service'
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { InjectModel} from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePropertyDto } from './dto/create-property.dto';
import { Area } from '@rent-ghar/db/schemas/area.schema';
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
    constructor(
        @InjectModel(Property.name) private propertyModel: Model<Property>,
        @InjectModel(Area.name) private areaModel: Model<Area>,
        private subscriptionService: SubscriptionService,
        private readonly brain: ListingBrainService,
        private readonly discord: DiscordService,
        private indexNowService: IndexNowService,
        private configService: ConfigService,
        private readonly cache: RedisCacheService,
        private readonly revalidate: RevalidateService,
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
            paths.push(`/p/${affectedSlug}`);
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


        // Drafts do not consume subscription slots — they aren't published yet.
        const consumesSubscription = userRole !== 'ADMIN' && finalStatus !== 'draft';

        if (consumesSubscription) {
          // SYNC: Before checking subscription, ensure the count is accurate
          const actualCount = await this.propertyModel.countDocuments({ 
            owner: userId,
            // status: { $ne: 'deleted' } // depend on business logic if deleted counts
          }).exec();
          
          await this.subscriptionService.syncPropertyUsage(userId, actualCount);

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
              features: dto.features || [],
              owner: userId,
              mainPhotoUrl,
              additionalPhotosUrls: additionalPhotosUrls || [],
              status: finalStatus,
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
        return this.cache.wrap(cacheKey, async () => this.findAllApprovedImpl(filters), {
            ttl: 60,
            tags: [TAG_PROPERTIES],
        });
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
            const searchRegex = new RegExp(`${filters.search.trim()}`, 'i');
            query.$or = [
              { title: searchRegex },
              { location: searchRegex }
            ];
          }

          if (filters?.ownerId) {
            if (!this.isValidObjectId(filters.ownerId)) {
              return { properties: [], total: 0, page: filters?.page || 1, limit: filters?.limit || 12, totalPages: 0 };
            }
            query.owner = new Types.ObjectId(filters.ownerId);
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

            // 1. Relational match via cityId -> areaIds
            if (filters.cityId && this.isValidObjectId(filters.cityId)) {
                // If filtering by city, find all areas in that city first
                const areas = await this.areaModel.find({ city: filters.cityId }).select('_id').lean();
                const areaIds = areas.map(a => a._id);
                if (areaIds.length > 0) {
                    cityOrConditions.push({ area: { $in: areaIds } });
                    // Also include string versions of areaIds for resilience
                    cityOrConditions.push({ area: { $in: areaIds.map(id => id.toString()) } });
                }
            }

            // 2. String match via cityName
            if (filters.cityName) {
                 // Case-insensitive match for city string field
                 const cityRegex = new RegExp(`${filters.cityName}`, 'i');
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
          
          const page = filters?.page || 1;
          const limit = filters?.limit || 12;
          const skip = (page - 1) * limit;

          const [properties, total] = await Promise.all([
            this.propertyModel.find(query)
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(limit)
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

        // AGENT and USER only ever see their own listings in the dashboard.
        if (userRole !== 'ADMIN' && userId) {
          query.owner = userId;
        }

        if (filters.areaId) {
          if (!this.isValidObjectId(filters.areaId)) return null;
          query.area = filters.areaId;
        } else if (filters.cityId) {
          if (!this.isValidObjectId(filters.cityId)) return null;
          const areas = await this.areaModel
            .find({ city: filters.cityId })
            .select('_id')
            .lean();
          if (areas.length === 0) return null;
          query.area = { $in: areas.map((a) => a._id) };
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
            properties,
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
          match.owner = new Types.ObjectId(userId);
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
        return this.cache.wrap(cacheKey, () => this.findPropertyBySlugImpl(slug), {
            ttl: 60,
            tags: [TAG_PROPERTIES, `property:slug:${normalizedSlug}`],
        });
      }

      private async findPropertyBySlugImpl(slug: string) {
        const normalizedSlug = this.toSlug(slug);
        // A miss used to trigger ensureSlugForMissingApproved(), which scanned
        // every approved property and wrote slugs for any that lacked one.
        // That made an unknown slug — including one typed by a crawler — cost a
        // full collection scan plus writes, on an uncacheable 404 path.
        const property = await this.propertyModel
          .findOne({ slug: normalizedSlug, status: 'approved' })
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
            if (!userId || String(existing.owner) !== String(userId)) {
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

        const property = await this.propertyModel.findByIdAndUpdate(id, { status }, { new: true }).exec();

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
          if (userRole !== 'ADMIN' && String(property.owner) !== String(userId)) {
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

      async delete(id: string, userId?: string, userRole?: string) {
        try {
          const property = await this.propertyModel.findById(id).exec();
          if (!property) {
            throw new NotFoundException('Property not found');
          }

          // Allow delete if user is ADMIN or the actual OWNER
          if (userRole !== 'ADMIN' && String(property.owner) !== String(userId)) {
            throw new ForbiddenException('You do not have permission to delete this property listing');
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
            ttl: 60,
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
                                        _id: { name: '$areaDetails.name', id: '$areaDetails._id', slug: '$areaDetails.areaSlug' },
                                        count: { $sum: 1 }
                                    }
                                },
                                { $sort: { count: -1 } },
                                {
                                    $project: {
                                        name: '$_id.name',
                                        id: '$_id.id',
                                        slug: '$_id.slug',
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
            { ttl: 60, tags: [TAG_PROPERTY_TYPES] },
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
