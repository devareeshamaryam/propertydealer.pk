import api from '@/lib/api';

/*
 * The construction-materials shop, client side.
 *
 * One product shape for every material (the API's /shop endpoints produce it
 * from the eight rate collections), one cart, one checkout. The browser never
 * decides a price: the cart remembers what was added so it can show it, and
 * the server re-prices every line when the order is placed.
 */

export const PRODUCT_TYPES = ['cement', 'steel', 'bricks', 'sand', 'bajri', 'wood', 'door', 'tile'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const TYPE_META: Record<ProductType, { label: string; path: string; single: string }> = {
  cement: { label: 'Cement', single: 'Cement', path: '/today-cement-rate-in-pakistan' },
  steel: { label: 'Steel (Sarya)', single: 'Steel', path: '/today-steel-rate-in-pakistan' },
  bricks: { label: 'Bricks', single: 'Bricks', path: '/today-bricks-rate-in-pakistan' },
  sand: { label: 'Sand', single: 'Sand', path: '/today-sand-rate-in-pakistan' },
  bajri: { label: 'Bajri (Crush)', single: 'Bajri', path: '/today-bajri-rate-in-pakistan' },
  wood: { label: 'Wood', single: 'Wood', path: '/today-wood-rate-in-pakistan' },
  door: { label: 'Doors', single: 'Door', path: '/today-door-rate-in-pakistan' },
  tile: { label: 'Tiles', single: 'Tile', path: '/today-tile-rate-in-pakistan' },
};

/** "Steel", "Tile"… as the rate pages name their material, mapped to our type. */
export function typeFromMaterial(material: string): ProductType {
  const key = material.toLowerCase().replace(/s$/, '') as string;
  if (key === 'brick') return 'bricks';
  return (PRODUCT_TYPES as readonly string[]).includes(key) ? (key as ProductType) : 'cement';
}

export interface ShopProduct {
  type: ProductType;
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
  isActive?: boolean;
  updatedAt?: string;
  href: string;
}

/** A raw rate document (any of the eight collections) as a ShopProduct. */
export function toShopProduct(type: ProductType, r: any): ShopProduct {
  const unit = type === 'cement' ? `${r.weightKg ?? 50} kg bag` : r.unit || 'Per unit';
  return {
    type,
    id: String(r._id ?? r.id ?? r.slug),
    brand: r.brand ?? '',
    title: r.title || `${r.brand ?? ''} — ${unit}`,
    slug: r.slug ?? '',
    price: Number(r.price) || 0,
    change: Number(r.change) || 0,
    unit,
    city: r.city ?? '',
    category: r.category ?? '',
    image: r.image || r.images?.[0] || '',
    isActive: r.isActive !== false,
    updatedAt: r.updatedAt,
    href: `${TYPE_META[type].path}${r.slug ? `/${r.slug}` : ''}`,
  };
}

export function imageSrc(image?: string): string {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return image.startsWith('/') ? image : `/${image}`;
}

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;

export interface CartItem {
  key: string; // `${type}:${id}`
  type: ProductType;
  id: string;
  title: string;
  brand: string;
  unit: string;
  city: string;
  price: number;
  image: string;
  href: string;
  quantity: number;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Order received',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being prepared',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export interface PublicOrder {
  orderNumber: string;
  status: string;
  customerName: string;
  customerCity?: string;
  address: string;
  items: { title: string; unit?: string; quantity: number; price: number; image?: string; href?: string }[];
  subTotal: number;
  deliveryCharges: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  statusHistory: { status: string; at: string }[];
}

export interface AdminOrder {
  _id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerCity?: string;
  address: string;
  deliveryInstruction?: string;
  items: {
    type?: string; brand: string; title?: string; unit?: string; city?: string; weightKg?: number;
    price: number; quantity: number; image?: string; href?: string; productId: string;
  }[];
  subTotal: number;
  deliveryCharges: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus?: string;
  adminNote?: string;
  statusHistory?: { status: string; at: string; by?: string; note?: string }[];
  createdAt: string;
  nextStatuses?: string[];
}

export const shopApi = {
  quote: async (subTotal: number) =>
    (await api.get('/shop/quote', { params: { subTotal } })).data?.data as {
      enabled: boolean; minOrder: number; deliveryCharges: number; codEnabled: boolean;
    },
  placeOrder: async (body: Record<string, unknown>) => (await api.post('/shop/orders', body)).data?.data as PublicOrder,
  track: async (number: string, phone: string) =>
    (await api.get('/shop/track', { params: { number, phone } })).data?.data as PublicOrder,
  adminProducts: async (params: { type?: string; search?: string } = {}) =>
    ((await api.get('/shop/admin/products', { params })).data?.data ?? []) as ShopProduct[],
  updateProduct: async (type: string, id: string, body: { price?: number; change?: number; isActive?: boolean }) =>
    (await api.patch(`/shop/admin/products/${type}/${id}`, body)).data?.data as ShopProduct,
  adminOrders: async (params: { status?: string; search?: string; page?: number; limit?: number }) =>
    (await api.get('/shop/admin/orders', { params })).data?.data as {
      orders: AdminOrder[]; total: number; page: number; totalPages: number;
      stats: { counts: Record<string, number>; today: number; open: number; revenue: number };
    },
  adminOrder: async (id: string) => (await api.get(`/shop/admin/orders/${id}`)).data?.data as AdminOrder,
  updateOrder: async (id: string, body: { status?: string; adminNote?: string; paymentStatus?: string; note?: string }) =>
    (await api.patch(`/shop/admin/orders/${id}`, body)).data?.data as AdminOrder,
};
