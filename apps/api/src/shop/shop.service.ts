import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CementRate } from '@rent-ghar/db/schemas/cement-rate.schema';
import { SteelRate } from '@rent-ghar/db/schemas/steel-rate.schema';
import { BricksRate } from '@rent-ghar/db/schemas/bricks-rate.schema';
import { SandRate } from '@rent-ghar/db/schemas/sand-rate.schema';
import { BajriRate } from '@rent-ghar/db/schemas/bajri-rate.schema';
import { WoodRate } from '@rent-ghar/db/schemas/wood-rate.schema';
import { DoorRate } from '@rent-ghar/db/schemas/door-rate.schema';
import { TileRate } from '@rent-ghar/db/schemas/tile-rate.schema';
import {
  CementOrder,
  CementOrderDocument,
  ORDER_STATUSES,
  type OrderStatus,
} from '@rent-ghar/db/schemas/cement-order.schema';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { MaterialType } from '@rent-ghar/db/schemas/material-type.schema';
import { MaterialRate } from '@rent-ghar/db/schemas/material-rate.schema';

/*
 * The construction-materials shop.
 *
 * Each material has always lived in its own collection (cement-rate,
 * steel-rate, …) with its own admin screens, and only cement could be put in
 * a cart — through a checkout that never sent the cart to the server. This
 * service treats them as one catalogue: one product list, one cart, one order
 * flow, priced here from the live rate (the browser only says what and how
 * many), with order numbers, a status workflow the office can move along,
 * and a public "track my order" lookup.
 */

export const PRODUCT_TYPES = ['cement', 'steel', 'bricks', 'sand', 'bajri', 'wood', 'door', 'tile'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

const TYPE_META: Record<ProductType, { label: string; path: string; tag: string }> = {
  cement: { label: 'Cement', path: 'today-cement-rate-in-pakistan', tag: 'cement-rates' },
  steel: { label: 'Steel', path: 'today-steel-rate-in-pakistan', tag: 'steel-rates' },
  bricks: { label: 'Bricks', path: 'today-bricks-rate-in-pakistan', tag: 'bricks-rates' },
  sand: { label: 'Sand', path: 'today-sand-rate-in-pakistan', tag: 'sand-rates' },
  bajri: { label: 'Bajri', path: 'today-bajri-rate-in-pakistan', tag: 'bajri-rates' },
  wood: { label: 'Wood', path: 'today-wood-rate-in-pakistan', tag: 'wood-rates' },
  door: { label: 'Doors', path: 'today-door-rate-in-pakistan', tag: 'door-rates' },
  tile: { label: 'Tiles', path: 'today-tile-rate-in-pakistan', tag: 'tile-rates' },
};

/** A material added from the dashboard: its slug is its product type. */
type AnyType = ProductType | string;
interface CustomType {
  slug: string;
  name: string;
  image?: string;
}

export interface ShopProduct {
  type: AnyType;
  typeLabel: string;
  id: string;
  brand: string;
  title: string;
  slug: string;
  price: number;
  change: number;
  unit: string;
  city: string;
  category: string;
  image: string;
  isActive: boolean;
  updatedAt?: Date;
  href: string;
}

export interface PlaceOrderInput {
  customerName?: unknown;
  customerPhone?: unknown;
  customerEmail?: unknown;
  customerCity?: unknown;
  address?: unknown;
  deliveryInstruction?: unknown;
  paymentMethod?: unknown;
  items?: unknown;
}

const NEXT_STATUSES: Record<string, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PROCESSING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: ['PENDING'],
};

const str = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, max);

