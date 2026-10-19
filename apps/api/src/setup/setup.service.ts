import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Package } from '@rent-ghar/db/schemas/package.schema';
import { Page } from '@rent-ghar/db/schemas/page.schema';
import { RevalidateService } from '../revalidate/revalidate.service';
import { PLAN_BENEFITS, STATIC_PAGES } from './setup-content';

/*
 * One-time data changes that ship with a release and run by themselves after
 * the deploy (`pm2 restart all`), so nothing has to be done by hand on the
 * server. Each job runs once — a document in `datamigrations` records it —
 * in one process only, ~40 s after start. AUTO_SETUP=false switches it off.
 *
 *   plans-v2         the benefits on the five plans (matched by name; prices
 *                    and listing limits untouched)
 *   static-pages-v1  About, Contact, Privacy Policy and Terms as Static Pages
 *                    (only those that do not exist yet)
 *   brand-name-v1    "PropertyDealer" written as two words, "Property Dealer":
 *                    the Site name setting (when it is still the old default),
 *                    the copyright line and default title, and the four
 *                    built-in Static Pages. Addresses (propertydealer.pk) and
 *                    URLs are left alone.
 */
@Injectable()
export class SetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Package.name) private readonly packages: Model<Package>,
    @InjectModel(Page.name) private readonly pages: Model<Page>,
    private readonly revalidate: RevalidateService,
  ) {}

  onApplicationBootstrap() {
    if ((process.env.AUTO_SETUP ?? 'true').toLowerCase() === 'false') return;
    setTimeout(() => void this.run().catch((e) => this.logger.error(`Setup failed: ${e?.message}`)), 40_000).unref?.();
  }

  private async claim(id: string): Promise<boolean> {
    const col = this.connection.collection('datamigrations');
    try {
      await col.insertOne({ _id: id as any, status: 'running', startedAt: new Date() });
      return true;
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      const retry = await col.findOneAndUpdate(
        { _id: id as any, $or: [{ status: 'failed' }, { status: 'running', startedAt: { $lt: new Date(Date.now() - 3600_000) } }] },
        { $set: { status: 'running', startedAt: new Date() } },
      );
      return !!retry;
    }
  }

  private async finish(id: string, status: 'done' | 'failed', result: unknown) {
    await this.connection.collection('datamigrations').updateOne({ _id: id as any }, { $set: { status, result, finishedAt: new Date() } });
  }

  private async job(id: string, fn: () => Promise<unknown>) {
    if (!(await this.claim(id))) return;
    try {
      const result = await fn();
      await this.finish(id, 'done', result);
      this.logger.log(`${id}: ${JSON.stringify(result)}`);
    } catch (err: any) {
      await this.finish(id, 'failed', err?.message ?? String(err));
      this.logger.error(`${id} failed: ${err?.message}`);
    }
  }

  private async run() {
    await this.job('plans-v2', () => this.plans());
    await this.job('static-pages-v1', () => this.staticPages());
    await this.job('brand-name-v1', () => this.brandName());
  }

  private async brandName() {
    // "PropertyDealer" and "PropertyDealer.pk" as a name → "Property Dealer"; never inside a URL or an email address.
    const fix = (v: unknown) =>
      typeof v === 'string' ? v.replace(/(?<![\w/@.-])PropertyDealer(?:\.pk)?(?![\w@-])/g, 'Property Dealer') : v;
    const settings = this.connection.collection('site_settings');
    const s: any = await settings.findOne({ key: 'site' });
    const set: Record<string, unknown> = {};
    if (s) {
      if (s.siteName === 'PropertyDealer' || s.siteName === 'PropertyDealer.pk') set.siteName = 'Property Dealer';
      for (const k of ['copyrightText', 'seoTitle', 'seoDescription', 'footerAbout', 'tagline']) {
        if (typeof s[k] === 'string' && fix(s[k]) !== s[k]) set[k] = fix(s[k]);
      }
      if (Object.keys(set).length) await settings.updateOne({ _id: s._id }, { $set: set });
    }
    const pages: string[] = [];
    for (const doc of await this.pages.find({ slug: { $in: STATIC_PAGES.map((p) => p.slug) } }).exec()) {
      let changed = false;
      for (const k of ['title', 'metaTitle', 'metaDescription', 'content'] as const) {
        const before = (doc as any)[k];
        const after = fix(before);
        if (after !== before) {
          (doc as any)[k] = after;
          changed = true;
        }
      }
      if (changed) {
        await doc.save();
        pages.push(doc.slug);
      }
    }
    void this.revalidate.revalidate({ tags: ['site-settings', 'pages', ...pages.map((x) => `page:slug:${x}`)], paths: ['/', ...pages.map((x) => `/${x}`)] });
    return { settings: Object.keys(set), pages };
  }

  private async plans() {
    const all = await this.packages.find().exec();
    const updated: string[] = [];
    for (const pkg of all) {
      const benefits = PLAN_BENEFITS[String(pkg.name).trim().toLowerCase()];
      if (!benefits) continue;
      Object.assign(pkg, benefits.perks, { features: benefits.features });
      if (benefits.description) pkg.description = benefits.description;
      await pkg.save();
      updated.push(pkg.name);
    }
    void this.revalidate.revalidate({ tags: ['packages'], paths: ['/', '/packages'] });
    return { updated };
  }

  private async staticPages() {
    const created: string[] = [];
    for (const page of STATIC_PAGES) {
      if (await this.pages.exists({ slug: page.slug })) continue;
      await this.pages.create({ ...page, status: 'PUBLISHED' });
      created.push(page.slug);
    }
    void this.revalidate.revalidate({ tags: ['pages', ...created.map((s) => `page:slug:${s}`)], paths: created.map((s) => `/${s}`) });
    return { created };
  }
}

