import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SocietyMap, SocietyMapDocument } from '@rent-ghar/db/schemas/society-map.schema';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { HALF, cornersOf, fitAffine, fromMerc, mercPixel, type Affine } from './geo';

/*
 * Turns an aligned society map into map tiles.
 *
 * The scan is warped once into Web Mercator at the zoom where one scan pixel
 * is about one screen pixel, then cut into the standard 256-pixel z/x/y grid
 * every web map uses, halving down to six zoom levels lower. Visitors then
 * fetch only the tiles on screen — a 60-megapixel master plan opens on a phone
 * as fast as the street map does — and the tiles sit behind Cloudflare like
 * any other upload.
 *
 * Jobs run one at a time in this process (CPU-heavy, not urgent), and the
 * document carries the progress so the dashboard can show it.
 */

const TILE = 256;
const INTERRUPTED = 'Interrupted by a server restart — run it again.';
const ZOOM_LEVELS = 6;

@Injectable()
export class SocietyMapTiler implements OnModuleInit {
  private readonly logger = new Logger(SocietyMapTiler.name);
  private chain: Promise<void> = Promise.resolve();
  private blank: Buffer | null = null;

  constructor(
    @InjectModel(SocietyMap.name) private readonly model: Model<SocietyMapDocument>,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly revalidate: RevalidateService,
  ) {}

  /**
   * A job interrupted by a restart would read "processing" for ever: it is
   * marked failed, then resumed a minute later. A deploy restarts the API
   * while the big master plans are still tiling (each takes minutes), and
   * nothing used to pick them up again — so those maps stayed blank.
   * At most three attempts, so a plan that crashes the process cannot loop.
   */
  async onModuleInit() {
    await this.model
      .updateMany(
        { 'layers.tiles.status': { $in: ['queued', 'processing'] } },
        { $set: { 'layers.$[l].tiles.status': 'failed', 'layers.$[l].tiles.error': INTERRUPTED } },
        { arrayFilters: [{ 'l.tiles.status': { $in: ['queued', 'processing'] } }] },
      )
      .exec()
      .catch(() => undefined);
    setTimeout(() => void this.resumeInterrupted().catch((e) => this.logger.warn(`Resume failed: ${e?.message}`)), 60_000).unref?.();
  }

  private async resumeInterrupted() {
    const docs = await this.model
      .find({ layers: { $elemMatch: { 'tiles.status': 'failed', 'tiles.error': INTERRUPTED } } })
      .select('_id layers._id layers.tiles layers.controlPoints')
      .lean()
      .exec();
    for (const d of docs as any[]) {
      for (const l of d.layers ?? []) {
        if (l.tiles?.status !== 'failed' || l.tiles?.error !== INTERRUPTED || (l.tiles?.attempts ?? 0) >= 3) continue;
        if (!fitAffine(l.controlPoints ?? [])) continue;
        // Claimed atomically: with several API processes only one takes each layer.
        const claimed = await this.model
          .updateOne(
            { _id: d._id, layers: { $elemMatch: { _id: l._id, 'tiles.status': 'failed', 'tiles.error': INTERRUPTED } } },
            { $set: { 'layers.$.tiles.status': 'queued', 'layers.$.tiles.error': '' } },
          )
          .exec();
        if (!claimed.modifiedCount) continue;
        this.logger.log(`Resuming tiles for ${d._id}/${l._id}`);
        this.chain = this.chain.then(() => this.run(String(d._id), String(l._id))).catch(() => undefined);
      }
    }
  }

  /** Queue a layer for tiling. Returns once it is queued, not when it is done. */
  async enqueue(mapId: string, layerId: string): Promise<void> {
    await this.setTiles(mapId, layerId, { status: 'queued', progress: 0, error: '' });
    this.chain = this.chain.then(() => this.run(mapId, layerId)).catch(() => undefined);
  }