/** Pakistani mobile, normalised to 03XXXXXXXXX; anything else stays as typed. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (/^923\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^3\d{9}$/.test(digits)) return `0${digits}`;
  return raw.trim();
}

@Injectable()
export class ShopService {
  private readonly models: Record<ProductType, Model<any>>;

  constructor(
    @InjectModel(CementRate.name) cement: Model<any>,
    @InjectModel(SteelRate.name) steel: Model<any>,
    @InjectModel(BricksRate.name) bricks: Model<any>,
    @InjectModel(SandRate.name) sand: Model<any>,
    @InjectModel(BajriRate.name) bajri: Model<any>,
    @InjectModel(WoodRate.name) wood: Model<any>,
    @InjectModel(DoorRate.name) door: Model<any>,
    @InjectModel(TileRate.name) tile: Model<any>,
    @InjectModel(CementOrder.name) private readonly orders: Model<CementOrderDocument>,
    private readonly discord: DiscordService,
    private readonly revalidate: RevalidateService,
    private readonly settings: SiteSettingsService,
    @InjectModel(MaterialType.name) private readonly materialTypes: Model<any>,
    @InjectModel(MaterialRate.name) private readonly materialRates: Model<any>,
  ) {
    this.models = { cement, steel, bricks, sand, bajri, wood, door, tile };
  }

  // ── Catalogue ─────────────────────────────────────────────────────────

  private customCache: { at: number; list: CustomType[] } | null = null;

  /** Active materials added from the dashboard (cached for a minute). */
  private async customTypes(): Promise<CustomType[]> {
    if (this.customCache && Date.now() - this.customCache.at < 60_000) return this.customCache.list;
    const rows = await this.materialTypes.find({ isActive: true }).select('slug name image').sort({ order: 1, name: 1 }).lean().exec();
    const list = rows.map((r: any) => ({ slug: String(r.slug), name: String(r.name), image: r.image ? String(r.image) : '' }));
    this.customCache = { at: Date.now(), list };
    return list;
  }

  private metaOf(type: AnyType, custom?: CustomType): { label: string; path: string; tag: string } {
    if ((PRODUCT_TYPES as readonly string[]).includes(type)) return TYPE_META[type as ProductType];
    return { label: custom?.name ?? String(type), path: `today-${type}-rate-in-pakistan`, tag: 'material-rates' };
  }

  private toProduct(type: AnyType, doc: any, custom?: CustomType): ShopProduct {
    const meta = this.metaOf(type, custom);
    const unit = type === 'cement' ? `${doc.weightKg ?? 50} kg bag` : doc.unit || 'Per unit';
    return {
      type,
      typeLabel: meta.label,
      id: String(doc._id),
      brand: doc.brand ?? '',
      title: doc.title || `${doc.brand ?? ''} — ${unit}`,
      slug: doc.slug ?? '',
      price: Number(doc.price) || 0,
      change: Number(doc.change) || 0,
      unit,
      city: doc.city ?? '',
      category: doc.category ?? '',
      image: doc.image || doc.images?.[0] || '',
      isActive: doc.isActive !== false,
      updatedAt: doc.updatedAt,
      href: `/${meta.path}${doc.slug ? `/${doc.slug}` : ''}`,
    };
  }

  /** Every product across every material. Public callers only see active ones. */
  async listProducts(opts: { type?: string; includeInactive?: boolean; search?: string } = {}): Promise<ShopProduct[]> {
    const types = PRODUCT_TYPES.filter((t) => !opts.type || t === opts.type);
    const search = opts.search ? new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const customs = (await this.customTypes()).filter((c) => !opts.type || c.slug === opts.type);
    const lists = await Promise.all(
      types.map(async (type) => {
        const query: Record<string, unknown> = opts.includeInactive ? {} : { isActive: { $ne: false } };
        if (search) query.$or = [{ brand: search }, { title: search }, { city: search }, { category: search }];
        const docs = await this.models[type]
          .find(query)
          .select('brand title slug price change unit city category image images isActive updatedAt weightKg')
          .sort({ brand: 1 })
          .lean()
          .exec();
        return docs.map((d) => this.toProduct(type, d));
      }),
    );
    const customLists = await Promise.all(
      customs.map(async (c) => {
        const query: Record<string, unknown> = { materialType: c.slug, ...(opts.includeInactive ? {} : { isActive: { $ne: false } }) };
        if (search) query.$or = [{ brand: search }, { title: search }, { city: search }, { category: search }];
        const docs = await this.materialRates
          .find(query)
          .select('brand title slug price change unit city category image images isActive updatedAt')
          .sort({ brand: 1 })
          .lean()
          .exec();
        return docs.map((d) => this.toProduct(c.slug, d, c));
      }),
    );
    return [...lists.flat(), ...customLists.flat()];
  }

  /** Quick edit from the admin rates board: today's price, the change, on/off. */
  /**
   * One line per material that has products on sale — for the homepage's
   * construction rates: the lowest price in its usual unit, how many
   * products, and how many moved up or down today. Built-in materials first,
   * then the ones added from the dashboard, in menu order.
   */
  async summary() {
    const [products, customs] = await Promise.all([this.listProducts(), this.customTypes()]);
    const order: AnyType[] = [...PRODUCT_TYPES, ...customs.map((c) => c.slug)];
    const byType = new Map<AnyType, ShopProduct[]>();
    for (const p of products) {
      if (p.price <= 0) continue;
      byType.set(p.type, [...(byType.get(p.type) ?? []), p]);
    }
    return order
      .filter((t) => byType.has(t))
      .map((type) => {
        const list = byType.get(type)!;
        const custom = customs.find((c) => c.slug === type);
        const meta = this.metaOf(type, custom);
        // The unit most of its products are priced in, and the lowest price in it.
        const units = new Map<string, number>();
        for (const p of list) units.set(p.unit, (units.get(p.unit) ?? 0) + 1);
        const unit = [...units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? list[0]!.unit;
        const inUnit = list.filter((p) => p.unit === unit).map((p) => p.price);
        const updated = list.reduce<Date | undefined>((m, p) => (p.updatedAt && (!m || p.updatedAt > m) ? p.updatedAt : m), undefined);
        return {
          type,
          label: meta.label,
          path: `/${meta.path}`,
          custom: !!custom,
          products: list.length,
          unit,
          from: Math.min(...inUnit),
          to: Math.max(...inUnit),
          up: list.filter((p) => p.change > 0).length,
          down: list.filter((p) => p.change < 0).length,
          // The admin's photo for the material (Dashboard → Materials), else a product's.
          materialImage: custom?.image ?? '',
          image: list.find((p) => p.image)?.image ?? '',
          updatedAt: updated,
        };
      });
  }

  async updateProduct(type: string, id: string, input: { price?: unknown; change?: unknown; isActive?: unknown }) {
    const builtIn = PRODUCT_TYPES.includes(type as ProductType);
    const custom = builtIn ? undefined : (await this.customTypes()).find((c) => c.slug === type);
    if (!builtIn && !custom) throw new BadRequestException('Unknown product type');
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid product id');
    const set: Record<string, unknown> = {};
    if (input.price !== undefined) {
      const price = Math.round(Number(input.price));
      if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Price must be a positive number');
      set.price = price;
    }
    if (input.change !== undefined) {
      const change = Math.round(Number(input.change));
      if (!Number.isFinite(change)) throw new BadRequestException('Change must be a number');
      set.change = change;
    }
    if (input.isActive !== undefined) set.isActive = input.isActive === true || input.isActive === 'true';
    if (Object.keys(set).length === 0) throw new BadRequestException('Nothing to update');

    const doc = builtIn
      ? await this.models[type as ProductType].findByIdAndUpdate(id, { $set: set }, { new: true }).lean().exec()
      : await this.materialRates.findOneAndUpdate({ _id: id, materialType: type }, { $set: set }, { new: true }).lean().exec();
    if (!doc) throw new NotFoundException('Product not found');

    const meta = this.metaOf(type, custom);
    const paths = [`/${meta.path}`];
    if ((doc as any).slug) paths.push(`/${meta.path}/${(doc as any).slug}`);
    await this.revalidate.revalidate({ tags: [meta.tag, 'material-rates', ...(builtIn ? [] : ['material-types'])], paths });
    if (!builtIn) this.customCache = null;
    return this.toProduct(type, doc, custom);
  }

  // ── Orders ────────────────────────────────────────────────────────────

  private async newOrderNumber(): Promise<string> {
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 6; i++) {
      const candidate = `PD-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await this.orders.exists({ orderNumber: candidate }))) return candidate;
    }
    return `PD-${stamp}-${Date.now().toString().slice(-6)}`;
  }

  /** What delivery costs for a basket of this size, by the shop settings. */
  async quote(subTotal: number) {
    const s = await this.settings.get();
    const free = s.shopFreeDeliveryOver > 0 && subTotal >= s.shopFreeDeliveryOver;
    return {
      enabled: s.shopEnabled,
      minOrder: s.shopMinOrder,
      deliveryCharges: free ? 0 : s.shopDeliveryFee,
      codEnabled: s.shopCodEnabled,
    };
  }

  async placeOrder(input: PlaceOrderInput, userId?: string) {
    const customerName = str(input.customerName, 80);
    const customerPhone = normalisePhone(str(input.customerPhone, 20));
    const address = str(input.address, 300);
    const customerCity = str(input.customerCity, 60);
    const customerEmail = str(input.customerEmail, 120);
    const deliveryInstruction = str(input.deliveryInstruction, 500);

    if (customerName.length < 2) throw new BadRequestException('Please enter your name');
    if (!/^0?3\d{9}$/.test(customerPhone.replace(/\D/g, '')) && customerPhone.replace(/\D/g, '').length < 10) {
      throw new BadRequestException('Please enter a valid phone number');
    }
    if (address.length < 6) throw new BadRequestException('Please enter the delivery address');
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new BadRequestException('That email address does not look right');
    }

    const rawItems = Array.isArray(input.items) ? input.items.slice(0, 50) : [];
    if (rawItems.length === 0) throw new BadRequestException('Your cart is empty');

    // Price every line from the database — the browser only says what and how many.
    const items: CementOrder['items'] = [];
    for (const raw of rawItems as Array<Record<string, unknown>>) {
      const type = String(raw?.type ?? 'cement');
      const id = String(raw?.id ?? raw?.productId ?? '');
      const quantity = Math.min(100_000, Math.max(1, Math.round(Number(raw?.quantity) || 0)));
      if (!Types.ObjectId.isValid(id)) continue;
      const builtIn = PRODUCT_TYPES.includes(type as ProductType);
      const custom = builtIn ? undefined : (await this.customTypes()).find((c) => c.slug === type);
      if (!builtIn && !custom) continue;
      const doc = builtIn
        ? await this.models[type as ProductType].findById(id).lean().exec()
        : await this.materialRates.findOne({ _id: id, materialType: type }).lean().exec();
      if (!doc || (doc as any).isActive === false) continue;
      const p = this.toProduct(type, doc, custom);
      items.push({
        type,
        productId: p.id,
        brand: p.brand,
        title: p.title,
        unit: p.unit,
        city: p.city,
        weightKg: type === 'cement' ? Number((doc as any).weightKg) || 50 : undefined,
        price: p.price,
        quantity,
        image: p.image,
        href: p.href,
      });
    }
    if (items.length === 0) {
      throw new BadRequestException('The items in your cart are no longer available. Please add them again.');
    }

    const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const q = await this.quote(subTotal);
    if (!q.enabled) throw new BadRequestException('Online ordering is paused right now. Please call us to order.');
    if (q.minOrder > 0 && subTotal < q.minOrder) {
      throw new BadRequestException(`The minimum order is Rs ${q.minOrder.toLocaleString('en-PK')}`);
    }

    const paymentMethod = input.paymentMethod === 'bank' ? 'bank' : q.codEnabled ? 'cod' : 'bank';
    const orderNumber = await this.newOrderNumber();

    const saved = await new this.orders({
      orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      userId: userId ?? '',
      address,
      deliveryInstruction,
      items,
      subTotal,
      deliveryCharges: q.deliveryCharges,
      total: subTotal + q.deliveryCharges,
      paymentMethod,
      paymentStatus: 'unpaid',
      status: 'PENDING',
      statusHistory: [{ status: 'PENDING', at: new Date(), by: 'customer' }],
    }).save();

    /*
     * An order is the one thing on this site that someone is waiting on, so
     * the alert carries the phone number and the address: the office can
     * ring back straight from the notification. Fire-and-forget — a webhook
     * that is down must never cost a customer their order.
     */
    const lines = items.map((i) => `${i.quantity} × ${i.title}`).join('\n').slice(0, 900);
    this.discord.send({
      title: `🧱 New order ${orderNumber}`,
      description: `${customerName} — ${DiscordService.money(saved.total)}`,
      url: '/dashboard/cement-order',
      color: DISCORD_COLORS.order,
      category: 'Orders',
      ...(userId ? { who: [{ label: '👤 Signed-in customer', id: userId }] } : {}),
      links: [
        { label: 'Orders', url: '/dashboard/cement-order' },
        ...(customerPhone ? [{ label: 'WhatsApp the customer', url: `https://wa.me/${String(customerPhone).replace(/\D/g, '').replace(/^0/, '92')}` }] : []),
      ],
      fields: [
        { name: 'Phone', value: customerPhone || '—' },
        { name: 'City', value: customerCity || items[0]?.city || '—' },
        { name: 'Payment', value: paymentMethod.toUpperCase() },
        { name: 'Items', value: lines || '—', inline: false },
        { name: 'Deliver to', value: address || '—', inline: false },
        {
          name: 'Total',
          value: `${DiscordService.money(subTotal)} + ${DiscordService.money(q.deliveryCharges)} delivery = ${DiscordService.money(saved.total)}`,
          inline: false,
        },
      ],
    });

    return this.publicOrder(saved.toObject());
  }

  /** What a customer may see about their order. */
  private publicOrder(o: any) {
    return {
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customerName,
      customerCity: o.customerCity,
      address: o.address,
      items: (o.items ?? []).map((i: any) => ({
        title: i.title || i.brand,
        unit: i.unit,
        quantity: i.quantity,
        price: i.price,
        image: i.image,
        href: i.href,
      })),
      subTotal: o.subTotal,
      deliveryCharges: o.deliveryCharges,
      total: o.total,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      statusHistory: (o.statusHistory ?? []).map((h: any) => ({ status: h.status, at: h.at })),
    };
  }

  /** Public tracking: the order number and the phone it was placed with must both match. */
  async track(orderNumber: string, phone: string) {
    const number = str(orderNumber, 30).toUpperCase();
    const digits = String(phone ?? '').replace(/\D/g, '').slice(-10);
    if (!number || digits.length < 10) throw new BadRequestException('Enter your order number and phone number');
    const order = await this.orders.findOne({ orderNumber: number }).lean().exec();
    if (!order || String(order.customerPhone ?? '').replace(/\D/g, '').slice(-10) !== digits) {
      throw new NotFoundException('No order matches that number and phone');
    }
    return this.publicOrder(order);
  }

  async adminList(q: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(q.limit) || 25));
    const filter: Record<string, unknown> = {};
    if (q.status && q.status !== 'all') filter.status = q.status;
    if (q.search) {
      const rx = new RegExp(q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ orderNumber: rx }, { customerName: rx }, { customerPhone: rx }, { address: rx }, { customerCity: rx }];
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [rows, total, byStatus, today, revenue] = await Promise.all([
      this.orders.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.orders.countDocuments(filter).exec(),
      this.orders.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      this.orders.countDocuments({ createdAt: { $gte: startOfDay } }).exec(),
      this.orders
        .aggregate([
          { $match: { status: { $in: ['DELIVERED', 'COMPLETED'] } } },
          { $group: { _id: null, sum: { $sum: '$total' } } },
        ])
        .exec(),
    ]);

    const counts: Record<string, number> = {};
    for (const s of byStatus) counts[s._id ?? 'PENDING'] = s.count;

    return {
      orders: rows,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        counts,
        today,
        open: (counts.PENDING ?? 0) + (counts.CONFIRMED ?? 0) + (counts.PROCESSING ?? 0) + (counts.OUT_FOR_DELIVERY ?? 0),
        revenue: revenue[0]?.sum ?? 0,
      },
    };
  }

  async adminGet(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid order id');
    const order = await this.orders.findById(id).lean().exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async adminUpdate(
    id: string,
    input: { status?: unknown; adminNote?: unknown; paymentStatus?: unknown; note?: unknown },
    adminId?: string,
  ) {
    const order = await this.orders.findById(id).exec();
    if (!order) throw new NotFoundException('Order not found');

    if (input.status !== undefined) {
      const next = String(input.status) as OrderStatus;
      if (!ORDER_STATUSES.includes(next)) throw new BadRequestException('Unknown status');
      if (next !== order.status) {
        const allowed = NEXT_STATUSES[order.status] ?? [];
        if (!allowed.includes(next)) {
          throw new BadRequestException(`An order that is ${order.status.toLowerCase().replace(/_/g, ' ')} cannot move to ${next.toLowerCase().replace(/_/g, ' ')}`);
        }
        order.status = next;
        order.statusHistory = [
          ...(order.statusHistory ?? []),
          { status: next, at: new Date(), by: adminId ?? 'admin', note: str(input.note, 300) || undefined },
        ];
        if (next === 'DELIVERED' && order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
          order.paymentStatus = 'paid';
        }
      }
    }
    if (input.adminNote !== undefined) order.adminNote = str(input.adminNote, 1000);
    if (input.paymentStatus !== undefined) {
      const p = String(input.paymentStatus);
      if (!['unpaid', 'paid', 'refunded'].includes(p)) throw new BadRequestException('Unknown payment status');
      order.paymentStatus = p;
    }
    await order.save();
    return order.toObject();
  }

  static nextStatuses(status: string): OrderStatus[] {
    return NEXT_STATUSES[status] ?? [];
  }
}
