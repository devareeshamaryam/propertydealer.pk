import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SocietyMapService } from './society-map.service';
import { SocietyDataService } from './society-data.service';

/*
 * Data that ships with the code, put in place by the deploy itself — so
 * `git pull && npm run build && pm2 restart all` is all it takes.
 *
 *   1. scripts/areas/plan.json — the areas clean-up (duplicates merged,
 *      names cleaned, centres, new societies). Run once per plan, through
 *      scripts/areas/apply-plan.js, which writes a backup first.
 *   2. data/society-maps/<city>-<slug>/ — ready society maps (DHA Lahore's
 *      phases). Each is imported once, if no map is at its address yet; its
 *      tiles are then made in the background.
 *   3. data/society-plots/<city>-<name>.ndjson.gz — plots from a society's GIS.
 *   4. Once: the society pages without a map of their own (an outline or an
 *      authority's record, imported earlier) are removed — the eMap shows
 *      only societies with a real map, the way emap.pk does.
 *
 * Runs ~30 s after start, in the background, in one process only (a lock
 * document in `datamigrations`), and never again for the same data.
 * AUTO_SETUP=false switches it off.
 */
@Injectable()
export class SocietyMapSetup implements OnApplicationBootstrap {
  private readonly logger = new Logger(SocietyMapSetup.name);

