'use client'
import Link from 'next/link';
import Image from 'next/image';
import { Bath, BedDouble, Camera, MapPin, Play, Ruler } from 'lucide-react';
import { Property } from '@/lib/data';
import { cn, toTitleCase } from '@/lib/utils';
import { amountShort, propertySizeLabel } from '@/lib/pk';
import { useImpression } from '@/components/analytics/impression';

/*
 * The one listing card, used everywhere a listing is shown — search results,
 * the homepage, related listings, an agent's profile.
 *
 * It is the results-page row: photo on the left, the facts on the right, the
 * shape property and classifieds apps use because a phone screen fits five or
 * six of them at once. The whole card is one real <Link> (crawlable,
 * middle-click works). Contact buttons are not on the card — calling or
 * messaging happens on the listing, where the number is revealed on a tap and
 * the enquiry is counted; on a list they crowded the row and invited calls
 * about a house nobody had looked at yet.
 *
 * `variant` is accepted for older call sites and ignored.
 */

interface PropertyCardProps {
  property: Property;
  /** @deprecated The card has no actions any more. */
  hideActions?: boolean;
  /** @deprecated There is one card. */
  variant?: 'list' | 'grid';
  className?: string;
}

function postedAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const hours = Math.floor((Date.now() - then) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const PropertyCard = ({ property, className }: PropertyCardProps) => {
  const ref = useImpression<HTMLElement>(property.id);
  const href = `/properties/${property.slug}`;

  const hasVideo = Boolean(property.videoUrl || property.videoPosterUrl);
  const realImage =
    property.image && !property.image.includes('images.unsplash.com') ? property.image : '';
  const poster = property.videoPosterUrl || realImage;
  const isVideoPrimary = Boolean(property.isVideoThumbnail || (hasVideo && !realImage));
  const rawVideoUrl = property.videoUrl || '';

  /*
   * Sold or rented: the card stays for fifteen days (the API drops it from the
   * lists after that), but it must not look like something you can still buy.
   */
  const closed = property.availability === 'sold' || property.availability === 'rented';
  const closedLabel = property.availability === 'rented' ? 'Rented' : 'Sold';

  const price = amountShort(property.price) || property.price.toLocaleString('en-PK');
  const isRent = property.purpose === 'rent';
  const place = [property.location, property.city]
    .filter(Boolean)
    .map((part) => toTitleCase(String(part)))
    .filter((part, i, all) => all.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === i)
    .join(', ');
  const size = propertySizeLabel({ marla: property.marla, kanal: property.kanal, areaSize: Number(property.area) });
  const photos = property.photoCount ?? 0;
  const ago = postedAgo(property.postedAt);

  return (
    <article
      ref={ref}
      className={cn(
        'group relative flex gap-3 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:border-slate-300 sm:gap-4 sm:p-2.5',
        closed && 'opacity-80',
        className,
      )}
    >
      <Link href={href} className="absolute inset-0 z-10 rounded-lg" aria-label={property.name} />

      {/* ── Photo ── */}
      <div className="relative h-[100px] w-[112px] shrink-0 overflow-hidden rounded-md bg-slate-100 sm:h-[150px] sm:w-[210px]">
        {poster ? (
          <Image
            src={poster}
            alt={property.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 112px, 210px"
          />
        ) : isVideoPrimary && rawVideoUrl ? (
          <video
            src={`${rawVideoUrl}#t=0.5`}
            preload="metadata"
            muted
            playsInline
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[11px] text-slate-400">No photo</div>
        )}

        {isVideoPrimary && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white">
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            </span>
          </span>
        )}

        {(closed || property.isFeatured) && (
          <span
            className={cn(
              'pointer-events-none absolute left-1.5 top-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:text-[10px]',
              closed ? 'bg-slate-900 text-white' : 'bg-amber-400 text-slate-900',
            )}
          >
            {closed ? closedLabel : 'Featured'}
          </span>
        )}

        {(photos > 1 || (hasVideo && !isVideoPrimary)) && (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {photos > 1 ? (
              <>
                <Camera className="h-3 w-3" />
                {photos}
              </>
            ) : (
              <>
                <Play className="h-2.5 w-2.5 fill-current" />
                Video
              </>
            )}
          </span>
        )}
      </div>

      {/* ── Details ── */}
      <div className="flex min-w-0 flex-1 flex-col py-0.5 sm:py-1">
        <p className="flex items-baseline gap-1 text-slate-900">
          <span className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">PKR</span>
          <span className="text-[17px] font-bold leading-none tracking-tight sm:text-[20px]">{price}</span>
          {isRent && <span className="text-[11px] text-slate-500 sm:text-[12px]">/month</span>}
        </p>

        <h3 className="mt-1 line-clamp-2 text-[14px] font-medium leading-snug text-slate-900 group-hover:text-primary sm:mt-1.5 sm:text-[16px]">
          {property.name}
        </h3>

        {place && (
          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-slate-500 sm:mt-1 sm:text-[13px]">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400 sm:h-3.5 sm:w-3.5" />
            <span className="truncate">{place}</span>
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <ul className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-slate-600 sm:gap-x-3.5 sm:text-[13px]">
            {property.bedrooms > 0 && (
              <li className="inline-flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-slate-400" />
                {property.bedrooms}
                <span className="hidden sm:inline">{property.bedrooms === 1 ? 'Bed' : 'Beds'}</span>
              </li>
            )}
            {property.bathrooms > 0 && (
              <li className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5 text-slate-400" />
                {property.bathrooms}
                <span className="hidden sm:inline">{property.bathrooms === 1 ? 'Bath' : 'Baths'}</span>
              </li>
            )}
            {size && size !== '—' && (
              <li className="inline-flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5 text-slate-400" />
                {size}
              </li>
            )}
          </ul>
          {ago && <span className="shrink-0 text-[10.5px] text-slate-400 sm:text-[12px]">{ago}</span>}
        </div>
      </div>
    </article>
  );
};

export default PropertyCard;
