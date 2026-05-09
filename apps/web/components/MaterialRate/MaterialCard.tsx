 export interface MaterialRate {
  id: string | number;
  brand: string;
  slug: string;
  price: number;
  change?: number;
  city?: string;
  unit?: string;
  materialType: string;
  category?: string;
  image?: string;
  images?: string[];
  description?: string;
}

interface MaterialCardProps {
  rate: MaterialRate;
  viewMode?: 'grid' | 'list';
  materialType?: string;
}

function materialSlug(type: string): string {
  return `today-${type.toLowerCase()}-rate-in-pakistan`;
}

export default function MaterialCard({ rate, viewMode = 'grid', materialType }: MaterialCardProps) {
  const type = materialType || rate.materialType;
  // Use id as fallback if slug is missing
  const identifier = rate.slug || rate.id;
  const detailHref = `/${materialSlug(type)}/${identifier}`;

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex gap-4 items-center">
        {rate.image && (
          <img
            src={rate.image}
            alt={rate.brand}
            className="w-24 h-24 object-contain rounded-md shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 uppercase mb-0.5">{rate.category || rate.materialType}</p>
          <a href={detailHref} className="font-semibold text-primary text-sm leading-snug mb-1 hover:underline block">{rate.brand}</a>
          {rate.city && <p className="text-xs text-gray-500 mb-2">City: {rate.city}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-bold text-gray-900">
              Rs {rate.price.toLocaleString()}
            </span>
            <a
              href="tel:+923052736792"
              className="shrink-0 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            >
              Buy Now
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
          {rate.category || rate.materialType}
        </p>
        <a
          href={detailHref}
          className="text-sm font-semibold text-primary hover:underline leading-snug line-clamp-2"
        >
          {rate.brand}
        </a>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-3 min-h-[160px]">
        {rate.image ? (
          <img
            src={rate.image}
            alt={rate.brand}
            className="max-h-40 w-full object-contain"
          />
        ) : (
          <div className="text-gray-300 text-sm">No Image</div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className="text-base font-bold text-gray-900">
          Rs {rate.price.toLocaleString()}
        </span>
        <a
          href="tel:+923052736792"
          className="shrink-0 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
        >
          Buy Now
        </a>
      </div>
    </div>
  );
}