  private async setTiles(mapId: string, layerId: string, patch: Record<string, unknown>) {
    const $set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) $set[`layers.$.tiles.${k}`] = v;
    await this.model.updateOne({ _id: mapId, 'layers._id': layerId }, { $set }).exec();
  }

  private uploadsRoot(): string {
    const cwd = process.cwd();
    const inApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
    return inApi ? path.join(cwd, '..', '..', 'uploads') : path.join(cwd, 'uploads');
  }

  private isLocal(): boolean {
    return (this.config.get<string>('STORAGE_DISK') ?? 'local') === 'local';
  }

  /*
   * Original scans stay private: everything under uploads/ is served to the
   * public, and the clean original is what the watermarked download protects.
   * On local disk they sit beside uploads/, in private-uploads/.
   */
  private privatePath(key: string): string {
    return path.join(this.uploadsRoot(), '..', 'private-uploads', key);
  }

  async saveSource(key: string, body: Buffer): Promise<void> {
    if (!this.isLocal()) {
      await this.storage.putBuffer(`private/${key}`, body, 'application/octet-stream');
      return;
    }
    const full = this.privatePath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async readSource(key: string): Promise<Buffer | null> {
    if (!this.isLocal()) return this.storage.readBuffer(`private/${key}`);
    return fs.readFile(this.privatePath(key)).catch(() => null);
  }

  private async blankTile(): Promise<Buffer> {
    if (!this.blank) {
      this.blank = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .webp({ lossless: true })
        .toBuffer();
    }
    return this.blank;
  }

  private async run(mapId: string, layerId: string): Promise<void> {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), 'society-tiles-'));
    try {
      const doc = await this.model.findById(mapId).lean().exec();
      const layer = doc?.layers?.find((l) => String(l._id) === layerId);
      if (!doc || !layer) return;

      const t = fitAffine(layer.controlPoints ?? []);
      if (!t) throw new Error('At least three well-spread points are needed to place the map.');

      const version = (layer.tiles?.version ?? 0) + 1;
      await this.setTiles(mapId, layerId, { status: 'processing', progress: 1, version, attempts: (layer.tiles?.attempts ?? 0) + 1 });

      const source = await this.readSource(layer.sourceKey);
      if (!source) throw new Error('The uploaded image could not be read.');

      // ── Scale: one scan pixel ≈ one screen pixel at the deepest zoom ──
      const metresPerPixel = Math.sqrt(Math.abs(t[0] * t[4] - t[1] * t[3]));
      const maxZoom = Math.max(14, Math.min(20, Math.round(Math.log2((2 * HALF) / (TILE * metresPerPixel)))));
      const minZoom = maxZoom - ZOOM_LEVELS;

      // Image pixels → global pixels at maxZoom. Mercator y grows north, pixels grow south.
      const k = 1 / mercPixel(maxZoom);
      const A: [number, number, number, number] = [t[0] * k, t[1] * k, -t[3] * k, -t[4] * k];
      const tx = (t[2] + HALF) * k;
      const ty = (HALF - t[5]) * k;

      const W = layer.width;
      const H = layer.height;
      const cornersPx = [[0, 0], [W, 0], [0, H], [W, H]].map(([u, v]) => [A[0] * u! + A[1] * v!, A[2] * u! + A[3] * v!]);
      const minX = Math.min(...cornersPx.map((p) => p[0]!));
      const minY = Math.min(...cornersPx.map((p) => p[1]!));

      // libvips puts the warped image's top-left at the transformed bounding box's corner.
      const level0 = path.join(work, `z${maxZoom}.v`);
      // A plan that is already north-up (a GIS export) needs no turning: at most a
      // resize, which streams — the full affine warp of a 200-megapixel image
      // can take a gigabyte of memory.
      const northUp = Math.abs(A[1]) < 1e-6 * Math.abs(A[0]) && Math.abs(A[2]) < 1e-6 * Math.abs(A[3]) && A[0] > 0 && A[3] > 0;
      const sameScale = Math.abs(A[0] - 1) < 0.002 && Math.abs(A[3] - 1) < 0.002;
      const img = sharp(source, { limitInputPixels: 400e6 }).ensureAlpha();
      const warped = northUp
        ? await (sameScale ? img : img.resize(Math.max(1, Math.round(W * A[0])), Math.max(1, Math.round(H * A[3])), { fit: 'fill', kernel: 'lanczos3' })).toFile(level0)
        : await img
            .affine(A, { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: sharp.interpolators.bicubic })
            .toFile(level0);
      let ox = Math.round(minX + tx);
      let oy = Math.round(minY + ty);

      // ── Plan every level, so progress can be counted ──
      type Level = { z: number; file: string; w: number; h: number; ox: number; oy: number };
      const levels: Level[] = [{ z: maxZoom, file: level0, w: warped.width, h: warped.height, ox, oy }];
      for (let z = maxZoom - 1; z >= minZoom; z--) {
        const prev = levels[levels.length - 1]!;
        const w = Math.max(1, Math.round(prev.w / 2));
        const h = Math.max(1, Math.round(prev.h / 2));
        const file = path.join(work, `z${z}.v`);
        await sharp(prev.file).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).toFile(file);
        ox = Math.round(prev.ox / 2);
        oy = Math.round(prev.oy / 2);
        levels.push({ z, file, w, h, ox, oy });
      }
      const total = levels.reduce((s, l) => {
        const nx = Math.floor((l.ox + l.w - 1) / TILE) - Math.floor(l.ox / TILE) + 1;
        const ny = Math.floor((l.oy + l.h - 1) / TILE) - Math.floor(l.oy / TILE) + 1;
        return s + nx * ny;
      }, 0);

      // ── Cut ──
      const base = `society-maps/${mapId}/${layerId}/v${version}`;
      const blank = await this.blankTile();
      let done = 0;
      let lastReport = Date.now();
      for (const l of levels) {
        for (let gx = Math.floor(l.ox / TILE); gx <= Math.floor((l.ox + l.w - 1) / TILE); gx++) {
          for (let gy = Math.floor(l.oy / TILE); gy <= Math.floor((l.oy + l.h - 1) / TILE); gy++) {
            const key = `${base}/${l.z}/${gx}/${gy}.webp`;
            // The part of this tile the level image covers.
            const left = Math.max(0, gx * TILE - l.ox);
            const top = Math.max(0, gy * TILE - l.oy);
            const right = Math.min(l.w, (gx + 1) * TILE - l.ox);
            const bottom = Math.min(l.h, (gy + 1) * TILE - l.oy);
            const w = right - left;
            const h = bottom - top;
            let body = blank;
            if (w > 0 && h > 0) {
              const { data, info } = await sharp(l.file)
                .extract({ left, top, width: w, height: h })
                .raw()
                .toBuffer({ resolveWithObject: true });
              let opaque = false;
              for (let i = 3; i < data.length; i += 4) {
                if (data[i]! > 8) { opaque = true; break; }
              }
              if (opaque) {
                body = await sharp({ create: { width: TILE, height: TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
                  .composite([{
                    input: data,
                    raw: { width: info.width, height: info.height, channels: 4 },
                    left: Math.max(0, l.ox - gx * TILE),
                    top: Math.max(0, l.oy - gy * TILE),
                  }])
                  .webp({ quality: 82, alphaQuality: 90, effort: 4 })
                  .toBuffer();
              }
            }
            await this.storage.putBuffer(key, body, 'image/webp');
            done++;
            if (Date.now() - lastReport > 1500) {
              lastReport = Date.now();
              await this.setTiles(mapId, layerId, { progress: Math.min(97, Math.round((done / total) * 95) + 2) });
            }
          }
        }
      }

      // ── Where the tiles lie, for the map's tile bounds ──
      const top = levels[0]!;
      const px = mercPixel(maxZoom);
      const [north, west] = fromMerc(top.ox * px - HALF, HALF - top.oy * px);
      const [south, east] = fromMerc((top.ox + top.w) * px - HALF, HALF - (top.oy + top.h) * px);

      // ── A download copy, watermarked ──
      const downloadKey = `society-maps/${mapId}/${layerId}/download-v${version}.jpg`;
      await this.storage.putBuffer(downloadKey, await this.watermarked(source, doc.name), 'image/jpeg');

      const corners = cornersOf(t as Affine, W, H);
      await this.model.updateOne(
        { _id: mapId, 'layers._id': layerId },
        {
          $set: {
            'layers.$.corners': corners,
            'layers.$.downloadUrl': this.storage.getUrl(downloadKey),
            'layers.$.tiles': {
              status: 'ready',
              version,
              progress: 100,
              minZoom,
              maxZoom,
              bounds: [south, west, north, east],
              url: this.storage.getUrl(`${base}/{z}/{x}/{y}.webp`),
              count: done,
              error: '',
              generatedAt: new Date(),
            },
          },
        },
      ).exec();
      this.logger.log(`Tiled ${doc.name} / ${layer.name}: ${done} tiles, z${minZoom}–${maxZoom}`);

      await this.removeOldVersions(mapId, layerId, version);
      await this.revalidate.revalidate({ tags: ['society-maps'], paths: [`/emap/${doc.citySlug}/${doc.slug}`] });
    } catch (err) {
      const message = (err as Error)?.message || 'Tiling failed';
      this.logger.error(`Tiling ${mapId}/${layerId} failed: ${message}`);
      await this.setTiles(mapId, layerId, { status: 'failed', error: message.slice(0, 300) }).catch(() => undefined);
    } finally {
      await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** The scan itself, at most 3000px, with the site's name across it. */
  private async watermarked(source: Buffer, name: string): Promise<Buffer> {
    const img = sharp(source, { limitInputPixels: 400e6 }).resize(3000, 3000, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' });
    const { data, info } = await img.jpeg().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const size = Math.round(Math.max(w, h) / 22);
    const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
    const rows: string[] = [];
    for (let y = -h; y < h * 2; y += size * 5) {
      rows.push(`<text x="${-w}" y="${y}" font-size="${size}">${'PropertyDealer.pk     '.repeat(Math.ceil((w * 3) / (size * 12)))}</text>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <g transform="rotate(-30 ${w / 2} ${h / 2})" fill="#0f172a" fill-opacity="0.10" font-family="Arial, Helvetica, sans-serif" font-weight="700">${rows.join('')}</g>
      <rect x="0" y="${h - size * 1.6}" width="${w}" height="${size * 1.6}" fill="#0f172a" fill-opacity="0.78"/>
      <text x="${size * 0.6}" y="${h - size * 0.5}" font-size="${size * 0.7}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="700">${esc(name)} — PropertyDealer.pk</text>
    </svg>`;
    return sharp(data).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  }

  private async removeOldVersions(mapId: string, layerId: string, keep: number) {
    if (!this.isLocal()) return;
    const dir = path.join(this.uploadsRoot(), 'society-maps', mapId, layerId);
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    for (const e of entries) {
      if ((/^v\d+$/.test(e) && e !== `v${keep}`) || (/^download-v\d+\.jpg$/.test(e) && e !== `download-v${keep}.jpg`)) {
        await fs.rm(path.join(dir, e), { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  /** Remove every file of a layer, or of a whole map. */
  async removeFiles(mapId: string, layerId?: string) {
    if (!this.isLocal()) return;
    const parts = ['society-maps', mapId, ...(layerId ? [layerId] : [])];
    await fs.rm(path.join(this.uploadsRoot(), ...parts), { recursive: true, force: true }).catch(() => undefined);
    await fs.rm(this.privatePath(parts.join('/')), { recursive: true, force: true }).catch(() => undefined);
  }
}
