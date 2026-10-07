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
import { AdminGuard } from '../auth/guards/admin.guard';
import { MAX_VIDEO_BYTES, MediaService } from './media.service';
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
    // Rows written before videos existed have no kind; they are all images.
    kind: doc.kind === 'video' ? 'video' : 'image',
    durationSec: doc.durationSec ?? 0,
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

  /**
   * POST /api/media/upload-video — one short clip, plus its poster frame.
   *
   * Separate from the image route because nothing about it is the same: no
   * sharp, no WebP, no AI, a different size ceiling, and a `video` field plus
   * an optional `poster` field rather than a bag of files.
   */
  @Post('upload-video')
  @UseInterceptors(
    AnyFilesInterceptor({ limits: { fileSize: MAX_VIDEO_BYTES, files: 2 } }),
  )
  async uploadVideo(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { folder?: string; context?: string; durationSec?: string },
    @Request() req,
  ) {
    const video = files?.find((file) => file.fieldname === 'video') ?? files?.[0];
    const poster = files?.find((file) => file.fieldname === 'poster');

    if (!video) throw new BadRequestException('No video uploaded');

    const doc = await this.media.uploadVideo(
      video,
      poster,
      {
        folder: body?.folder ?? 'properties',
        context: body?.context ?? null,
        durationSec: Number(body?.durationSec) || 0,
      },
      req.user.userId,
    );

    return { success: true, data: view(doc) };
  }

  /** GET /api/media?page=&limit=&search=&folder=&uploadedBy= */
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('folder') folder?: string,
    @Query('uploadedBy') uploadedBy?: string,
    @Query('kind') kind?: string,
    @Request() req?,
  ) {
    const result = await this.media.list(
      {
        page: Number(page) || 1,
        limit: Number(limit) || 40,
        search,
        folder,
        uploadedBy,
        kind: kind === 'image' || kind === 'video' ? kind : undefined,
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

  /**
   * POST /api/media/import-existing — admin only.
   *
   * One press instead of an SSH session: lists what is already in storage and
   * writes a library row for anything missing. Files are never touched.
   */
  @Post('import-existing')
  @UseGuards(AdminGuard)
  async importExisting(@Request() req) {
    const result = await this.media.importExisting(req.user.userId);
    return { success: true, data: result };
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
