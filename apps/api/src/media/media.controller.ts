import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { MediaService } from './media.service';
import type { MediaDocument } from '@rent-ghar/db/schemas/media.schema';

/** The wire shape the media library renders. */
function view(doc: any) {
  const uploader =
    doc.uploadedBy &&
    typeof doc.uploadedBy === 'object' &&
    'name' in doc.uploadedBy
      ? {
          id: String(doc.uploadedBy._id),
          name: doc.uploadedBy.name ?? doc.uploadedBy.email,
        }
      : String(doc.uploadedBy ?? '');

  return {
    id: String(doc._id),
    url: doc.url,
    thumbUrl: doc.thumbUrl || doc.url,
    width: doc.width ?? 0,
    height: doc.height ?? 0,
    sizeBytes: doc.sizeBytes ?? 0,
    mime: doc.mime ?? 'image/webp',
    originalName: doc.originalName ?? '',
    title: doc.title ?? '',
    alt: doc.alt ?? '',
    caption: doc.caption ?? '',
    altSource: doc.altSource ?? 'auto',
    aiStatus: doc.aiStatus ?? 'skipped',
    placeholder: doc.placeholder ?? '',
    color: doc.color ?? '',
    folder: doc.folder ?? 'general',
    uploadedBy: uploader,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt ?? ''),
  };
}

/**
 * The media library.
 *
 * Every route is behind the JWT guard — but deliberately NOT behind AdminGuard,
 * because agents need a library too. The service scopes every read and write to
 * the caller's own uploads unless they are an admin.
 */
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * POST /api/media/upload — multipart, 1-20 files under any field name.
   *
   * Bulk by default: the dashboard's upload button, the drag-and-drop zone and
   * the property form all post several files in one request.
   */
  @Post('upload')
  @UseInterceptors(
    AnyFilesInterceptor({ limits: { fileSize: 20 * 1024 * 1024, files: 20 } }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body()
    body: { folder?: string; context?: string; ai?: 'sync' | 'async' | 'off' },
    @Request() req,
  ) {
    if (!files?.length) throw new BadRequestException('No file uploaded');

    const { items, failed } = await this.media.uploadMany(
      files,
      {
        folder: body?.folder ?? 'general',
        context: body?.context ?? null,
        ai: body?.ai === 'sync' || body?.ai === 'off' ? body.ai : 'async',
      },
      req.user.userId,
    );

    if (!items.length) {
      throw new BadRequestException(failed[0]?.error ?? 'Upload failed');
    }

    return {
      success: true,
      data: view(items[0]),
      items: items.map(view),
      failed,
    };
  }

  /** GET /api/media?page=&limit=&search=&folder=&uploadedBy= */
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('folder') folder?: string,
    @Query('uploadedBy') uploadedBy?: string,
    @Request() req?,
  ) {
    const result = await this.media.list(
      {
        page: Number(page) || 1,
        limit: Number(limit) || 40,
        search,
        folder,
        uploadedBy,
      },
      req.user.userId,
      req.user.role,
    );

    return {
      success: true,
      data: result.items.map(view),
      total: result.total,
      page: result.page,
      pages: result.pages,
    };
  }

  /** GET /api/media/stats — file count and bytes, scoped like the listing. */
  @Get('stats')
  async stats(@Request() req) {
    return {
      success: true,
      data: await this.media.stats(req.user.userId, req.user.role),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const doc = await this.media.findOne(id, req.user.userId, req.user.role);
    return { success: true, data: view(doc) };
  }

  /** PATCH /api/media/:id — edit title / alt / caption by hand. */
  @Patch(':id')
  async updateMeta(
    @Param('id') id: string,
    @Body() body: { title?: string; alt?: string; caption?: string },
    @Request() req,
  ) {
    const doc = await this.media.updateMeta(
      id,
      body ?? {},
      req.user.userId,
      req.user.role,
    );
    return { success: true, data: view(doc) };
  }

  /** POST /api/media/:id/ai — (re)write the metadata with the vision model. */
  @Post(':id/ai')
  async regenerate(
    @Param('id') id: string,
    @Body() body: { context?: string },
    @Request() req,
  ) {
    const doc = await this.media.regenerateMeta(
      id,
      body?.context ?? null,
      req.user.userId,
      req.user.role,
    );
    return { success: true, data: view(doc) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    await this.media.remove(id, req.user.userId, req.user.role);
    return { success: true };
  }
}
