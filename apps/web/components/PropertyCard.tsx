'use client'
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bath, BedDouble, Camera, MapPin, Phone, Play, Ruler } from 'lucide-react';
import { Property } from '@/lib/data';
import { cn, toTitleCase } from '@/lib/utils';
import { amountShort, propertySizeLabel } from '@/lib/pk';
import { useImpression } from '@/components/analytics/impression';
import { trackContact } from '@/lib/analytics';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved, waDigits } from '@/lib/site-settings';
import VerifiedBadge from '@/components/VerifiedBadge';

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
  // A photo whose file is missing on the server shows the "No photo" tile, not a broken image.
  const [broken, setBroken] = useState(false);
  const poster = broken ? '' : property.videoPosterUrl || realImage;
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

  const settings = useSiteSettings();
  const site = resolved(settings);
  const phone = property.contactNumber || site.phone;
  const rawWhatsApp = property.whatsappNumber || property.contactNumber || site.whatsapp;
  const whatsapp = rawWhatsApp ? waDigits(rawWhatsApp) : '';
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';
  const waText = encodeURIComponent(
    `Hi, I am interested in: ${property.name} (${typeof window !== 'undefined' ? window.location.origin : 'https://propertydealer.pk'}${href})`
  );
  const waUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : '';

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
            onError={() => setBroken(true)}
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
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-baseline gap-1 text-slate-900">
            <span className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">PKR</span>
            <span className="text-[17px] font-bold leading-none tracking-tight sm:text-[20px]">{price}</span>
            {isRent && <span className="text-[11px] text-slate-500 sm:text-[12px]">/month</span>}
          </p>
          {property.ownerVerified && <VerifiedBadge className="shrink-0 px-1.5 text-[10.5px] sm:px-2 sm:text-[11.5px]" />}
        </div>

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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {ago && <span className="hidden text-[10.5px] text-slate-400 sm:inline sm:text-[12px]">{ago}</span>}
            {!closed && (phone || whatsapp) && (
              <div className="relative z-20 flex items-center gap-1 sm:gap-1.5">
                {phone && (
                  <a
                    href={phoneHref}
                    onClick={(e) => {
                      e.stopPropagation();
                      trackContact(property.id, 'phone');
                    }}
                    className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-primary active:scale-95 sm:h-7 sm:w-auto sm:px-2 sm:gap-1 text-[11px] font-medium"
                    title={`Call: ${phone}`}
                    aria-label={`Call ${property.name}`}
                  >
                    <Phone className="h-3 w-3 text-slate-600 sm:text-slate-700" />
                    <span className="hidden sm:inline">Call</span>
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      trackContact(property.id, 'whatsapp');
                    }}
                    className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md bg-[#25D366] text-white shadow-xs transition-colors hover:bg-[#20ba59] active:scale-95 sm:h-7 sm:w-auto sm:px-2 sm:gap-1 text-[11px] font-medium"
                    title={`WhatsApp: ${whatsapp}`}
                    aria-label={`WhatsApp about ${property.name}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.42z" />
                    </svg>
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default PropertyCard;
