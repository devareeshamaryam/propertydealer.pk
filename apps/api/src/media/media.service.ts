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

  async list(query: MediaListQuery, userId: string, role?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 40));

    const filter: Record<string, unknown> = { ...this.scopeFor(userId, role) };

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
