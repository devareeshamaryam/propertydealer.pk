/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useCallback, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, MapPin, BedDouble, Bath, Ruler, Phone, Check, Loader2, ChevronRight, ImageOff, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { propertyApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { toast } from 'sonner';
import { cn, toTitleCase } from '@/lib/utils';
import { amountShort, amountWithSeparators, propertySizeLabel } from '@/lib/pk';
import { agentDisplayName, agentProfilePath } from '@/lib/agent';
import { trackContact, trackView } from '@/lib/analytics';
import { maskPhone } from '@/lib/auth-intent';
import dynamic from 'next/dynamic';
import PropertyGallery from '@/components/property/PropertyGallery';
import PropertyCard from '@/components/PropertyCard';
import { ReportButton } from '@/components/property/ReportButton';

const PropertyMap = dynamic(() => import('@/components/PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full animate-pulse items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

/*
 * The listing page, laid out the way property portals do it.
 *
 * Gallery first, then the facts a buyer scans for — price, place, size, rooms —
 * then a plain two-column details table, the description, features and the
 * map. The contact card sits to the right on desktop and stays in view; on a
 * phone the same two buttons come straight after the price and follow the
 * reader down in a bar once they scroll past.
 *
 * What went: a black translucent section bar, every block wrapped in its own
 * card with a 20px heading, an icon tile in front of every fact, the details
 * repeated a second time in a sidebar card (with the database id as
 * "Property ID"), stock Unsplash photos shown as if they were the property
 * when a listing had none, and a "Contact agent" form whose submit button did
 * nothing but alert().
 */

const SECTIONS = [
  { id: 'overview-section', label: 'Overview' },
  { id: 'description-section', label: 'Description' },
  { id: 'features-section', label: 'Features' },
  { id: 'location-section', label: 'Location' },
];

/** A YouTube id from any of the link shapes people paste, or null. */
function youTubeId(url?: string | null): string | null {
  if (!url || !/youtu\.?be/.test(url)) return null;
  const match = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/.exec(url);
  return match?.[1] ?? null;
}

const PropertyDetail = ({ slug, initialProperty }: { slug?: string; initialProperty?: BackendProperty | null }) => {
  const router = useRouter();
  const params = useParams();
  const resolvedSlug = (slug || (params?.slug as string) || (params?.id as string))?.trim();

  const [property, setProperty] = useState<Property | null>(
    initialProperty ? mapBackendToFrontendProperty(initialProperty) : null
  );
  const [backendProperty, setBackendProperty] = useState<BackendProperty | null>(initialProperty || null);
  const [loading, setLoading] = useState(!initialProperty);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview-section');
  const [relatedByArea, setRelatedByArea] = useState<Property[]>([]);
  const [relatedByCity, setRelatedByCity] = useState<Property[]>([]);
  const [relatedByOwner, setRelatedByOwner] = useState<Property[]>([]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showStickyContact, setShowStickyContact] = useState(false);
  const contactButtonsRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  /*
   * Contact: three hooks, declared up here on purpose.
   *
   * They used to sit further down, below the `if (loading)` and
   * `if (error || !property)` early returns — so a first render that bailed
   * out ran fewer hooks than the render after the fetch resolved, which is
   * exactly the "Rendered more hooks than during the previous render" crash.
   * Pages that pass `initialProperty` never hit it; /listing-detail/[id],
   * which fetches on the client, did.
   */
  const [numberShown, setNumberShown] = useState(false);

  const waLink = useCallback(() => {
    const message = encodeURIComponent(`I want to know more about this property: ${property?.name ?? ''}\nLink: ${window.location.href}`);
    const raw = property?.whatsappNumber || property?.contactNumber || '923123456789';
    const clean = raw.replace(/\D/g, '');
    const num = clean.startsWith('92') ? clean : '92' + clean.replace(/^0/, '');
    return `https://wa.me/${num}?text=${message}`;
  }, [property?.name, property?.whatsappNumber, property?.contactNumber]);

  /*
   * One tap for the number, no account.
   *
   * Tapping Call used to send a buyer to a login form and bring them back to
   * resume the call. That wall cost the agent enquiries without protecting
   * anything: the number travels inside the page's own data either way, so
   * the only people it stopped were real buyers. Keeping it out of the
   * rendered markup until somebody asks is the part that actually helps — a
   * scraper reading the HTML finds a bullet mask — and the tap is a far
   * better enquiry signal than a page view.
   */
  const revealOrDial = useCallback(() => {
    if (!numberShown) {
      setNumberShown(true);
      // Counted on the reveal, not the dial: on a desktop there is no dial.
      trackContact(backendProperty?._id, 'phone');
      return;
    }
    window.location.href = `tel:${property?.contactNumber ?? ''}`;
  }, [numberShown, backendProperty?._id, property?.contactNumber]);

  /*
   * Sold and rented listings keep their page but lose their phone number.
   *
   * The URL stays alive on purpose — these pages are ranked, and a 404 would
   * throw that away — so the page has to say plainly that the house has gone
   * rather than leave a Call button that wastes everyone's time. The listing
   * also drops out of search fifteen days after it was marked (the API does
   * that part); until then it stays, badged.
   */
  const closed =
    property?.availability === 'sold' || property?.availability === 'rented';
  const closedLabel = property?.availability === 'rented' ? 'Rented out' : 'Sold out';

  const openWhatsApp = useCallback(() => {
    trackContact(backendProperty?._id, 'whatsapp');
    window.open(waLink(), '_blank');
  }, [backendProperty?._id, waLink]);

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours} hours ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 30) return `${diffInDays} days ago`;
      const diffInMonths = Math.floor(diffInDays / 30);
      if (diffInMonths === 1) return '1 month ago';
      return `${diffInMonths} months ago`;
    } catch {
      return 'Recently';
    }
  };

  // Resolve lat/lng from backendProperty directly (most reliable source)
  const resolvedLat: number | undefined =
    backendProperty?.latitude ?? (property?.latitude as number | undefined);
  const resolvedLng: number | undefined =
    backendProperty?.longitude ?? (property?.longitude as number | undefined);
  const hasCoords = !!(resolvedLat && resolvedLng);

  useEffect(() => { setIsMounted(true); }, []);

  // Only offer "Read more" when there is more to read.
  useEffect(() => {
    const el = descriptionRef.current;
    if (el) setDescriptionOverflows(el.scrollHeight > 220);
  }, [property?.description]);

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-section="${activeSection}"]`) as HTMLElement;
      if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSection]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); }),
      { rootMargin: '-120px 0px -50% 0px' }
    );

    const timeout = setTimeout(() => {
      SECTIONS.forEach(({ id }) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    }, 100);

    const contactObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setShowStickyContact(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    if (contactButtonsRef.current) contactObserver.observe(contactButtonsRef.current);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      contactObserver.disconnect();
    };
  }, [property]);

  useEffect(() => {
    const fetchRelatedProperties = async () => {
      if (!property) return;
      try {
        const areaData = await propertyApi.getAll({
          cityName: property.city, search: property.location,
          type: backendProperty?.propertyType, purpose: backendProperty?.listingType, limit: 12,
        });
        const areaProperties = Array.isArray(areaData) ? areaData : areaData.properties;
        setRelatedByArea(areaProperties.map(p => mapBackendToFrontendProperty(p)).filter(p => p.slug !== resolvedSlug));

        const cityData = await propertyApi.getAll({
          cityName: property.city, type: backendProperty?.propertyType,
          purpose: backendProperty?.listingType, limit: 15,
        });
        const cityProperties = Array.isArray(cityData) ? cityData : cityData.properties;
        setRelatedByCity(
          cityProperties.map(p => mapBackendToFrontendProperty(p))
            .filter(p => p.slug !== resolvedSlug && !areaProperties.some((ap: any) => ap.slug === p.slug))
        );

        if (backendProperty?.owner?._id) {
          const ownerData = await propertyApi.getAll({ ownerId: backendProperty.owner._id, limit: 12 } as any);
          const ownerProperties = Array.isArray(ownerData) ? ownerData : ownerData.properties;
          setRelatedByOwner(ownerProperties.map(p => mapBackendToFrontendProperty(p)).filter(p => p.slug !== resolvedSlug));
        }
      } catch (err) {
        console.error('Error fetching related properties:', err);
      }
    };
    fetchRelatedProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, resolvedSlug]);

  /*
   * One view per visitor per session, counted as soon as the listing is
   * known. This is the number the agent checks first, so it has to come from
   * the page actually opening — not from a card being rendered in a feed.
   */
  useEffect(() => {
    trackView(backendProperty?._id);
  }, [backendProperty?._id]);

  // Who posted this listing. The API sends a name-and-logo projection only.
  const agentPath = agentProfilePath(backendProperty?.owner);
  const agentName = agentDisplayName(backendProperty?.owner);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await propertyApi.getPropertyBySlug({ slug: resolvedSlug });
        const backendData = data as BackendProperty;
        setProperty(mapBackendToFrontendProperty(backendData));
        setBackendProperty(backendData);
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load property';
        setError(errorMessage);
        toast.error('Error', { description: errorMessage });
      } finally {
        setLoading(false);
      }
    };

    if (initialProperty && (initialProperty.slug === resolvedSlug || initialProperty._id === resolvedSlug)) {
      setLoading(false);
      return;
    }
    if (!resolvedSlug) { setError('Property slug is missing'); setLoading(false); return; }
    fetchProperty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSlug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center text-slate-500">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Loading property…</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-slate-900">Property not found</h1>
        <p className="mb-5 text-sm text-slate-500">{error || 'The property you are looking for does not exist.'}</p>
        <Button onClick={() => router.push('/properties')}>Browse properties</Button>
      </div>
    );
  }

  // Real photos only. A listing without any shows that it has none.
  const images: string[] = (() => {
    const usable = (url?: string) =>
      url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) ? url : null;
    const list: string[] = [];
    if (backendProperty) {
      const main = usable(backendProperty.mainPhotoUrl);
      if (main) list.push(main);
      backendProperty.additionalPhotosUrls?.forEach((url) => { const u = usable(url); if (u) list.push(u); });
    }
    return list;
  })();
  const uploadedVideo = backendProperty?.videoUrl && !youTubeId(backendProperty.videoUrl) ? backendProperty.videoUrl : null;
  const youTube = youTubeId(property.videoUrl);

  const isRent = property.purpose === 'rent';
  const purposeLabel = isRent ? 'For Rent' : 'For Sale';
  const priceShort = amountShort(property.price) || amountWithSeparators(property.price) || '—';
  const size = propertySizeLabel({ marla: property.marla, kanal: property.kanal, areaSize: Number(property.area) });
  const place = [property.areaName || property.location, property.city]
    .filter(Boolean)
    .map((part) => toTitleCase(String(part)))
    .filter((part, i, all) => all.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === i)
    .join(', ');
  const features: string[] = backendProperty?.features ?? [];

  const details: { label: string; value: string }[] = [
    { label: 'Type', value: toTitleCase(property.type) },
    { label: 'Price', value: `PKR ${amountWithSeparators(property.price) || property.price}${isRent ? ' / month' : ''}` },
    { label: 'Area', value: size },
    { label: 'Purpose', value: purposeLabel },
    { label: 'Location', value: toTitleCase(property.location) },
    { label: 'City', value: toTitleCase(property.city) },
    ...(property.bedrooms > 0 ? [{ label: 'Bedrooms', value: String(property.bedrooms) }] : []),
    ...(property.bathrooms > 0 ? [{ label: 'Bathrooms', value: String(property.bathrooms) }] : []),
    { label: 'Added', value: getTimeAgo(backendProperty?.createdAt) },
  ];

  const getSchemaType = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'house': return 'SingleFamilyResidence';
      case 'apartment': case 'flat': return 'Apartment';
      case 'plot': case 'land': return 'Landform';
      case 'shop': case 'commercial': case 'office': case 'factory': return 'Place';
      case 'hotel': return 'Hotel';
      case 'restaurant': return 'Restaurant';
      default: return 'Accommodation';
    }
  };

  // /properties/[slug] writes its structured data on the server; this is for
  // /listing-detail/[id], which fetches the listing in the browser.
  const jsonLd = !initialProperty ? {
    '@context': 'https://schema.org',
    '@type': getSchemaType(property.type),
    name: property.name,
    description: property.description
      ? property.description.replace(/<[^>]*>?/gm, '').substring(0, 300).trim() + '...'
      : `${property.name} in ${toTitleCase(property.location)}, ${toTitleCase(property.city)}`,
    image: images,
    address: { '@type': 'PostalAddress', addressLocality: toTitleCase(property.city), addressRegion: toTitleCase(property.location), addressCountry: 'PK' },
    ...(property.bedrooms > 0 ? { numberOfBedrooms: property.bedrooms } : {}),
    ...(property.bathrooms > 0 ? { numberOfBathrooms: property.bathrooms } : {}),
    floorSize: { '@type': 'QuantitativeValue', value: property.area, unitCode: 'SQF' },
    offers: {
      '@type': 'Offer', price: property.price, priceCurrency: 'PKR',
      businessFunction: property.purpose === 'buy' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: 'https://schema.org/InStock',
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
  } : null;

  const WaIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg className={cn('shrink-0 fill-current', className)} viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );

  /** The two contact buttons, used in the sidebar, under the price on phones, and in the sticky bar. */
  const ContactButtons = ({ stacked = false, masked = true }: { stacked?: boolean; masked?: boolean }) => (
    <div className={cn('grid gap-2', stacked ? 'grid-cols-1' : 'grid-cols-2')}>
      <button
        type="button"
        onClick={revealOrDial}
        className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md border border-primary bg-white px-3 text-[14px] font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Phone className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {numberShown
            ? property.contactNumber
            : masked && property.contactNumber
              ? `Call ${maskPhone(property.contactNumber)}`
              : 'Show number'}
        </span>
      </button>
      <button
        type="button"
        onClick={openWhatsApp}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#25D366] px-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1ebe5b]"
      >
        <WaIcon />
        WhatsApp
      </button>
    </div>
  );

  const ClosedNotice = () => (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[14px] text-amber-900">
      <span className="font-semibold">{closedLabel}.</span>{' '}
      This property is no longer available, so the contact details are hidden.
    </div>
  );

  const related = [
    {
      list: relatedByArea,
      title: `Similar ${toTitleCase(property.type)}s in ${toTitleCase(property.location)}`,
      href: property.areaSlug
        ? `/properties/${isRent ? 'rent' : 'sale'}/${property.citySlug || property.city.toLowerCase()}/${property.areaSlug}`
        : null,
    },
    {
      list: relatedByOwner,
      title: `More from ${agentName}`,
      href: agentPath || null,
    },
    {
      list: relatedByCity,
      title: `Similar ${toTitleCase(property.type)}s in ${toTitleCase(property.city)}`,
      href: backendProperty?.listingType
        ? `/properties/${backendProperty.listingType}/${property.citySlug || property.city.toLowerCase()}`
        : null,
    },
  ];

  return (
    <div className="max-w-full pb-6 md:pb-10">
      {isMounted && jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      <div className="container mx-auto md:px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="min-w-0">
            {images.length > 0 || uploadedVideo ? (
              <PropertyGallery
                images={images}
                title={property.name}
                videoUrl={uploadedVideo}
                videoPoster={backendProperty?.videoPosterUrl ?? null}
                badge={closed ? closedLabel : purposeLabel}
              />
            ) : (
              <div className="relative flex aspect-[5/3] flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 md:aspect-auto md:h-[320px] md:rounded-lg md:border md:border-slate-200">
                {/* Phones have no header on a listing; this is the way back. */}
                <button
                  type="button"
                  onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
                  className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-800 shadow-md md:hidden"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <ImageOff className="h-8 w-8" />
                <span className="text-sm">No photos uploaded for this property</span>
              </div>
            )}

            {/* Price, title, place, key facts */}
            <header className="px-4 pt-4 md:px-0 md:pt-5">
              <p className="flex items-baseline gap-1.5 text-slate-900">
                <span className="text-[13px] font-semibold text-slate-500">PKR</span>
                <span className="text-[26px] font-bold leading-none tracking-tight sm:text-[30px]">{priceShort}</span>
                {isRent && <span className="text-sm text-slate-500">/ month</span>}
              </p>
              <h1 className="mt-2 text-[17px] font-semibold leading-snug text-slate-900 sm:text-xl">
                {property.name}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-slate-500">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 truncate">{place}</span>
                {hasCoords && (
                  <button
                    type="button"
                    onClick={() => scrollToSection('location-section')}
                    className="shrink-0 font-medium text-primary hover:underline"
                  >
                    View on map
                  </button>
                )}
              </p>

              <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-200 py-3 text-[14px] text-slate-700">
                {property.bedrooms > 0 && (
                  <li className="flex items-center gap-1.5">
                    <BedDouble className="h-[18px] w-[18px] text-slate-400" />
                    <span className="font-semibold text-slate-900">{property.bedrooms}</span> Beds
                  </li>
                )}
                {property.bathrooms > 0 && (
                  <li className="flex items-center gap-1.5">
                    <Bath className="h-[18px] w-[18px] text-slate-400" />
                    <span className="font-semibold text-slate-900">{property.bathrooms}</span> Baths
                  </li>
                )}
                {size !== '—' && (
                  <li className="flex items-center gap-1.5">
                    <Ruler className="h-[18px] w-[18px] text-slate-400" />
                    <span className="font-semibold text-slate-900">{size}</span>
                  </li>
                )}
                <li className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-[18px] w-[18px] text-slate-400" />
                  Added {getTimeAgo(backendProperty?.createdAt).toLowerCase()}
                </li>
              </ul>
            </header>

            {/* Phones: contact right under the facts. */}
            <div ref={contactButtonsRef} className="px-4 pt-4 lg:hidden">
              {closed ? <ClosedNotice /> : <ContactButtons masked={false} />}
            </div>

            {/* Section nav */}
            <nav
              aria-label="Sections"
              className="sticky top-0 z-30 mt-5 border-b border-slate-200 bg-white md:top-[60px]"
            >
              <div ref={tabsRef} className="hide-scrollbar flex gap-6 overflow-x-auto px-4 md:px-0">
                {SECTIONS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-section={tab.id}
                    onClick={() => scrollToSection(tab.id)}
                    className={cn(
                      '-mb-px whitespace-nowrap border-b-2 py-3 text-[14px] font-medium transition-colors',
                      activeSection === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-900',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="divide-y divide-slate-200 px-4 md:px-0">
              {/* Overview */}
              <section id="overview-section" className="scroll-mt-32 py-6">
                <h2 className="mb-3 text-lg font-bold text-slate-900">Overview</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
                  {details.map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-[14px]">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="min-w-0 truncate text-right font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Description */}
              <section id="description-section" className="scroll-mt-32 py-6">
                <h2 className="mb-3 text-lg font-bold text-slate-900">Description</h2>
                <div className={cn('relative', !isDescriptionExpanded && descriptionOverflows && 'max-h-[220px] overflow-hidden')}>
                  <div
                    ref={descriptionRef}
                    className="prose prose-sm max-w-none text-[15px] leading-relaxed text-slate-700 prose-headings:text-slate-900 prose-a:text-primary"
                    dangerouslySetInnerHTML={{ __html: property.description || `This ${property.type.toLowerCase()} is located in ${toTitleCase(property.location)}, ${toTitleCase(property.city)}.` }}
                  />
                  {!isDescriptionExpanded && descriptionOverflows && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                  )}
                </div>
                {descriptionOverflows && (
                  <button
                    type="button"
                    className="mt-2 text-[14px] font-semibold text-primary hover:underline"
                    onClick={() => setIsDescriptionExpanded((v) => !v)}
                  >
                    {isDescriptionExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </section>

              {/* Features */}
              <section id="features-section" className="scroll-mt-32 py-6">
                <h2 className="mb-3 text-lg font-bold text-slate-900">Features &amp; amenities</h2>
                {features.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature, idx) => (
                      <li key={`${feature}-${idx}`} className="flex items-start gap-2 text-[14px] text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-slate-500">The dealer has not listed any features for this property.</p>
                )}
              </section>

              {/* A YouTube link (uploaded videos play in the gallery above). */}
              {youTube && (
                <section id="video-section" className="scroll-mt-32 py-6">
                  <h2 className="mb-3 text-lg font-bold text-slate-900">Video</h2>
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
                    <iframe
                      src={`https://www.youtube.com/embed/${youTube}`}
                      title={`${property.name} — video`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                </section>
              )}

              {/* ── Location ─────────────────────────────────────────────
                  resolvedLat / resolvedLng are taken from backendProperty
                  first (most reliable) then fall back to mapped property.
                  This ensures the map shows even when the mapping utility
                  does not copy lat/lng to the frontend Property type.
              ────────────────────────────────────────────────────────── */}
              <section id="location-section" className="scroll-mt-32 py-6">
                <h2 className="mb-1 text-lg font-bold text-slate-900">Location</h2>
                <p className="mb-3 flex items-center gap-1.5 text-[14px] text-slate-500">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {place}, Pakistan
                </p>
                {hasCoords ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <PropertyMap latitude={resolvedLat!} longitude={resolvedLng!} title={property.name} />
                  </div>
                ) : (
                  <p className="text-[14px] text-slate-500">The exact location has not been pinned on the map.</p>
                )}
              </section>
            </div>
          </div>

          {/* ── Sidebar (desktop) ───────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="flex items-baseline gap-1.5 text-slate-900">
                  <span className="text-[12px] font-semibold text-slate-500">PKR</span>
                  <span className="text-[22px] font-bold leading-none">{priceShort}</span>
                  {isRent && <span className="text-[13px] text-slate-500">/ month</span>}
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  {toTitleCase(property.type)} {purposeLabel.toLowerCase()} · {size}
                </p>

                {agentPath && (
                  /*
                    Who is behind the listing, and a way through to the rest
                    of their stock. Buyers here shop by dealer as much as by
                    house, and a bare phone number gave them nowhere to look.
                  */
                  <Link
                    href={agentPath}
                    className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4 group"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-[15px] font-semibold text-primary">
                      {agentName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-slate-900 group-hover:text-primary">
                        {agentName}
                      </span>
                      <span className="text-[12px] text-slate-500">View profile and all listings</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )}

                <div className="mt-4">
                  {closed ? <ClosedNotice /> : <ContactButtons stacked />}
                </div>
              </div>

              <div className="px-1">
                {/*
                  Somewhere to say "this is a scam" — the buyer who
                  called is the only person who finds out.
                */}
                <ReportButton type="listing" propertyId={backendProperty?._id} label="Report this listing" />
              </div>
            </div>
          </aside>
        </div>

        {/* Phones: report link at the end of the listing. */}
        <div className="px-4 pt-2 lg:hidden">
          <ReportButton type="listing" propertyId={backendProperty?._id} label="Report this listing" />
        </div>

        {/* ── Similar properties ─────────────────────────────────── */}
        {related.map(({ list, title, href }) =>
          list.length > 0 ? (
            <section key={title} className="mt-8 border-t border-slate-200 pt-6">
              <div className="mb-4 flex items-end justify-between gap-4 px-4 md:px-0">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                {href && (
                  <Link href={href} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                    View all
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 px-4 md:px-0 lg:grid-cols-2 lg:gap-3">
                {list.slice(0, 6).map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>
            </section>
          ) : null
        )}
      </div>

      {/* Sticky contact bar on phones — nothing to offer once it has gone. */}
      {!closed && (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-200 lg:hidden',
            showStickyContact ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <ContactButtons masked={false} />
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
