import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Media,
  MediaDocument,
  MEDIA_FOLDERS,
} from '@rent-ghar/db/schemas/media.schema';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { ImagePipelineService, pickImageName } from './image-pipeline.service';
import { ImageAiService } from './image-ai.service';

export interface MediaListQuery {
  page?: number;
  limit?: number;
  search?: string;
  folder?: string;
  /** Admin only — browse another user's uploads, or everyone's. */
  uploadedBy?: string;
  /** "image" when picking for a photo field, so videos stay out of the grid. */
  kind?: "image" | "video";
}

export interface UploadOptions {
  folder: string;
  /**
   * What the image is of, in words — the property title, the blog title, the
   * material and city. This is what turns generic alt text into useful alt
   * text, and it also names the file.
   */
  context?: string | null;
  /** 'sync' blocks until the AI replies; 'async' answers first (default). */
  ai?: 'sync' | 'async' | 'off';
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/*
 * Video limits. Deliberately small: this is a walkthrough clip on a listing,
 * not a YouTube upload, and most buyers are on mobile data. The browser checks
 * the same numbers before uploading so nobody waits for a refusal.
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;

const SUPPORTED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const VIDEO_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/* ── Importing what is already on disk (see importExisting) ── */

/** Files the library should not list. */
const IMPORT_SKIP = /(-thumb\.webp|-poster\.webp|\.meta\.json|\.DS_Store|thumbs\.db)$/i;
const IMPORTABLE_IMAGE = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i;

/** "properties/5-marla-house-dha.jpg" → "5 marla house dha" */
function altFromKey(key: string): string {
  const base = key.split('/').pop() ?? key;
  return base
    .replace(/\.[a-z0-9]+$/i, '')
    // Drop a trailing UUID or hash so the alt text reads as words.
    .replace(/[-_][0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Guess the library folder from the directory the file already sits in. */
function folderFromKey(key: string): string {
  const head = key.split('/')[0]?.toLowerCase() ?? '';
  if (head.startsWith('propert')) return 'properties';
  if (head.includes('blog')) return 'blog';
  if (head.includes('rate')) return 'rates';
  if (head.includes('cit')) return 'cities';
  if (head.includes('area')) return 'areas';
  if (head.includes('tile')) return 'tile-categories';
  if (head.includes('page')) return 'pages';
  return 'general';
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    private readonly storage: StorageService,
    private readonly pipeline: ImagePipelineService,
    private readonly ai: ImageAiService,
  ) {}

  private safeFolder(value?: string): string {
    const folder = String(value ?? 'general')
      .toLowerCase()
      .trim();
    return (MEDIA_FOLDERS as readonly string[]).includes(folder)
      ? folder
      : 'general';
  }

  /**
   * Agents only ever see their own uploads; admins see everything.
   * This is the whole of the per-agent gallery scoping — enforced here rather
   * than in the UI, so it holds for a hand-written request too.
   */
  private scopeFor(userId: string, role?: string): Record<string, unknown> {
    if (role === 'ADMIN') return {};
    return { uploadedBy: new Types.ObjectId(userId) };
  }

  /** Store one file: WebP + thumbnail + a library row, then AI metadata. */
  async uploadOne(
    file: Express.Multer.File,
    options: UploadOptions,
    userId: string,
  ): Promise<MediaDocument> {
    if (!file?.buffer?.length) throw new BadRequestException('Empty file');
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `“${file.originalname}” is larger than ${MAX_IMAGE_BYTES / 1048576} MB`,
      );
    }
    if (!ImagePipelineService.isSupportedImage(file.mimetype)) {
      throw new BadRequestException(
        `“${file.originalname}” is not an image we can process`,
      );
    }

    const folder = this.safeFolder(options.folder);
    const context = options.context?.trim() || null;
    const name = pickImageName(file.originalname, context);

    const processed = await this.pipeline.process(file.buffer, name);

    const dir = `${folder}/${ImagePipelineService.datePrefix()}`;
    const key = `${dir}/${processed.stem}.webp`;
    const thumbKey = `${dir}/${processed.stem}-thumb.webp`;

    await Promise.all([
      this.storage.putBuffer(key, processed.main, 'image/webp'),
      this.storage.putBuffer(thumbKey, processed.thumb, 'image/webp'),
    ]);

    const wantsAi = options.ai !== 'off' && this.ai.isEnabled();

    const doc = await this.mediaModel.create({
      url: this.storage.getUrl(key),
      thumbUrl: this.storage.getUrl(thumbKey),
      key,
      mime: 'image/webp',
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
      originalName: file.originalname,
      // Something sensible is in place from the first render; the AI improves it.
      ...this.ai.fallbackMeta({
        folder,
        hint: context,
        name: file.originalname,
      }),
      altSource: 'auto',
      aiStatus: wantsAi ? 'pending' : 'skipped',
      placeholder: processed.placeholder,
      color: processed.color,
      folder,
      uploadedBy: new Types.ObjectId(userId),
    });

    if (!wantsAi) return doc;

    const describe = async () => {
      const meta = await this.ai.describe(processed.main, {
        folder,
        hint: context,
        name: file.originalname,
      });
      await this.mediaModel
        .updateOne(
          { _id: doc._id },
          meta
            ? { ...meta, altSource: 'ai', aiStatus: 'done' }
            : { aiStatus: 'failed' },
        )
        .exec();
      return meta;
    };

    if (options.ai === 'sync') {
      const meta = await describe();
      if (meta) Object.assign(doc, meta, { altSource: 'ai', aiStatus: 'done' });
      else doc.aiStatus = 'failed';
      return doc;
    }

    // Default: answer the upload immediately and let the text catch up. The
    // library polls `aiStatus`, so the badge appears a second or two later.
    setImmediate(() => {
      describe().catch((error) =>
        this.logger.warn(
          `Background AI metadata failed: ${(error as Error).message}`,
        ),
      );
    });

    return doc;
  }

  /**
   * A short walkthrough video for a listing.
   *
   * Stored as uploaded — no transcoding. ffmpeg is not on this server and
   * adding it to answer an upload would turn a 3-second request into a minute
   * of CPU; phones already record H.264 mp4, which every browser plays. The
   * limits below are what keeps that honest, and they are enforced in the
   * browser too so a 200 MB file is refused before it is sent.
   *
   * The poster frame is captured client-side from the first readable frame and
   * uploaded alongside, so a video sits in the library grid looking like any
   * other tile and the gallery has something to show before it plays.
   */
  async uploadVideo(
    file: Express.Multer.File,
    poster: Express.Multer.File | undefined,
    options: UploadOptions & { durationSec?: number },
    userId: string,
  ): Promise<MediaDocument> {
    if (!file?.buffer?.length) throw new BadRequestException('Empty file');

    if (file.size > MAX_VIDEO_BYTES) {
      throw new BadRequestException(
        `“${file.originalname}” is ${(file.size / 1048576).toFixed(0)} MB — the limit is ${MAX_VIDEO_BYTES / 1048576} MB`,
      );
    }

    if (!SUPPORTED_VIDEO_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Only MP4, WebM and MOV videos can be uploaded',
      );
    }

    const duration = Number(options.durationSec) || 0;
    if (duration > MAX_VIDEO_SECONDS + 2) {
      throw new BadRequestException(
        `The video is ${Math.round(duration)} seconds — keep it under ${MAX_VIDEO_SECONDS}`,
      );
    }

    const folder = this.safeFolder(options.folder);
    const context = options.context?.trim() || null;
    const stem = ImagePipelineService.videoStem(file.originalname, context);
    const extension = VIDEO_EXTENSION[file.mimetype] ?? 'mp4';

    const dir = `${folder}/${ImagePipelineService.datePrefix()}`;
    const key = `${dir}/${stem}.${extension}`;

    await this.storage.putBuffer(key, file.buffer, file.mimetype);

    // The poster is an ordinary image, so it goes through the usual pipeline
    // and comes out WebP like everything else.
    let thumbUrl = '';
    if (poster?.buffer?.length && ImagePipelineService.isSupportedImage(poster.mimetype)) {
      try {
        const processed = await this.pipeline.process(poster.buffer, stem);
        const posterKey = `${dir}/${processed.stem}-poster.webp`;
        await this.storage.putBuffer(posterKey, processed.thumb, 'image/webp');
        thumbUrl = this.storage.getUrl(posterKey);
      } catch (error) {
        this.logger.warn(
          `Could not store the video poster: ${(error as Error).message}`,
        );
      }
    }

    const label = context ? `${context} — video tour` : 'Property video tour';

    return this.mediaModel.create({
      url: this.storage.getUrl(key),
      // Falls back to the video's own URL so the grid never has an empty src.
      thumbUrl: thumbUrl || this.storage.getUrl(key),
      key,
      mime: file.mimetype,
      sizeBytes: file.size,
      durationSec: Math.round(duration),
      kind: 'video',
      originalName: file.originalname,
      title: label,
      alt: label,
      caption: '',
      altSource: 'auto',
      // No vision model is run on video: one frame tells it very little and it
      // would cost a request per upload.
      aiStatus: 'skipped',
      folder,
      uploadedBy: new Types.ObjectId(userId),
    });
  }

