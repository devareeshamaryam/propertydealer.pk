 /* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MapPin, Bed, Bath, Maximize, Share2, Phone, CheckCircle2, X, Loader2, ChevronLeft, ChevronRight, House, Tag, LayoutDashboard, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { propertyApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/utils';
import dynamic from 'next/dynamic';
import useEmblaCarousel from 'embla-carousel-react';

const PropertyMap = dynamic(() => import('@/components/PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] w-full bg-secondary animate-pulse rounded-xl flex items-center justify-center text-muted-foreground">
      Loading Map...
    </div>
  ),
});

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
  const [selectedImage, setSelectedImage] = useState(0);
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', features: [] });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview-section');
  const [relatedByArea, setRelatedByArea] = useState<Property[]>([]);
  const [relatedByCity, setRelatedByCity] = useState<Property[]>([]);
  const [relatedByOwner, setRelatedByOwner] = useState<Property[]>([]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showStickyContact, setShowStickyContact] = useState(false);
  const contactButtonsRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 25 });

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

    const sections = ['overview-section', 'description-section', 'features-section', 'video-section', 'location-section'];
    const timeout = setTimeout(() => {
      sections.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
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
      sections.forEach((id) => { const el = document.getElementById(id); if (el) observer.unobserve(el); });
      contactObserver.disconnect();
    };
  }, [property]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedImage(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (isLightboxOpen && emblaApi) emblaApi.scrollTo(selectedImage);
  }, [isLightboxOpen, emblaApi, selectedImage]);

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
  }, [property, resolvedSlug]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
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
  }, [resolvedSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading property...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto md:px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Property Not Found</h1>
          <p className="text-muted-foreground mb-4">{error || 'The property you are looking for does not exist.'}</p>
          <Button onClick={() => router.push('/properties')}>Back to Properties</Button>
        </div>
      </div>
    );
  }

  const getPlaceholderImages = (type: string): string[] => {
    const imagesByType: { [key: string]: string[] } = {
      House: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80', 'https://images.unsplash.com/photo-1598228723793-52759bba239c?w=1200&q=80'],
      Apartment: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80', 'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=1200&q=80'],
      Villa: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80', 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=1200&q=80'],
      Plot: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80'],
      Commercial: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80'],
      'Farm House': ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80', 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80', 'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=1200&q=80', 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80'],
    };
    return imagesByType[type] || imagesByType['House'] || [];
  };

  const getImages = (): string[] => {
    const getImageUrl = (url?: string): string | null => {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) return url;
      return null;
    };
    const validImages: string[] = [];
    if (backendProperty) {
      const main = getImageUrl(backendProperty.mainPhotoUrl);
      if (main) validImages.push(main);
      backendProperty.additionalPhotosUrls?.forEach(url => { const u = getImageUrl(url); if (u) validImages.push(u); });
    }
    return validImages.length > 0 ? validImages : getPlaceholderImages(property.type);
  };

 const getRelatedPropertyImage = (item: Property): string => {
    const bp = item as any;
    const main = bp.mainPhotoUrl || bp.images?.[0];
    if (main && (main.startsWith('http') || main.startsWith('/uploads/'))) return main;
    return getPlaceholderImages(item.type)[0] ?? '';
  };
  // Helper: format price compactly
  const formatPriceCompact = (price: number) => {
    if (price >= 10000000)
      return `${(price / 10000000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} Cr`;
    if (price >= 100000)
      return `${(price / 100000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} Lac`;
    return price.toLocaleString('en-PK');
  };

  const images = getImages();
  const formatPrice = (price: number) => price.toLocaleString('en-PK');

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Contact form submitted!');
    setShowContactForm(false);
    setFormData({ name: '', email: '', phone: '', message: '', features: [] });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: property.name, text: `Check out this property: ${property.name}`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const waLink = () => {
    const message = encodeURIComponent(`I want to know more about this property: ${property.name}\nLink: ${window.location.href}`);
    const raw = property.whatsappNumber || property.contactNumber || '923123456789';
    const clean = raw.replace(/\D/g, '');
    const num = clean.startsWith('92') ? clean : '92' + clean.replace(/^0/, '');
    return `https://wa.me/${num}?text=${message}`;
  };

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

  const jsonLd = property ? {
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

  const WaIcon = () => (
    <svg className="w-4 h-4 mr-2 fill-current shrink-0" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );

  // ── Vertical Related Property Card ──────────────────────────────────────
  const RelatedPropertyCard = ({ item }: { item: Property }) => (
    <div
      onClick={() => router.push(`/properties/${item.slug}`)}
      className="min-w-[62vw] max-w-[62vw] md:min-w-[260px] md:max-w-[260px] shrink-0 snap-start rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.14)] transition-all duration-300 cursor-pointer group flex flex-col"
    >
      <div className="relative w-full h-[150px] md:h-[170px] overflow-hidden bg-gray-100 shrink-0">
        <img
          src={getRelatedPropertyImage(item)}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const t = e.target as HTMLImageElement;
            const ph = getPlaceholderImages(item.type)[0];
            if (ph && t.src !== ph) t.src = ph;
          }}
        />
        <span className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
          {item.purpose === 'buy' ? 'For Sale' : 'For Rent'}
        </span>
        <span className="absolute top-2.5 right-2.5 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
          {item.type}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">{item.name}</h3>
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0 text-primary" />
          <span className="text-[11px] line-clamp-1">
            {toTitleCase(item.location)}{item.city ? `, ${toTitleCase(item.city)}` : ''}
          </span>
        </div>
        {item.bedrooms > 0 && (
          <div className="flex items-center gap-3 pt-1.5 border-t border-gray-100">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Bed className="w-3 h-3" /><span>{item.bedrooms} Beds</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Bath className="w-3 h-3" /><span>{item.bathrooms} Baths</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Maximize className="w-3 h-3" />
              <span>{item.marla && item.marla > 0 ? `${item.marla} M` : `${item.area} ft²`}</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              {item.purpose === 'buy' ? 'Total Price' : 'Monthly Rent'}
            </p>
            <p className="text-sm font-bold text-foreground">Rs. {formatPriceCompact(item.price)}</p>
          </div>
          <div className="flex items-center gap-1 bg-foreground text-background text-[11px] font-semibold px-3 py-1.5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
            Explore <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background max-w-full">
      {isMounted && jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      <div className="pt-18 md:pt-20">
        <div className="container mx-auto md:px-4 pb-6 md:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Main Content ─────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Title & badges */}
              <div>
                <div className="flex items-start justify-between mb-4 px-4 md:px-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                        {property.purpose === 'buy' ? 'For Sale' : 'For Rent'}
                      </span>
                      <span className="px-3 py-1 bg-secondary text-foreground text-sm font-medium rounded-full">
                        {property.type}
                      </span>
                    </div>
                    <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-3">{property.name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <MapPin className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-lg">
                        {toTitleCase(property.areaName || property.location)}
                        {property.city && property.city.toLowerCase() !== (property.areaName || property.location).toLowerCase()
                          ? `, ${toTitleCase(property.city)}` : ''}
                      </span>
                      {/* Show on Map button — uses resolved coords from backendProperty */}
                      {hasCoords && (
                        <button onClick={() => scrollToSection('location-section')} className="text-primary hover:underline text-sm ml-2 font-medium">
                          (Show on Map)
                        </button>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="icon" onClick={handleShare} className="ml-4">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Desktop price + stats bar */}
                <div className="hidden md:flex items-center justify-between p-6 bg-secondary rounded-lg mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{property.purpose === 'buy' ? 'Total Price' : 'Monthly Rent'}</p>
                    <p className="text-xl md:text-2xl font-bold text-primary">Rs. {formatPrice(property.price)}</p>
                  </div>
                  {property.bedrooms > 0 && (
                    <div className="flex gap-6">
                      {[
                        { Icon: Bed, val: property.bedrooms, label: 'Beds' },
                        { Icon: Bath, val: property.bathrooms, label: 'Baths' },
                        { Icon: Maximize, val: property.marla && property.marla > 0 ? property.marla : property.area, label: property.marla && property.marla > 0 ? 'marla' : 'sq ft' },
                      ].map(({ Icon, val, label }) => (
                        <div key={label} className="text-center">
                          <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-sm font-semibold">{val}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image slider */}
              <section>
                <div className="relative w-full group">
                  <div className="relative w-full h-[250px] md:h-[600px] overflow-hidden bg-secondary cursor-zoom-in">
                    {images.length > 0 && images[selectedImage] ? (
                      <div className="relative w-full h-full">
                        <img
                          src={images[selectedImage]}
                          alt={`${property.name} - Image ${selectedImage + 1}`}
                          className="w-full h-full object-cover transition-opacity duration-300"
                          onClick={() => setIsLightboxOpen(true)}
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            const ph = getPlaceholderImages(property.type)[selectedImage] || getPlaceholderImages(property.type)[0];
                            if (ph && t.src !== ph) t.src = ph;
                          }}
                        />
                        <div className="md:hidden absolute bottom-4 left-4 z-20">
                          <div className="bg-primary/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg shadow-xl font-bold text-lg border border-white/20">
                            Rs.{' '}
                            {property.price >= 10000000
                              ? `${(property.price / 10000000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} Crore`
                              : property.price >= 100000
                              ? `${(property.price / 100000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} Lac`
                              : formatPrice(property.price)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No image available</p>
                      </div>
                    )}

                    {images.length > 1 && (
                      <>
                        <Button variant="outline" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg opacity-50 lg:opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={() => setSelectedImage(p => (p - 1 + images.length) % images.length)}>
                          <ChevronLeft className="md:w-6 md:h-6 w-2 h-2" />
                        </Button>
                        <Button variant="outline" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg opacity-50 lg:opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={() => setSelectedImage(p => (p + 1) % images.length)}>
                          <ChevronRight className="md:w-6 md:h-6 w-2 h-2" />
                        </Button>
                        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-10">
                          {selectedImage + 1} / {images.length}
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                          {images.map((_, idx) => (
                            <button key={idx} onClick={() => setSelectedImage(idx)} aria-label={`Image ${idx + 1}`}
                              className={`w-2 h-2 rounded-full transition-all ${selectedImage === idx ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/75'}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {images.length > 1 && (
                    <div className="hidden md:flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                      {images.map((img, idx) => (
                        <div key={idx} onClick={() => setSelectedImage(idx)}
                          className={`shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                          <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-20 h-20 object-cover"
                            onError={(e) => { const t = e.target as HTMLImageElement; const ph = getPlaceholderImages(property.type)[idx] || getPlaceholderImages(property.type)[0]; if (ph && t.src !== ph) t.src = ph; }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Mobile: location row + stats bar + CTA buttons */}
              <div className="md:hidden flex flex-col space-y-3">
                <div className="px-4 flex items-center justify-between text-sm text-muted-foreground font-medium">
                  <div className="flex items-start min-w-0">
                    <MapPin className="w-4 h-4 mr-1 mt-0.5 shrink-0 text-primary" />
                    <span className="line-clamp-1">{toTitleCase(property.location)}{property.city ? `, ${toTitleCase(property.city)}` : ''}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleShare} className="-mr-2 text-primary hover:bg-primary/10">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>

                {property.bedrooms > 0 && (
                  <div className="flex items-center p-4 bg-secondary border-y">
                    <div className="flex gap-6 justify-around w-full">
                      <div className="flex items-center gap-1.5">
                        <Bed className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{property.bedrooms}</span>
                        <span className="text-[11px] text-muted-foreground tracking-wider">Beds</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bath className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{property.bathrooms}</span>
                        <span className="text-[11px] text-muted-foreground tracking-wider">Baths</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Maximize className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{property.marla && property.marla > 0 ? property.marla : property.area}</span>
                        <span className="text-[11px] text-muted-foreground tracking-wider">{property.marla && property.marla > 0 ? 'Marla' : 'Sq Ft'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex px-4 py-1" ref={contactButtonsRef}>
                  <div className="flex space-x-3 w-full">
                    <Button className="flex-1 bg-[#25D366] rounded-sm hover:bg-[#128C7E] text-white border-none shadow-sm" size="lg" onClick={() => window.open(waLink(), '_blank')}>
                      <WaIcon /> WhatsApp
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-sm border-primary text-primary hover:bg-primary/5 shadow-sm" size="lg" asChild>
                      <a href={`tel:${property.contactNumber}`}><Phone className="w-4 h-4 mr-2" />Call</a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sticky section nav */}
              <div className="sticky top-16 md:top-20 z-30 bg-black/80 backdrop-blur-sm border-b -mx-4 px-4 md:mx-0 md:px-0 transition-all">
                <div ref={tabsRef} className="flex gap-4 overflow-x-auto scrollbar-hide">
                  {[
                    { id: 'overview-section', label: 'Overview' },
                    { id: 'description-section', label: 'Description' },
                    { id: 'features-section', label: 'Features & Amenities' },
                    ...(property.videoUrl ? [{ id: 'video-section', label: 'Video' }] : []),
                    { id: 'location-section', label: 'Location' },
                  ].map((tab) => (
                    <button key={tab.id} data-section={tab.id} onClick={() => scrollToSection(tab.id)}
                      className={`py-3 px-1 text-sm text-white whitespace-nowrap font-semibold transition-all border-b-2 ${activeSection === tab.id ? 'border-white' : 'border-transparent text-muted-foreground hover:text-gray-200 hover:border-primary/50'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overview */}
              <Card id="overview-section" className="scroll-mt-32">
                <CardContent className="p-4 md:p-6">
                  <h2 className="text-xl font-bold mb-6">Details & Overview</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {[
                      { Icon: House, label: 'Type', val: property.type },
                      { Icon: Tag, label: 'Price', val: `Rs. ${formatPrice(property.price)}`, primary: true },
                      { Icon: Maximize, label: 'Area', val: property.marla && property.marla > 0 ? `${property.marla} Marla` : `${property.area} Sq Ft` },
                      { Icon: LayoutDashboard, label: 'Purpose', val: property.purpose === 'buy' ? 'For Sale' : 'For Rent' },
                      { Icon: Bed, label: 'Bedrooms', val: String(property.bedrooms) },
                      { Icon: Bath, label: 'Bathrooms', val: String(property.bathrooms) },
                      { Icon: Clock, label: 'Added', val: getTimeAgo(backendProperty?.createdAt) },
                      { Icon: MapPin, label: 'Location', val: toTitleCase(property.location), clamp: true },
                    ].map(({ Icon, label, val, primary, clamp }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0"><Icon className="w-5 h-5" /></div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase font-medium">{label}</p>
                          <p className={`font-semibold ${primary ? 'text-primary' : ''} ${clamp ? 'line-clamp-1' : ''}`}>{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <Card id="description-section" className="scroll-mt-32">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Description</h2>
                  <div className={`overflow-hidden transition-all duration-300 ${!isDescriptionExpanded ? 'max-h-[150px] relative' : 'max-h-full'}`}>
                    <div className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: property.description || `This beautiful ${property.type.toLowerCase()} is located in ${toTitleCase(property.location)}, ${toTitleCase(property.city)}.` }} />
                    {!isDescriptionExpanded && <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-4 text-primary font-semibold hover:bg-primary/5 p-0 h-auto" onClick={() => setIsDescriptionExpanded(v => !v)}>
                    {isDescriptionExpanded ? 'Read Less' : 'Read More'}
                  </Button>
                </CardContent>
              </Card>

              {/* Features */}
              <Card id="features-section" className="scroll-mt-32">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Features & Amenities</h2>
                  {backendProperty?.features && backendProperty.features.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {backendProperty.features.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No features listed for this property.</p>
                  )}
                </CardContent>
              </Card>

              {/* Video */}
              {property.videoUrl && (
                <Card id="video-section" className="scroll-mt-32">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold mb-4">Property Video</h2>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary">
                      {(() => {
                        const url = property.videoUrl || '';
                        let videoId = '';
                        if (url.includes('v=')) videoId = url.split('v=')[1]?.split('&')[0] || '';
                        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
                        else videoId = url.split('/').pop() || '';
                        return (
                          <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="Property Video"
                            frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen className="absolute inset-0" />
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Location ─────────────────────────────────────────────
                  resolvedLat / resolvedLng are taken from backendProperty
                  first (most reliable) then fall back to mapped property.
                  This ensures the map shows even when the mapping utility
                  does not copy lat/lng to the frontend Property type.
              ────────────────────────────────────────────────────────── */}
              <Card id="location-section" className="scroll-mt-32">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Location</h2>
                  {hasCoords ? (
                    <div className="space-y-4">
                      <PropertyMap
                        latitude={resolvedLat!}
                        longitude={resolvedLng!}
                        title={property.name}
                      />
                      <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                        <MapPin className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">{toTitleCase(property.location)}</p>
                          <p className="text-xs text-muted-foreground">{toTitleCase(property.city)}, Pakistan</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-secondary rounded-lg p-8 text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-3 text-primary" />
                      <p className="text-lg font-semibold mb-1">{toTitleCase(property.location)}</p>
                      <p className="text-muted-foreground">{toTitleCase(property.city)}, Pakistan</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <Card>
                  <CardContent className="p-6 hidden md:block">
                    <h3 className="text-lg font-bold mb-4">Contact Agent</h3>
                    <div className="space-y-3 mb-6">
                      <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none" size="lg" onClick={() => window.open(waLink(), '_blank')}>
                        <WaIcon /> WhatsApp Inquiry
                      </Button>
                      <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" size="lg" asChild>
                        <a href={`tel:${property.contactNumber}`}><Phone className="w-4 h-4 mr-2" />Call: {property.contactNumber}</a>
                      </Button>
                    </div>
                    <div className="pt-6 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-3">Schedule a visit</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-3">Property Details</h3>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: 'Property ID', val: property.id },
                        { label: 'Type', val: property.type },
                        { label: 'Purpose', val: property.purpose === 'buy' ? 'For Sale' : 'For Rent' },
                        { label: 'City', val: toTitleCase(property.city) },
                        ...(property.areaName ? [{ label: 'Area', val: toTitleCase(property.areaName) }] : []),
                        { label: 'Location', val: toTitleCase(property.location) },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}:</span>
                          <span className="font-semibold">{val}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* ── Similar Properties ───────────────────────────────────── */}
          {[
            {
              list: relatedByArea, show: relatedByArea.length > 0,
              title: `Similar ${toTitleCase(property.type)}s around ${toTitleCase(property.location)}`,
              onViewAll: () => router.push(`/properties/${property.purpose === 'buy' ? 'sale' : 'rent'}/${property.city.toLowerCase()}/${property.areaSlug ?? ''}`),
            },
            {
              list: relatedByOwner, show: relatedByOwner.length > 0,
              title: `More properties by ${backendProperty?.owner?.name || 'this Agency'}`,
              onViewAll: null,
            },
            {
              list: relatedByCity, show: relatedByCity.length > 0,
              title: `Similar ${toTitleCase(property.type)}s in ${toTitleCase(property.city)}`,
              onViewAll: () => router.push(`/properties/${backendProperty?.listingType}/${property.citySlug || property.city.toLowerCase()}`),
            },
          ].map(({ list, show, title, onViewAll }) =>
            show ? (
              <section key={title} className="pt-10 border-t max-w-full overflow-x-hidden">
                <div className="flex items-center justify-between mb-5 px-4 md:px-0">
                  <h2 className="text-lg md:text-2xl font-bold">{title}</h2>
                  {onViewAll && (
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 shrink-0 ml-2 text-xs font-semibold" onClick={onViewAll}>
                      View All
                    </Button>
                  )}
                </div>
                <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x px-4 md:px-0">
                  {list.map((item) => (
                    <RelatedPropertyCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null
          )}
        </div>
      </div>

      {/* Contact Form Modal */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Contact Agent</DialogTitle></DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <Input placeholder="Your Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            <Input type="email" placeholder="Your Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
            <Input type="tel" placeholder="Your Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
            <Textarea placeholder="Your Message" value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} rows={4} required />
            <Button type="submit" className="w-full">Send Message</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sticky Mobile Contact Bar */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${showStickyContact ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="grid grid-cols-2 gap-3 p-4">
          <Button variant="outline" className="w-full flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary/5 h-12" asChild>
            <a href={`tel:${property.contactNumber}`}><Phone className="w-4 h-4" />Call</a>
          </Button>
          <Button className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none h-12 font-semibold" onClick={() => window.open(waLink(), '_blank')}>
            <WaIcon /> WhatsApp
          </Button>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent showCloseButton={false} className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/98 border-none flex flex-col items-center justify-center rounded-none overflow-hidden sm:max-w-[100vw] z-[9999]">
          <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent z-50">
            <span className="text-white font-medium">{selectedImage + 1} / {images.length}</span>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-10 w-10" onClick={() => setIsLightboxOpen(false)}>
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center" ref={emblaRef}>
            <div className="flex h-full w-full">
              {images.map((img, idx) => (
                <div key={idx} className="flex-[0_0_100%] min-w-0 relative h-full flex items-center justify-center p-2 md:p-12">
                  <img src={img} alt={`${property.name} - Full Image ${idx + 1}`} className="w-full max-h-full object-contain select-none" onClick={e => e.stopPropagation()}
                    onError={(e) => { const t = e.target as HTMLImageElement; const ph = getPlaceholderImages(property.type)[idx] || getPlaceholderImages(property.type)[0]; if (ph && t.src !== ph) t.src = ph; }} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                <Button variant="ghost" size="icon" className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-50 rounded-full border border-white/20 h-14 w-14" onClick={e => { e.stopPropagation(); emblaApi?.scrollPrev(); }}>
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-50 rounded-full border border-white/20 h-14 w-14" onClick={e => { e.stopPropagation(); emblaApi?.scrollNext(); }}>
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="w-full bg-black/90 p-4 pb-8 z-20">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-2">
                {images.map((img, idx) => (
                  <div key={idx} onClick={e => { e.stopPropagation(); emblaApi?.scrollTo(idx); }}
                    className={`shrink-0 cursor-pointer rounded-sm overflow-hidden border-2 transition-all w-20 h-14 ${selectedImage === idx ? 'border-primary ring-1 ring-primary' : 'border-white/10 opacity-40 hover:opacity-100'}`}>
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover"
                      onError={(e) => { const t = e.target as HTMLImageElement; const ph = getPlaceholderImages(property.type)[idx] || getPlaceholderImages(property.type)[0]; if (ph && t.src !== ph) t.src = ph; }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetail;