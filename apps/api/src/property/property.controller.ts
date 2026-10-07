import { Body, Controller, Get, HttpCode, Post, Query, UseGuards, UseInterceptors, Request, Param, Patch, Delete, Put, UploadedFile, UnauthorizedException, BadRequestException, Header, Res, Logger } from "@nestjs/common";
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { PropertyService, type DashboardPropertyFilters } from './property.service';
import { PropertyCountersService } from './property-counters.service';
import { UserService } from '../user/user.service';
import { CreatePropertyDto } from './dto/create-property.dto'; // Local DTO with validation
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';


@Controller('properties')
export class PropertyController {
  private readonly logger = new Logger(PropertyController.name);

  constructor(
    private readonly propertyService: PropertyService,
    // Temporarily commented out to debug DI issue
    private readonly storageService: StorageService,
    private readonly propertyCounters: PropertyCountersService,
    private readonly users: UserService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @Request() req,
    @Body() dto: CreatePropertyDto,
  ) {
    // Extract files from request
    const files = req.files as Express.Multer.File[]
    console.log('Received files:', files?.length || 0, 'files');
    const mainPhoto = files?.find(file => file.fieldname === 'mainPhoto')
    const additionalPhotos = files?.filter(file => file.fieldname === 'additionalPhotos') || []

    // Upload files using StorageService OR use existing URLs from body (gallery)
    let mainPhotoUrl: string | undefined;
    if (mainPhoto) {
      console.log('Uploading main photo:', mainPhoto.originalname);
      const key = await this.storageService.upload(mainPhoto, 'properties');
      mainPhotoUrl = this.storageService.getUrl(key);
      console.log('Main photo uploaded:', mainPhotoUrl);
    } else if (req.body.mainPhotoUrl) {
      // If no uploaded main photo but a URL is provided (selected from gallery), use it
      mainPhotoUrl = req.body.mainPhotoUrl;
      console.log('Using existing main photo URL from body:', mainPhotoUrl);
    }
    
    let additionalPhotosUrls: string[] = [];
    if (additionalPhotos.length > 0) {
      console.log('Uploading', additionalPhotos.length, 'additional photos');
      const uploadedUrls = await Promise.all(
        additionalPhotos.map(async (file) => {
          const key = await this.storageService.upload(file, 'properties');
          return this.storageService.getUrl(key);
        })
      );
      additionalPhotosUrls = [...additionalPhotosUrls, ...uploadedUrls];
      console.log('Additional photos uploaded:', uploadedUrls);
    }

    // Merge additional photo URLs coming directly from the body (selected from gallery)
    const bodyAdditional = (req.body.additionalPhotosUrls ??
      req.body['additionalPhotosUrls[]']) as string | string[] | undefined;
    if (bodyAdditional) {
      const bodyUrls = Array.isArray(bodyAdditional) ? bodyAdditional : [bodyAdditional];
      additionalPhotosUrls = [...additionalPhotosUrls, ...bodyUrls];
      console.log('Additional photos URLs from body:', bodyUrls);
    }

    // Extract user from request
    const user = req.user;
    console.log('Property Create - User from request:', user);
    
    if (!user || !user.userId) {
        console.error('User not found in request despite JwtAuthGuard');
        // This should theoretically be caught by the guard, but just in case
        throw new UnauthorizedException('User not authenticated');
    }

    const userId = user.userId;
    
    // Validate User ID format to prevent Mongoose cast errors
    // access Types from mongoose is needed, let's just check regex for now to avoid importing Types if not already
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(userId)) {
         console.error('Invalid user ID format:', userId);
         // If it's the temp ID causing issues, we'll see it here
         throw new BadRequestException(`Invalid user ID format: ${userId}`);
    }

    const userRole = user.role || 'USER';