  /** Bulk upload. One bad file reports itself without sinking the batch. */
  async uploadMany(
    files: Express.Multer.File[],
    options: UploadOptions,
    userId: string,
  ): Promise<{
    items: MediaDocument[];
    failed: { name: string; error: string }[];
  }> {
    const items: MediaDocument[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const file of files) {
      try {
        items.push(await this.uploadOne(file, options, userId));
      } catch (error) {
        failed.push({
          name: file?.originalname ?? 'file',
          error: (error as Error).message || 'Upload failed',
        });
      }
    }

    return { items, failed };
  }

  /**
   * Brings images already sitting on disk into the library.
   *
   * The library lists database rows, and everything uploaded before it existed
   * was written straight to disk with no row — so an admin opening the gallery
   * on a site full of pictures saw an empty grid. There is a CLI script for
   * this (scripts/import-existing-media.ts), but a button in the page is what
   * actually gets used.
   *
   * ⚠️ Writes rows only. Every file keeps its exact path and extension — the
   * site is live and ranked, so nothing is renamed, moved, converted or
   * deleted. Idempotent: running it twice adds nothing.
   */
  async importExisting(adminId: string): Promise<{
    imported: number;
    alreadyPresent: number;
    scanned: number;
  }> {
    const files = await this.storage.listFiles('');
    const images = files.filter(
      (file) => IMPORTABLE_IMAGE.test(file.key) && !IMPORT_SKIP.test(file.key),
    );

    let imported = 0;
    let alreadyPresent = 0;

    for (const file of images) {
      if (await this.mediaModel.exists({ key: file.key })) {
        alreadyPresent += 1;
        continue;
      }

      const url = this.storage.getUrl(file.key);
      const name = altFromKey(file.key);

      await this.mediaModel.create({
        url,
        // These have no separate thumbnail; the grid uses the full image.
        // Only uploads from here on get a real 480px thumb.
        thumbUrl: url,
        key: file.key,
        mime: 'image/*',
        sizeBytes: file.size ?? 0,
        originalName: file.key.split('/').pop() ?? file.key,
        title: name,
        alt: name,
        caption: '',
        altSource: 'auto',
        aiStatus: 'skipped',
        kind: 'image',
        folder: folderFromKey(file.key),
        uploadedBy: new Types.ObjectId(adminId),
        imported: true,
        createdAt: file.modified ?? new Date(),
      });

      imported += 1;
    }

    this.logger.log(
      `Imported ${imported} existing images (${alreadyPresent} already present, ${images.length} scanned)`,
    );

    return { imported, alreadyPresent, scanned: images.length };
  }

