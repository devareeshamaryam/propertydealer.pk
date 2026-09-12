import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Property } from '@rent-ghar/db/schemas/property.schema';
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
            })
            const saved = await property.save()

            // Bust caches only when the new property is publicly visible.
            // Drafts/pending listings don't appear on the public site, so
            // there's nothing to invalidate.
            if (saved.status === 'approved') {
                this.bustPropertyCaches(saved.slug).catch(() => {});
            }
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
          return property;
        }
      }

      async updateStatus(id: string, status: 'pending' | 'approved' | 'rejected' | 'draft' = 'approved') {
        const allowed: Array<'pending' | 'approved' | 'rejected' | 'draft'> = ['pending', 'approved', 'rejected', 'draft'];
        if (!allowed.includes(status)) {
            throw new BadRequestException(`Invalid status: ${status}`);
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

      async update(id: string, dto: CreatePropertyDto, mainPhotoUrl?: string, additionalPhotosUrls?: string[], userId?: string, userRole?: string) {
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
          
          if (validExistingPhotos.length > 0 || (additionalPhotosUrls && additionalPhotosUrls.length > 0)) {
             updateData.additionalPhotosUrls = [
                 ...validExistingPhotos,
                 ...(additionalPhotosUrls || [])
             ];
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