    // NOTE: this handler wrote a trace to ./debug.log with fs.appendFileSync
    // on every request. Synchronous disk writes block Node's single event
    // loop, so they slowed down every other in-flight request too — not just
    // this one. Diagnostics go through the Nest logger now.
    try {
      const created = await this.propertyService.create(userId, dto as any, mainPhotoUrl, additionalPhotosUrls, userRole)

      /*
       * Posting a property is what makes somebody an agent.
       *
       * Accounts start as USER — including the ones created just to see a
       * phone number — so the first listing is the moment the role changes.
       * Nobody has to pick 'agent' at sign-up and nobody is mislabelled for
       * signing up to contact someone. Non-fatal: a failed promotion must not
       * lose the listing that was just created.
       */
      if (userRole !== 'ADMIN' && userRole !== 'AGENT') {
        this.users.promoteToAgent(userId).catch((error) =>
          this.logger.warn(
            `Could not promote ${userId} to AGENT: ${(error as Error)?.message}`,
          ),
        );
      }

      const message = (created as any)?.status === 'draft'
        ? 'Property saved as draft'
        : (created as any)?.status === 'approved'
          ? 'Property published successfully'
          : 'Property submitted for approval';
      return { message, property: created }
    } catch (error: any) {
      this.logger.error(`Failed to create property for user ${userId}: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @Get('stats/locations')
  async getStats(
    @Query('city') city: string, 
    @Query('listingType') listingType?: string,
    @Query('propertyType') propertyType?: string
  ) {
    if (!city) {
        throw new BadRequestException('City is required');
    }
    return this.propertyService.getLocationStats(city, listingType, propertyType);
  }

  @Get()
  @Header('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
  async findAll(
    @Query('ownerId') ownerId?: string,
    @Query('cityId') cityId?: string, 
    @Query('city') city?: string,
    @Query('areaId') areaId?: string,

    @Query('areaSlug') areaSlug?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('areaMin') areaMin?: string,
    @Query('areaMax') areaMax?: string,
    @Query('marlaMin') marlaMin?: string,
    @Query('marlaMax') marlaMax?: string,
    @Query('beds') beds?: string,
    @Query('baths') baths?: string,
    @Query('type') type?: string,
    @Query('purpose') purpose?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {

    try {
      const filters: any = {};
      if (ownerId) filters.ownerId = ownerId;
      if (cityId) filters.cityId = cityId;
      if (areaId) filters.areaId = areaId;
      if (priceMin) filters.priceMin = Number(priceMin);
      if (priceMax) filters.priceMax = Number(priceMax);
      if (areaMin) filters.areaMin = Number(areaMin);
      if (areaMax) filters.areaMax = Number(areaMax);
      if (marlaMin) filters.marlaMin = Number(marlaMin);
      if (marlaMax) filters.marlaMax = Number(marlaMax);
      if (beds) filters.beds = Number(beds);
      if (baths) filters.baths = Number(baths);
      if (type) filters.type = type;
      if (purpose) filters.purpose = purpose;
      if (search) filters.search = search;
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);
      if (city) filters.cityName = city; // Pass derived city name if explicit cityId is not enough



      return await this.propertyService.findAllApproved(filters);
    } catch (error) {
      console.error('Error in findAll controller:', error);
      throw error;
    }
  }

  @Get('types')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=7200')
  async getPropertyTypes() {
    return this.propertyService.getPropertyTypes();
  }

  /**
   * Dashboard list. Paginated and filtered server-side.
   *
   * Previously this took only cityId/areaId and returned the entire
   * collection, so every dashboard page load transferred every property the
   * caller could see. It now mirrors the public `findAll` contract:
   * `{ properties, total, totalPages, currentPage, limit }`.
   *
   * Passing `limit=0` returns every row in one page — kept for the few callers
   * that genuinely need totals across the whole set (e.g. the overview's
   * status counts), and capped by the service.
   */
  @Get('all')
  @UseGuards(JwtAuthGuard)
  async findAllProperties(
    @Request() req,
    @Query('cityId') cityId?: string,
    @Query('areaId') areaId?: string,
    @Query('status') status?: string,
    @Query('propertyType') propertyType?: string,
    @Query('listingType') listingType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const filters: DashboardPropertyFilters = {};
    if (cityId) filters.cityId = cityId;
    if (areaId) filters.areaId = areaId;
    if (status && status !== 'all') filters.status = status;
    if (propertyType && propertyType !== 'all') filters.propertyType = propertyType;
    if (listingType && listingType !== 'all') filters.listingType = listingType;
    if (search?.trim()) filters.search = search.trim();
    if (sortBy) filters.sortBy = sortBy;
    if (sortDir === 'asc' || sortDir === 'desc') filters.sortDir = sortDir;

    const parsedPage = Number(page);
    if (Number.isFinite(parsedPage) && parsedPage > 0) filters.page = Math.floor(parsedPage);

    const parsedLimit = Number(limit);
    if (Number.isFinite(parsedLimit) && parsedLimit >= 0) filters.limit = Math.floor(parsedLimit);

    return this.propertyService.findAll(filters, req.user?.userId, req.user?.role);
  }

  /**
   * Status counts for the dashboard's filter tabs and overview cards.
   * One aggregation instead of downloading every document to count them.
   */
  @Get('all/stats')
  @UseGuards(JwtAuthGuard)
  async getDashboardStats(@Request() req) {
    return this.propertyService.getDashboardStats(req.user?.userId, req.user?.role);
  }

  /**
   * Listing performance for whoever is asking: an agent's own numbers, or the
   * whole platform for an admin.
   */
  @Get('analytics/me')
  @UseGuards(JwtAuthGuard)
  async getMyPerformance(@Request() req) {
    return this.propertyService.getPerformance(req.user?.userId, req.user?.role);
  }

  /*
   * ── Event collection ────────────────────────────────────────────────────
   *
   * Public and deliberately cheap: nothing is read, nothing is validated
   * beyond the id, and the response does not wait for a database write (see
   * PropertyCountersService). They always answer 200 — a failed counter must
   * never show the visitor an error on a page that rendered perfectly.
   */

  /** One detail-page open. The browser de-duplicates per session. */
  @Post('analytics/view')
  @HttpCode(202)
  trackView(@Request() req, @Body('id') id?: string) {
    if (typeof id === 'string') {
      void this.propertyCounters.countView(id, this.fingerprint(req));
    }
    return { ok: true };
  }

  /** The cards that actually came into view, batched by the feed. */
  @Post('analytics/impressions')
  @HttpCode(202)
  trackImpressions(@Body('ids') ids?: unknown) {
    if (Array.isArray(ids)) {
      this.propertyCounters.countImpressions(
        // Cap it: a batch is what one screen showed, not a list of everything.
        ids.filter((id): id is string => typeof id === 'string').slice(0, 60),
      );
    }
    return { ok: true };
  }

  /** A tap on Call or WhatsApp. */
  @Post('analytics/contact')
  @HttpCode(202)
  trackContact(
    @Request() req,
    @Body('id') id?: string,
    @Body('kind') kind?: string,
  ) {
    if (typeof id === 'string' && (kind === 'phone' || kind === 'whatsapp')) {
      void this.propertyCounters.countContact(id, kind, this.fingerprint(req));
    }
    return { ok: true };
  }

  /**
   * A coarse "who is this" for the flood ceiling only — never stored, never
   * logged, and not an identity: the client address (Express resolves it
   * through the trusted proxy) plus the browser string.
   */
  private fingerprint(req: { ip?: string; headers?: Record<string, unknown> }): string {
    const agent = String(req.headers?.['user-agent'] ?? '').slice(0, 80);
    return `${req.ip ?? 'unknown'}|${agent}`;
  }

  // get property by slug (must be before :id route)
  @Get('slug/:slug')
  @Header('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400')
  async findPropertyBySlug(@Param('slug') slug: string) {
    return await this.propertyService.findPropertyBySlug(slug)
  }

  // get property by id (must be after specific routes like 'all')
  @Get(':id')
  async findPropertyById(@Param('id') id: string) {
    try {
      return await this.propertyService.findPropertyByid(id)
    } catch (error) {
      throw error
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: CreatePropertyDto,
  ) {
    try {
      // Extract files from request
      const files = req.files as Express.Multer.File[]
      const mainPhoto = files?.find(file => file.fieldname === 'mainPhoto')
      const additionalPhotos = files?.filter(file => file.fieldname === 'additionalPhotos') || []

      // Upload files using StorageService
      let mainPhotoUrl = mainPhoto
        ? this.storageService.getUrl(await this.storageService.upload(mainPhoto, 'properties'))
        : undefined
      let additionalPhotosUrls = additionalPhotos.length > 0
        ? await Promise.all(
            additionalPhotos.map(async (file) => {
              const key = await this.storageService.upload(file, 'properties');
              return this.storageService.getUrl(key);
            })
          )
        : undefined

      /*
       * Photos picked from the media library arrive as URLs in the body, the
       * same way create() already accepted them — the dashboard uploads them
       * before submitting, so the form posts links instead of megabytes.
       *
       * Read straight off req.body: these are not on CreatePropertyDto, and the
       * global ValidationPipe runs with `whitelist: true`, so they are stripped
       * out of `dto` before this handler ever sees it. Without this, editing a
       * listing silently discarded every photo change — reorder, remove and add
       * all looked like they had worked and nothing was saved.
       */
      if (!mainPhotoUrl && typeof req.body?.mainPhotoUrl === 'string' && req.body.mainPhotoUrl.trim()) {
        mainPhotoUrl = req.body.mainPhotoUrl.trim();
      }

      const bodyAdditional = (req.body?.additionalPhotosUrls ??
        req.body?.['additionalPhotosUrls[]']) as string | string[] | undefined;

      // A body list is authoritative: it is the gallery exactly as the user
      // left it, so removing the last extra photo has to persist as an empty
      // list rather than "no change".
      let replaceAdditionalPhotos = false;
      if (bodyAdditional !== undefined || req.body?.photosProvided === 'true') {
        const bodyUrls = bodyAdditional === undefined
          ? []
          : (Array.isArray(bodyAdditional) ? bodyAdditional : [bodyAdditional]).filter(
              (url): url is string => typeof url === 'string' && url.trim() !== '',
            );
        additionalPhotosUrls = [...bodyUrls, ...(additionalPhotosUrls ?? [])];
        replaceAdditionalPhotos = true;
      }

      const userId = req.user?.userId;
      const userRole = req.user?.role;

      const updated = await this.propertyService.update(id, dto as any, mainPhotoUrl, additionalPhotosUrls, userId, userRole, replaceAdditionalPhotos)
      return { message: 'Property updated successfully', property: updated }
    } catch (error) {
      console.error('Error in update controller:', error);
      throw error;
    }
  }

  /**
   * JwtAuthGuard, not AdminGuard: the service decides. An owner may move their
   * own listing between draft and pending (submit for review / pull it back);
   * publishing, rejecting and un-publishing remain admin-only.
   */
  @Patch(':id/update-status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Request() req,
    @Body('status') status?: 'pending' | 'approved' | 'rejected' | 'draft',
  ) {
    return await this.propertyService.updateStatus(
      id,
      status || 'approved',
      req.user?.userId,
      req.user?.role,
    )
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      return await this.propertyService.delete(id, userId, userRole);
    } catch (error) {
      console.error('Error in delete controller:', error);
      throw error;
    }
  }


  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async uploadImage(@Request() req) {
    const files = req.files as Express.Multer.File[];
    const file = files?.[0] || files?.find(f => f.fieldname === 'file');
    
    if (!file) {
      throw new Error('No file uploaded');
    }
    
    console.log('Uploading file:', file.originalname, 'Size:', file.size, 'bytes');
    const key = await this.storageService.upload(file, 'properties/2026');
    const url = this.storageService.getUrl(key);
    console.log('File uploaded successfully:', key, 'URL:', url);
    return { key, url };
  }

  // ── REPLACED: purana listImages → paginated + search support ──────────────
  @Get('images/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listImages(
    @Query('folder') folder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    try {
      const result = await this.storageService.listFilesPaginated(
        folder || 'properties',
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 50,
        search || '',
      );
      return result;
    } catch (error) {
      console.error('Error listing images:', error);
      throw error;
    }
  }

  // ── NEW: thumbnail endpoint ────────────────────────────────────────────────
  @Get('images/thumbnail/:key')
  async getThumbnail(
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    const decodedKey = decodeURIComponent(key);

    // Security: path traversal se bachao
    if (decodedKey.includes('..') || decodedKey.startsWith('/')) {
      return res.status(400).send('Invalid key');
    }

    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.set('Content-Type', 'image/jpeg');

    try {
      const buffer = await this.storageService.getThumbnail(decodedKey);
      if (!buffer) return res.status(404).send('Image not found');
      res.send(buffer);
    } catch {
      res.status(500).send('Thumbnail generation failed');
    }
  }

  @Delete('images/:key')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteImage(@Param('key') key: string) {
    try {
      // Decode the key (it might be URL encoded)
      const decodedKey = decodeURIComponent(key);
      const deleted = await this.storageService.deleteFile(decodedKey);
      if (deleted) {
        return { message: 'Image deleted successfully', key: decodedKey };
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
}