  async list(query: MediaListQuery, userId: string, role?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 40));

    const filter: Record<string, unknown> = { ...this.scopeFor(userId, role) };

    if (query.kind === 'image') {
      // Rows written before videos existed have no kind at all, so "not a
      // video" is the only correct test here.
      filter.kind = { $ne: 'video' };
    } else if (query.kind === 'video') {
      filter.kind = 'video';
    }

    if (query.folder) filter.folder = this.safeFolder(query.folder);

    // An admin may narrow the library to one uploader.
    if (
      role === 'ADMIN' &&
      query.uploadedBy &&
      Types.ObjectId.isValid(query.uploadedBy)
    ) {
      filter.uploadedBy = new Types.ObjectId(query.uploadedBy);
    }

    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [{ originalName: rx }, { title: rx }, { alt: rx }];
    }

    const [total, docs] = await Promise.all([
      this.mediaModel.countDocuments(filter).exec(),
      this.mediaModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('uploadedBy', 'name email')
        .lean()
        .exec(),
    ]);

    return {
      items: docs,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /** Load one row, refusing anything the caller does not own. */
  private async ownedById(id: string, userId: string, role?: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid media id');
    const doc = await this.mediaModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Image not found');
    if (role !== 'ADMIN' && String(doc.uploadedBy) !== String(userId)) {
      throw new ForbiddenException('This image belongs to another account');
    }
    return doc;
  }

  async findOne(id: string, userId: string, role?: string) {
    return this.ownedById(id, userId, role);
  }

  async updateMeta(
    id: string,
    patch: { title?: string; alt?: string; caption?: string },
    userId: string,
    role?: string,
  ) {
    const doc = await this.ownedById(id, userId, role);

    if (typeof patch.title === 'string')
      doc.title = patch.title.trim().slice(0, 200);
    if (typeof patch.caption === 'string')
      doc.caption = patch.caption.trim().slice(0, 300);
    if (typeof patch.alt === 'string') {
      doc.alt = patch.alt.trim().slice(0, 200);
      // A human edit outranks the AI, and stops a later rewrite looking wrong.
      doc.altSource = 'user';
    }

    await doc.save();
    return doc;
  }

  /** (Re)write the metadata for an image that already exists. */
  async regenerateMeta(
    id: string,
    context: string | null,
    userId: string,
    role?: string,
  ) {
    const doc = await this.ownedById(id, userId, role);
    if (!this.ai.isEnabled()) {
      throw new BadRequestException(
        'AI descriptions are not configured — set OPENAI_API_KEY on the API.',
      );
    }

    const buffer = await this.storage.readBuffer(doc.key);
    if (!buffer)
      throw new NotFoundException('The image file is missing from storage');

    const meta = await this.ai.describe(buffer, {
      folder: doc.folder,
      hint: context || doc.title || null,
      name: doc.originalName,
    });
    if (!meta) {
      doc.aiStatus = 'failed';
      await doc.save();
      throw new BadRequestException(
        "The AI couldn't describe this image — try again",
      );
    }

    Object.assign(doc, meta, { altSource: 'ai', aiStatus: 'done' });
    await doc.save();
    return doc;
  }

  async remove(id: string, userId: string, role?: string) {
    const doc = await this.ownedById(id, userId, role);

    // Best-effort: a missing file must not block removing the row, or the
    // library would keep showing something that is already gone.
    await Promise.all([
      this.storage.deleteFile(doc.key).catch(() => false),
      this.storage
        .deleteFile(doc.key.replace(/\.webp$/, '-thumb.webp'))
        .catch(() => false),
    ]);

    await this.mediaModel.deleteOne({ _id: doc._id }).exec();
    return { success: true };
  }

  /** Totals for the library footer. Scoped the same way as the listing. */
  async stats(userId: string, role?: string) {
    const [row] = await this.mediaModel
      .aggregate<{
        files: number;
        bytes: number;
      }>([{ $match: this.scopeFor(userId, role) }, { $group: { _id: null, files: { $sum: 1 }, bytes: { $sum: '$sizeBytes' } } }])
      .exec();

    return {
      files: row?.files ?? 0,
      bytes: row?.bytes ?? 0,
      aiEnabled: this.ai.isEnabled(),
    };
  }
}