  constructor(
    private readonly maps: SocietyMapService,
    private readonly data: SocietyDataService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  onApplicationBootstrap() {
    if ((process.env.AUTO_SETUP ?? 'true').toLowerCase() === 'false') return;
    setTimeout(() => void this.run().catch((e) => this.logger.error(`Setup failed: ${e?.message}`)), 30_000).unref?.();
  }

  private root(): string {
    const cwd = process.cwd();
    const inApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
    return inApi ? path.join(cwd, '..', '..') : cwd;
  }

  /** True when this process got the job: first to claim it, or the last try failed or died. */
  private async claim(id: string): Promise<boolean> {
    const col = this.connection.collection('datamigrations');
    try {
      await col.insertOne({ _id: id as any, status: 'running', startedAt: new Date() });
      return true;
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      // A failed run is tried again on the next start; a running one only if its process died.
      const stale = await col.findOneAndUpdate(
        { _id: id as any, $or: [{ status: 'failed' }, { status: 'running', startedAt: { $lt: new Date(Date.now() - 3600_000) } }] },
        { $set: { status: 'running', startedAt: new Date() } },
      );
      return !!stale;
    }
  }

  private async finish(id: string, status: 'done' | 'failed', result: unknown) {
    await this.connection.collection('datamigrations').updateOne({ _id: id as any }, { $set: { status, result, finishedAt: new Date() } });
  }

  /**
   * The whole run belongs to one process at a time. Each step has its own
   * lock as well, but with several API processes (pm2 cluster) one of them
   * could reach "import plots" while another was still creating the maps
   * those plots belong to.
   */
  private async lock(): Promise<boolean> {
    const col = this.connection.collection('datamigrations');
    const now = new Date();
    try {
      const r = await col.findOneAndUpdate(
        { _id: 'society-setup-lock' as any, $or: [{ until: { $lt: now } }, { until: { $exists: false } }] },
        { $set: { until: new Date(now.getTime() + 30 * 60_000), pid: process.pid, startedAt: now } },
        { upsert: true, returnDocument: 'after' },
      );
      return !!r;
    } catch (err: any) {
      if (err?.code === 11000) return false; // held by another process
      throw err;
    }
  }

  private async unlock() {
    await this.connection
      .collection('datamigrations')
      .updateOne({ _id: 'society-setup-lock' as any, pid: process.pid }, { $set: { until: new Date(0) } })
      .catch(() => undefined);
  }

  private async run() {
    if (!(await this.lock())) {
      this.logger.log('Society setup is running in another process.');
      return;
    }
    try {
      await this.runLocked();
    } finally {
      await this.unlock();
    }
  }

  private async runLocked() {
    const root = this.root();
    await this.applyAreasPlan(root);
    await this.importMaps(root);
    await this.importPlots(root);
    await this.removeUnmapped();
    const counts = await this.data.syncPlotCounts().catch(() => null);
    if (counts?.fixed) this.logger.log(`Plot counts updated on ${counts.fixed} maps`);
  }

  private static async hashOf(file: string) {
    return createHash('sha1').update(await fs.readFile(file)).digest('hex').slice(0, 12);
  }

  private async importPlots(root: string) {
    const dir = path.join(root, 'data', 'society-plots');
    const files = (await fs.readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.ndjson.gz')).sort();
    for (const f of files) {
      const file = path.join(dir, f);
      const id = `society-plots-${f.replace(/\.ndjson\.gz$/, '')}-${await SocietyMapSetup.hashOf(file)}`;
      if (!(await this.claim(id))) continue;
      try {
        const r = await this.data.importPlots(file, f.split('-')[0]!);
        await this.finish(id, 'done', r);
        this.logger.log(`Plots ${f}: ${JSON.stringify(r)}`);
      } catch (err: any) {
        await this.finish(id, 'failed', err?.message ?? String(err));
        this.logger.error(`Plots ${f} failed: ${err?.message}`);
      }
    }
  }

  private async removeUnmapped() {
    const id = 'society-unmapped-removed-v1';
    if (!(await this.claim(id))) return;
    try {
      const r = await this.data.removeUnmapped();
      await this.finish(id, 'done', r);
      this.logger.log(`Society pages without a map removed: ${JSON.stringify(r)}`);
    } catch (err: any) {
      await this.finish(id, 'failed', err?.message ?? String(err));
      this.logger.error(`Removing society pages without a map failed: ${err?.message}`);
    }
  }

  /** scripts/areas/plan.json, then plan-2.json, … — each applied once (by its content), in order. */
  private async applyAreasPlan(root: string) {
    const dir = path.join(root, 'scripts', 'areas');
    const files = (await fs.readdir(dir).catch(() => [] as string[]))
      .filter((f) => /^plan(-\d+)?\.json$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 1) - Number(b.match(/\d+/)?.[0] ?? 1));
    for (const f of files) await this.applyAreasPlanFile(root, f);
  }

  private async applyAreasPlanFile(root: string, f: string) {
    const planFile = path.join(root, 'scripts', 'areas', f);
    const plan = await fs.readFile(planFile).catch(() => null);
    if (!plan) return;
    // plan.json keeps its original id, so it is not applied a second time.
    const name = f === 'plan.json' ? 'areas-plan' : `areas-${f.replace(/\.json$/, '')}`;
    const id = `${name}-${createHash('sha1').update(plan).digest('hex').slice(0, 12)}`;
    if (!(await this.claim(id))) return;
    this.logger.log(`Applying the areas plan ${f} (backup first)…`);
    const out: string[] = [];
    const code = await new Promise<number>((resolve) => {
      const child = spawn(process.execPath, [path.join(root, 'scripts', 'areas', 'apply-plan.js'), '--plan', planFile, '--apply'], { cwd: root, env: process.env });
      child.stdout.on('data', (d) => out.push(String(d)));
      child.stderr.on('data', (d) => out.push(String(d)));
      child.on('close', (c) => resolve(c ?? 1));
      child.on('error', () => resolve(1));
    });
    const tail = out.join('').split('\n').slice(-25).join('\n');
    await this.finish(id, code === 0 ? 'done' : 'failed', tail);
    if (code === 0) this.logger.log(`Areas plan applied.\n${tail}`);
    else this.logger.error(`Areas plan failed (exit ${code}).\n${tail}`);
  }

  private async importMaps(root: string) {
    const dir = path.join(root, 'data', 'society-maps');
    const folders = (await fs.readdir(dir, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const name of folders) {
      const folder = path.join(dir, name);
      const meta = JSON.parse(await fs.readFile(path.join(folder, 'map.json'), 'utf8').catch(() => '{}'));
      if (!meta.citySlug || !meta.slug) continue;
      /*
       * A map ships once. To replace one already on the site (a better plan),
       * raise "revision" in its map.json: each revision above 1 is imported
       * once, over the map at the same address — the page and its URL stay.
       */
      const revision = Math.max(1, Math.floor(Number(meta.revision) || 1));
      const id = revision > 1 ? `society-map-${meta.citySlug}-${meta.slug}-r${revision}` : `society-map-${meta.citySlug}-${meta.slug}`;
      const exists = await this.maps.exists(meta.citySlug, meta.slug);
      // Already here (imported before, or made in the dashboard): leave it alone unless a new revision ships.
      if (exists && revision === 1) continue;
      if (!(await this.claim(id))) continue;
      try {
        const r = await this.maps.importFolder(folder, exists);
        await this.finish(id, 'done', r);
        this.logger.log(`Imported society map ${meta.name}: ${JSON.stringify(r)}`);
      } catch (err: any) {
        await this.finish(id, 'failed', err?.message ?? String(err));
        this.logger.error(`Society map ${meta.name} failed: ${err?.message}`);
      }
    }
  }
}

