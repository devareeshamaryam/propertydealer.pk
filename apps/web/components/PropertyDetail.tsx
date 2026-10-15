/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useCallback, useState, useEffect, useRef, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Bath, BedDouble, Building2, CalendarClock, Check, ChevronRight, Clock, Compass, DoorOpen,
  Eye, FileCheck, Grid3x3, Hash, Home, ImageOff, KeyRound, Layers, Loader2, MapPin, MapPinned,
  Paintbrush, Phone, Plug, Ruler, Share2, ShieldAlert, Sparkles, Star, Store, Tag, Trees, Wallet, Zap,
} from 'lucide-react';
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
import { FEATURE_GROUPS } from '@/lib/property-features';
import { resolved, waDigits } from '@/lib/site-settings';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import dynamic from 'next/dynamic';
import PropertyGallery from '@/components/property/PropertyGallery';
import PropertyCard from '@/components/PropertyCard';
import { ReportButton } from '@/components/property/ReportButton';

const PropertyMap = dynamic(() => import('@/components/PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] w-full animate-pulse items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

/*
 * The listing page.
 *
 * Built like a property app: the photos open the page edge to edge with the
 * price on a strip across their bottom corner (no separate price block to
 * scroll past), then the title, where it is and four fact tiles. Details,
 * description, features grouped the way the add-listing form groups them,
 * and the map follow; the dealer card and the call / WhatsApp buttons stay in
 * view — a sticky card on desktop, a bar along the bottom on a phone.
 *
 * A visitor who lands here straight from Google has no history to go back
 * to, so the page carries its own ways on: a back button that falls back to
 * the home page, a slim bar with back / title / share once the photos scroll
 * away, breadcrumbs, "more in this area / city / type" links, and the
 * similar listings at the end.
 *
 * Sold and rented listings keep their page (it is ranked) but are stamped
 * across the photo, lose their phone number and WhatsApp button, and point
 * the visitor at what is still available.
 */

const SECTIONS = [
  { id: 'overview-section', label: 'Overview' },
  { id: 'description-section', label: 'Description' },
  { id: 'features-section', label: 'Features' },
  { id: 'location-section', label: 'Location' },
];

const GROUP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'Main features': Star,
  'Condition & handover': KeyRound,
  'Floors & layout': Layers,
  Rooms: DoorOpen,
  Utilities: Zap,
  Finishing: Paintbrush,
  Outside: Trees,
  'Building facilities': Building2,
  'Society & nearby': MapPinned,
  'Utilities at site': Plug,
  'Plot details': Grid3x3,
  'Ownership & papers': FileCheck,
  'Payment & terms': Wallet,
  'Rental terms': CalendarClock,
  Commercial: Store,
};

/** A YouTube id from any of the link shapes people paste, or null. */
function youTubeId(url?: string | null): string | null {
  if (!url || !/youtu\.?be/.test(url)) return null;
  const match = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/.exec(url);
  return match?.[1] ?? null;
}

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The listing's features, sorted into the add-listing form's groups. */
function groupFeatures(features: string[]): { title: string; items: string[] }[] {
  const left = new Set(features);
  const groups: { title: string; items: string[] }[] = [];
  for (const group of FEATURE_GROUPS) {
    const items = group.features.filter((f) => left.has(f));
    if (items.length) {
      items.forEach((f) => left.delete(f));
      const existing = groups.find((g) => g.title === group.title);
      if (existing) existing.items.push(...items);
      else groups.push({ title: group.title, items });
    }
  }
  if (left.size) groups.push({ title: 'Other features', items: [...left] });
  return groups;
}

const PropertyDetail = ({ slug, initialProperty }: { slug?: string; initialProperty?: BackendProperty | null }) => {
  const router = useRouter();
  const params = useParams();
  const settings = useSiteSettings();
  const site = resolved(settings);
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
  const [showTopBar, setShowTopBar] = useState(false);
  const galleryEndRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  /*
   * Contact hooks, declared above the early returns on purpose: a first render
   * that bailed out ran fewer hooks than the render after the fetch resolved,
   * which is the "Rendered more hooks than during the previous render" crash.
   */
  const [numberShown, setNumberShown] = useState(false);

  const waLink = useCallback(() => {
    const message = encodeURIComponent(`I want to know more about this property: ${property?.name ?? ''}\nLink: ${window.location.href}`);
    // The listing's own number; the site's WhatsApp (Settings → General) only if it has none.
    const raw = property?.whatsappNumber || property?.contactNumber || site.whatsapp;
    return `https://wa.me/${waDigits(raw)}?text=${message}`;
  }, [property?.name, property?.whatsappNumber, property?.contactNumber, site.whatsapp]);

  /*
   * One tap for the number, no account. Keeping it out of the rendered markup
   * until somebody asks is what protects it from scrapers, and the tap is a
   * far better enquiry signal than a page view.
   */
  const revealOrDial = useCallback(() => {
    if (!numberShown) {
      setNumberShown(true);
      trackContact(backendProperty?._id, 'phone');
      return;
    }
    window.location.href = `tel:${property?.contactNumber ?? ''}`;
  }, [numberShown, backendProperty?._id, property?.contactNumber]);

  const closed = property?.availability === 'sold' || property?.availability === 'rented';
  const closedLabel = property?.availability === 'rented' ? 'Rented out' : 'Sold out';

  const openWhatsApp = useCallback(() => {
    trackContact(backendProperty?._id, 'whatsapp');
    window.open(waLink(), '_blank');
  }, [backendProperty?._id, waLink]);

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: property?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      // Share sheet dismissed.
    }
  }, [property?.name]);

  /** Back to where they came from on this site, else home — never off the site. */
  const goBack = useCallback(() => {
    const sameSite = document.referrer.startsWith(window.location.origin);
    if (sameSite && window.history.length > 1) router.back();
    else router.push('/');
  }, [router]);

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Recently';
    try {
      const diffInHours = Math.floor((Date.now() - new Date(dateString).getTime()) / 3_600_000);
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours} hours ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 30) return `${diffInDays} days ago`;
      const diffInMonths = Math.floor(diffInDays / 30);
      if (diffInMonths === 1) return '1 month ago';
      if (diffInMonths < 12) return `${diffInMonths} months ago`;
      return 'Over a year ago';
    } catch {
      return 'Recently';
    }
  };

  const resolvedLat: number | undefined = backendProperty?.latitude ?? (property?.latitude as number | undefined);
  const resolvedLng: number | undefined = backendProperty?.longitude ?? (property?.longitude as number | undefined);
  const hasCoords = !!(resolvedLat && resolvedLng);

  useEffect(() => { setIsMounted(true); }, []);

  // Only offer "Read more" when there is more to read.
  useEffect(() => {
    const el = descriptionRef.current;
    if (el) setDescriptionOverflows(el.scrollHeight > 240);
  }, [property?.description]);

  useEffect(() => {
    if (!tabsRef.current) return;
    const activeTab = tabsRef.current.querySelector(`[data-section="${activeSection}"]`) as HTMLElement | null;
    activeTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeSection]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); }),
      { rootMargin: '-140px 0px -50% 0px' }
    );
    const timeout = setTimeout(() => {
      SECTIONS.forEach(({ id }) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    }, 100);

    // The slim top bar (phones) appears once the photos have scrolled away.
    const topBarObserver = new IntersectionObserver(
      ([entry]) => setShowTopBar(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    if (galleryEndRef.current) topBarObserver.observe(galleryEndRef.current);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      topBarObserver.disconnect();
    };
  }, [property]);

  useEffect(() => {
    if (!property) return;
    let cancelled = false;
    const rows = (data: any): BackendProperty[] => (Array.isArray(data) ? data : data?.properties ?? []);
    // Three independent lists — fetched together, not one after another.
    Promise.allSettled([
      propertyApi.getAll({
        cityName: property.city, search: property.location,
        type: backendProperty?.propertyType, purpose: backendProperty?.listingType, limit: 8,
      }),
      propertyApi.getAll({
        cityName: property.city, type: backendProperty?.propertyType,
        purpose: backendProperty?.listingType, limit: 10,
      }),
      backendProperty?.owner?._id
        ? propertyApi.getAll({ ownerId: backendProperty.owner._id, limit: 8 } as any)
        : Promise.resolve([]),
    ]).then(([areaRes, cityRes, ownerRes]) => {
      if (cancelled) return;
      const areaRows = areaRes.status === 'fulfilled' ? rows(areaRes.value) : [];
      const cityRows = cityRes.status === 'fulfilled' ? rows(cityRes.value) : [];
      const ownerRows = ownerRes.status === 'fulfilled' ? rows(ownerRes.value) : [];
      const notThis = (p: Property) => p.slug !== resolvedSlug;
      setRelatedByArea(areaRows.map(mapBackendToFrontendProperty).filter(notThis));
      setRelatedByCity(
        cityRows.map(mapBackendToFrontendProperty)
          .filter((p) => notThis(p) && !areaRows.some((a: any) => a.slug === p.slug)),
      );
      setRelatedByOwner(ownerRows.map(mapBackendToFrontendProperty).filter(notThis));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, resolvedSlug]);

  // One view per visitor per session, counted when the listing is known.
  useEffect(() => {
    trackView(backendProperty?._id);
  }, [backendProperty?._id]);

  const agentPath = agentProfilePath(backendProperty?.owner);
  const agentName = agentDisplayName(backendProperty?.owner);
  const agentAvatar: string | undefined = backendProperty?.owner?.avatarUrl;

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
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.push('/')}>Home</Button>
          <Button onClick={() => router.push('/properties')}>Browse properties</Button>
        </div>
      </div>
    );
  }

  // Real photos only. A listing without any says so.
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
  const purposeSlug = isRent ? 'rent' : 'sale';
  const purposeLabel = isRent ? 'For Rent' : 'For Sale';
  const priceShort = amountShort(property.price) || amountWithSeparators(property.price) || '—';
  const size = propertySizeLabel({ marla: property.marla, kanal: property.kanal, areaSize: Number(property.area) });
  const areaLabel = toTitleCase(property.areaName || property.location || '');
  const cityLabel = toTitleCase(property.city || '');
  const place = [areaLabel, cityLabel]
    .filter(Boolean)
    .filter((part, i, all) => all.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === i)
    .join(', ');
  const citySlug = property.citySlug || slugify(property.city || '');
  const typeSlug = (property.type || '').toLowerCase();
  const typePlural = toTitleCase(property.type || 'Propert') + (property.type ? 's' : 'ies');
  const featureGroups = groupFeatures(backendProperty?.features ?? []);
  const listingRef = backendProperty?._id ? String(backendProperty._id).slice(-6).toUpperCase() : '';
  const views = Number(backendProperty?.views) || 0;

  const facts = [
    ...(property.bedrooms > 0 ? [{ icon: BedDouble, value: String(property.bedrooms), label: property.bedrooms === 1 ? 'Bedroom' : 'Bedrooms' }] : []),
    ...(property.bathrooms > 0 ? [{ icon: Bath, value: String(property.bathrooms), label: property.bathrooms === 1 ? 'Bathroom' : 'Bathrooms' }] : []),
    ...(size !== '—' ? [{ icon: Ruler, value: size, label: 'Area' }] : []),
    { icon: Home, value: toTitleCase(property.type), label: 'Type' },
    { icon: Tag, value: isRent ? 'Rent' : 'Sale', label: 'Purpose' },
  ].slice(0, 4);

  const details: { label: string; value: string }[] = [
    { label: 'Price', value: `PKR ${amountWithSeparators(property.price) || property.price}${isRent ? ' / month' : ''}` },
    { label: 'Type', value: toTitleCase(property.type) },
    { label: 'Purpose', value: purposeLabel },
    { label: 'Area', value: size },
    ...(property.bedrooms > 0 ? [{ label: 'Bedrooms', value: String(property.bedrooms) }] : []),
    ...(property.bathrooms > 0 ? [{ label: 'Bathrooms', value: String(property.bathrooms) }] : []),
    { label: 'Location', value: toTitleCase(property.location) },
    { label: 'City', value: cityLabel },
    { label: 'Added', value: getTimeAgo(backendProperty?.createdAt) },
    ...(listingRef ? [{ label: 'Listing ref', value: `#${listingRef}` }] : []),
  ];

  // Ways on for a visitor who arrived straight from search.
  const explore = [
    ...(property.areaSlug && citySlug
      ? [{ href: `/properties/${purposeSlug}/${citySlug}/${property.areaSlug}`, label: `${purposeLabel} in ${areaLabel}` }]
      : []),
    ...(citySlug && typeSlug
      ? [{ href: `/properties/${purposeSlug}/${citySlug}/${typeSlug}`, label: `${typePlural} ${purposeLabel.toLowerCase()} in ${cityLabel}` }]
      : []),
    ...(citySlug ? [{ href: `/properties/${purposeSlug}/${citySlug}`, label: `All properties ${purposeLabel.toLowerCase()} in ${cityLabel}` }] : []),
    ...(citySlug ? [{ href: `/properties/all/${citySlug}`, label: `Rent & sale in ${cityLabel}` }] : []),
  ];

  const crumbs = [
    { href: '/', label: 'Home' },
    { href: `/properties/${purposeSlug}`, label: purposeLabel },
    ...(citySlug ? [{ href: `/properties/${purposeSlug}/${citySlug}`, label: cityLabel }] : []),
    ...(property.areaSlug && citySlug ? [{ href: `/properties/${purposeSlug}/${citySlug}/${property.areaSlug}`, label: areaLabel }] : []),
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
      : `${property.name} in ${toTitleCase(property.location)}, ${cityLabel}`,
    image: images,
    address: { '@type': 'PostalAddress', addressLocality: cityLabel, addressRegion: toTitleCase(property.location), addressCountry: 'PK' },
    ...(property.bedrooms > 0 ? { numberOfBedrooms: property.bedrooms } : {}),
    ...(property.bathrooms > 0 ? { numberOfBathrooms: property.bathrooms } : {}),
    floorSize: { '@type': 'QuantitativeValue', value: property.area, unitCode: 'SQF' },
    offers: {
      '@type': 'Offer', price: property.price, priceCurrency: 'PKR',
      businessFunction: property.purpose === 'buy' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: closed ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
  } : null;

  const WaIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg className={cn('shrink-0 fill-current', className)} viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );

  const CallButton = ({ full = false, compact = false }: { full?: boolean; compact?: boolean }) => (
    <button
      type="button"
      onClick={revealOrDial}
      className={cn(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-primary bg-white px-3 font-semibold text-primary transition-colors hover:bg-primary/5',
        compact ? 'h-11 text-[14px]' : 'h-12 text-[15px]',
        full && 'w-full',
      )}
    >
      <Phone className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {numberShown
          ? property.contactNumber
          : compact
            ? 'Call'
            : property.contactNumber
              ? `Show ${maskPhone(property.contactNumber)}`
              : 'Show number'}
      </span>
    </button>
  );

  const WhatsAppButton = ({ full = false, compact = false }: { full?: boolean; compact?: boolean }) => (
    <button
      type="button"
      onClick={openWhatsApp}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 font-semibold text-white transition-colors hover:bg-[#1ebe5b]',
        compact ? 'h-11 text-[14px]' : 'h-12 text-[15px]',
        full && 'w-full',
      )}
    >
      <WaIcon />
      WhatsApp
    </button>
  );

  const ClosedNotice = () => (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-[14px] text-red-900">
      <p className="font-semibold">{closedLabel}</p>
      <p className="mt-0.5 text-red-800/80">
        This property is no longer available, so its contact details are hidden.
      </p>
      {citySlug && (
        <Link
          href={`/properties/${purposeSlug}/${citySlug}`}
          className="mt-2 inline-flex items-center gap-1 font-semibold text-red-700 hover:underline"
        >
          See available properties in {cityLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );

  const AgentCard = () =>
    agentPath ? (
      // Who is behind the listing, and a way through to the rest of their stock.
      <Link href={agentPath} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
        {agentAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agentAvatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-[16px] font-semibold text-primary">
            {agentName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">Listed by</span>
          <span className="block truncate text-[14.5px] font-semibold text-slate-900 group-hover:text-primary">{agentName}</span>
        </span>
        <span className="hidden shrink-0 text-[12.5px] font-medium text-primary sm:inline">View profile</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </Link>
    ) : null;

  const SafetyTips = () => (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-amber-900">
        <ShieldAlert className="h-4 w-4" /> Stay safe
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px] leading-relaxed text-amber-900/80">
        <li>See the property in person before paying anything.</li>
        <li>Check the owner’s CNIC and the ownership papers.</li>
        <li>Never send an advance to an unverified account.</li>
      </ul>
    </div>
  );

  const priceStrip = (
    <div className={cn('flex items-baseline gap-1.5 rounded-tr-2xl px-4 py-2.5 text-white shadow-lg', closed ? 'bg-slate-900/90' : 'bg-price-tag')}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">PKR</span>
      <span className="text-[22px] font-extrabold leading-none tracking-tight sm:text-[26px]">{priceShort}</span>
      {isRent && <span className="text-[12px] font-medium text-white/85">/ month</span>}
    </div>
  );

  const related = [
    {
      list: relatedByArea,
      title: `Similar ${typePlural.toLowerCase()} in ${toTitleCase(property.location)}`,
      href: property.areaSlug && citySlug ? `/properties/${purposeSlug}/${citySlug}/${property.areaSlug}` : null,
    },
    { list: relatedByOwner, title: `More from ${agentName}`, href: agentPath || null },
    {
      list: relatedByCity,
      title: `Similar ${typePlural.toLowerCase()} in ${cityLabel}`,
      href: citySlug ? `/properties/${purposeSlug}/${citySlug}` : null,
    },
  ];

  return (
    <div className="max-w-full pb-28 lg:pb-12">
      {isMounted && jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      {/* Phones: slim bar once the photos have scrolled away (the site header is hidden here). */}
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md transition-transform duration-200 md:hidden',
          showTopBar ? 'translate-y-0' : '-translate-y-full',
        )}
      >
        <div className="flex h-12 items-center gap-2 px-2">
          <button type="button" onClick={goBack} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-slate-700 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-slate-900">{property.name}</p>
            <p className="truncate text-[11.5px] font-medium text-price-tag">PKR {priceShort}{isRent ? ' / month' : ''}</p>
          </div>
          <Link href="/" aria-label="Home" className="grid h-9 w-9 place-items-center rounded-full text-slate-700 hover:bg-slate-100">
            <Home className="h-[18px] w-[18px]" />
          </Link>
          <button type="button" onClick={share} aria-label="Share" className="grid h-9 w-9 place-items-center rounded-full text-slate-700 hover:bg-slate-100">
            <Share2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="container mx-auto md:px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-8">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="min-w-0">
            {images.length > 0 || uploadedVideo ? (
              <PropertyGallery
                images={images}
                title={property.name}
                videoUrl={uploadedVideo}
                videoPoster={backendProperty?.videoPosterUrl ?? null}
                badge={closed ? undefined : purposeLabel}
                priceTag={priceStrip}
                closedLabel={closed ? closedLabel : null}
              />
            ) : (
              <div className="relative flex aspect-[5/3] flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 md:aspect-auto md:h-[340px] md:rounded-2xl md:border md:border-slate-200">
                <button
                  type="button"
                  onClick={goBack}
                  className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-800 shadow-md md:hidden"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <ImageOff className="h-8 w-8" />
                <span className="text-sm">No photos uploaded for this property</span>
                {closed && (
                  <span className="mt-1 rounded-lg bg-red-600 px-3 py-1 text-sm font-bold uppercase tracking-widest text-white">{closedLabel}</span>
                )}
                <div className="absolute bottom-0 left-0">{priceStrip}</div>
              </div>
            )}
            <div ref={galleryEndRef} aria-hidden />

            {/* Title, place, quick facts */}
            <header className="px-4 pt-4 md:px-0 md:pt-5">
              {/* Phones: where this sits, as links — the only navigation a visitor from Google has. */}
              <nav aria-label="Breadcrumb" className="hide-scrollbar -mx-4 mb-2 flex items-center gap-1 overflow-x-auto px-4 text-[12px] text-slate-500 md:hidden">
                {crumbs.map((c, i) => (
                  <span key={c.href} className="flex shrink-0 items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                    <Link href={c.href} className="hover:text-primary">{c.label}</Link>
                  </span>
                ))}
              </nav>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', closed ? 'bg-red-600 text-white' : 'bg-primary/10 text-primary')}>
                  {closed ? closedLabel : purposeLabel}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {toTitleCase(property.type)}
                </span>
                {property.isFeatured && !closed && (
                  <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-900">Featured</span>
                )}
              </div>

              <h1 className="mt-2 text-[19px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[24px]">
                {property.name}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-slate-600">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 truncate">{place}</span>
                {hasCoords && (
                  <button type="button" onClick={() => scrollToSection('location-section')} className="shrink-0 text-[13px] font-semibold text-primary hover:underline">
                    Map
                  </button>
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {getTimeAgo(backendProperty?.createdAt)}</span>
                {views > 0 && <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {views.toLocaleString('en-PK')} views</span>}
                {listingRef && <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> {listingRef}</span>}
                <button type="button" onClick={share} className="hidden items-center gap-1 font-medium text-slate-600 hover:text-primary md:inline-flex">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
              </p>

              {/* Quick facts, as tiles. */}
              <ul className="mt-4 grid grid-cols-4 gap-2">
                {facts.map(({ icon: Icon, value, label }) => (
                  <li key={label} className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/60 px-1 py-2.5 text-center">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-primary shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="mt-1.5 max-w-full truncate text-[13.5px] font-bold text-slate-900">{value}</span>
                    <span className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
                  </li>
                ))}
              </ul>
            </header>

            {/* Phones: who listed it (desktop has it in the side card). */}
            <div className="space-y-3 px-4 pt-4 lg:hidden">
              <AgentCard />
              {closed && <ClosedNotice />}
            </div>

            {/* Section nav */}
            <nav
              aria-label="Sections"
              className="sticky top-12 z-30 mt-5 border-b border-slate-200 bg-white/95 backdrop-blur md:top-[72px]"
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
                      activeSection === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="space-y-4 px-4 pt-4 md:px-0">
              {/* Overview */}
              <section id="overview-section" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h2 className="mb-2 text-[17px] font-bold text-slate-900">Property details</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
                  {details.map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-dashed border-slate-200 py-2.5 text-[14px] last:border-0 sm:[&:nth-last-child(2)]:border-0">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="min-w-0 truncate text-right font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Description */}
              <section id="description-section" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h2 className="mb-2 text-[17px] font-bold text-slate-900">Description</h2>
                <div className={cn('relative', !isDescriptionExpanded && descriptionOverflows && 'max-h-[240px] overflow-hidden')}>
                  <div
                    ref={descriptionRef}
                    className="prose prose-sm max-w-none text-[14.5px] leading-relaxed text-slate-700 prose-headings:text-slate-900 prose-a:text-primary"
                    dangerouslySetInnerHTML={{ __html: property.description || `This ${property.type.toLowerCase()} is located in ${toTitleCase(property.location)}, ${cityLabel}.` }}
                  />
                  {!isDescriptionExpanded && descriptionOverflows && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                  )}
                </div>
                {descriptionOverflows && (
                  <button type="button" className="mt-2 text-[14px] font-semibold text-primary hover:underline" onClick={() => setIsDescriptionExpanded((v) => !v)}>
                    {isDescriptionExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </section>

              {/* Features, grouped */}
              <section id="features-section" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-[17px] font-bold text-slate-900">Features &amp; amenities</h2>
                {featureGroups.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {featureGroups.map(({ title, items }) => {
                      const Icon = GROUP_ICONS[title] ?? Sparkles;
                      return (
                        <div key={title} className="rounded-xl bg-slate-50 p-3">
                          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-primary ring-1 ring-slate-200">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            {title}
                          </p>
                          <ul className="flex flex-wrap gap-1.5">
                            {items.map((item) => (
                              <li key={item} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[12.5px] text-slate-700 ring-1 ring-slate-200">
                                <Check className="h-3 w-3 text-emerald-600" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[14px] text-slate-500">The dealer has not listed any features for this property.</p>
                )}
              </section>

              {/* A YouTube link (uploaded videos play in the gallery above). */}
              {youTube && (
                <section id="video-section" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h2 className="mb-3 text-[17px] font-bold text-slate-900">Video</h2>
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
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

              {/* Location */}
              <section id="location-section" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h2 className="mb-1 text-[17px] font-bold text-slate-900">Location</h2>
                <p className="mb-3 flex items-center gap-1.5 text-[14px] text-slate-500">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {place}, Pakistan
                </p>
                {hasCoords ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <PropertyMap latitude={resolvedLat!} longitude={resolvedLng!} title={property.name} />
                  </div>
                ) : (
                  <p className="text-[14px] text-slate-500">The exact location has not been pinned on the map.</p>
                )}
              </section>

              {/* Phones: safety + report sit at the end of the listing. */}
              <div className="space-y-3 lg:hidden">
                <SafetyTips />
                <ReportButton type="listing" propertyId={backendProperty?._id} label="Report this listing" />
              </div>

              {/* Ways on */}
              {explore.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-slate-900">
                    <Compass className="h-4 w-4 text-primary" /> Explore more
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {explore.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                      >
                        {label}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* ── Sidebar (desktop) ───────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-[84px] space-y-3">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]">
                <div className={cn('px-5 py-4 text-white', closed ? 'bg-slate-900' : 'bg-price-tag')}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
                    {closed ? closedLabel : isRent ? 'Monthly rent' : 'Asking price'}
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-[13px] font-semibold text-white/80">PKR</span>
                    <span className="text-[28px] font-extrabold leading-none tracking-tight">{priceShort}</span>
                    {isRent && <span className="text-[13px] text-white/80">/ month</span>}
                  </p>
                  <p className="mt-1 text-[12.5px] text-white/80">
                    {toTitleCase(property.type)} · {size} · {cityLabel}
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  <AgentCard />
                  {closed ? (
                    <ClosedNotice />
                  ) : (
                    <div className="space-y-2">
                      <CallButton full />
                      <WhatsAppButton full />
                    </div>
                  )}
                </div>
              </div>
              <SafetyTips />
              <div className="px-1">
                <ReportButton type="listing" propertyId={backendProperty?._id} label="Report this listing" />
              </div>
            </div>
          </aside>
        </div>

        {/* ── Similar properties ─────────────────────────────────── */}
        {related.map(({ list, title, href }) =>
          list.length > 0 ? (
            <section key={title} className="mt-8 px-4 md:px-0">
              <div className="mb-3 flex items-end justify-between gap-4">
                <h2 className="text-[17px] font-bold text-slate-900 sm:text-lg">{title}</h2>
                {href && (
                  <Link href={href} className="shrink-0 text-[13.5px] font-semibold text-primary hover:underline">
                    View all
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-3">
                {list.slice(0, 6).map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>
            </section>
          ) : null
        )}
      </div>

      {/* Phones: contact always in reach. Gone once the property has gone. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md lg:hidden">
        {closed ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-slate-600">
              <span className="font-semibold text-red-700">{closedLabel}.</span> Contact details hidden.
            </p>
            {citySlug && (
              <Link href={`/properties/${purposeSlug}/${citySlug}`} className="shrink-0 rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-white">
                See similar
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <CallButton compact />
            <WhatsAppButton compact />
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyDetail;
