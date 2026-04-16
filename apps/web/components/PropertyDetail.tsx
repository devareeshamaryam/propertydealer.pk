 /* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MapPin, Bed, Bath, Maximize, Share2, Heart, Phone, Mail, Calendar, CheckCircle2, X, Loader2, ChevronLeft, ChevronRight, MessageSquare, ArrowLeft, House, Tag, LayoutDashboard, Clock } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import PropertyCard from '@/components/PropertyCard';
import { toLowerCase } from 'zod';
import useEmblaCarousel from 'embla-carousel-react';

const PropertyMap = dynamic(() => import('@/components/PropertyMap'), {
  ssr: false,
  loading: () => <div className="h-[350px] w-full bg-secondary animate-pulse rounded-xl flex items-center justify-center text-muted-foreground">Loading Map...</div>
});

const PropertyDetail = ({ slug, initialProperty }: { slug?: string, initialProperty?: BackendProperty | null }) => {
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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    features: []
  });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview-section');
  const [relatedByArea, setRelatedByArea] = useState<Property[]>([]);
  const [relatedByCity, setRelatedByCity] = useState<Property[]>([]);
  const [relatedByOwner, setRelatedByOwner] = useState<Property[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showStickyContact, setShowStickyContact] = useState(false);
  const contactButtonsRef = useRef<HTMLDivElement>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 25 });

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours} hours ago`;

      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 30) return `${diffInDays} days ago`;

      const diffInMonths = Math.floor(diffInDays / 30);
      if (diffInMonths === 1) return '1 month ago';
      return `${diffInMonths} months ago`;
    } catch (e) {
      return 'Recently';
    }
  };

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-section="${activeSection}"]`) as HTMLElement;
      if (activeTab) {
        activeTab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeSection]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-120px 0px -50% 0px' }
    );

    const sections = ['overview-section', 'description-section', 'features-section', 'video-section', 'location-section'];
    const timeout = setTimeout(() => {
      sections.forEach((id) => {
        const element = document.getElementById(id);
        if (element) observer.observe(element);
      });
    }, 100);

    const contactObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setShowStickyContact(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );

    if (contactButtonsRef.current) {
      contactObserver.observe(contactButtonsRef.current);
    }

    return () => {
      clearTimeout(timeout);
      sections.forEach((id) => {
        const element = document.getElementById(id);
        if (element) observer.unobserve(element);
      });
      contactObserver.disconnect();
    };
  }, [property]);

  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setSelectedImage(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (isLightboxOpen && emblaApi) {
      emblaApi.scrollTo(selectedImage);
    }
  }, [isLightboxOpen, emblaApi, selectedImage]);

  useEffect(() => {
    const fetchRelatedProperties = async () => {
      if (!property) return;
      try {
        setLoadingRelated(true);

        const areaData = await propertyApi.getAll({
          cityName: property.city,
          search: property.location,
          type: backendProperty?.propertyType,
          purpose: backendProperty?.listingType,
          limit: 12
        });
        const areaProperties = Array.isArray(areaData) ? areaData : areaData.properties;
        setRelatedByArea(
          areaProperties
            .map(p => mapBackendToFrontendProperty(p))
            .filter(p => p.slug !== resolvedSlug)
        );

        const cityData = await propertyApi.getAll({
          cityName: property.city,
          type: backendProperty?.propertyType,
          purpose: backendProperty?.listingType,
          limit: 15
        });
        const cityProperties = Array.isArray(cityData) ? cityData : cityData.properties;
        setRelatedByCity(
          cityProperties
            .map(p => mapBackendToFrontendProperty(p))
            .filter(p =>
              p.slug !== resolvedSlug &&
              !areaProperties.some(ap => ap.slug === p.slug)
            )
        );

        if (backendProperty?.owner?._id) {
          const ownerData = await propertyApi.getAll({
            ownerId: backendProperty.owner._id,
            limit: 12
          } as any);
          const ownerProperties = Array.isArray(ownerData) ? ownerData : ownerData.properties;
          setRelatedByOwner(
            ownerProperties
              .map(p => mapBackendToFrontendProperty(p))
              .filter(p => p.slug !== resolvedSlug)
          );
        }
      } catch (err) {
        console.error('Error fetching related properties:', err);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelatedProperties();
  }, [property, resolvedSlug]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
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
        const mappedProperty = mapBackendToFrontendProperty(backendData);
        setProperty(mappedProperty);
        setBackendProperty(backendData);
      } catch (err: any) {
        console.error('Error fetching property:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load property';
        setError(errorMessage);
        toast.error('Error', {
          description: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    };

    if (initialProperty && (initialProperty.slug === resolvedSlug || initialProperty._id === resolvedSlug)) {
      setLoading(false);
      return;
    }

    if (!resolvedSlug) {
      setError('Property slug is missing');
      setLoading(false);
      return;
    }

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

  const getImages = (): string[] => {
    if (!property) return getPlaceholderImages('House');

    const getImageUrl = (url?: string): string | null => {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.startsWith('/uploads/')) {
        return url;
      }
      return null;
    };

    const validImages: string[] = [];

    if (backendProperty) {
      const mainPhotoUrl = getImageUrl(backendProperty.mainPhotoUrl);
      if (mainPhotoUrl) {
        validImages.push(mainPhotoUrl);
      }
    }

    if (backendProperty?.additionalPhotosUrls) {
      backendProperty.additionalPhotosUrls.forEach(url => {
        const imageUrl = getImageUrl(url);
        if (imageUrl) {
          validImages.push(imageUrl);
        }
      });
    }

    return validImages.length > 0 ? validImages : getPlaceholderImages(property.type);
  };

  const getPlaceholderImages = (type: string): string[] => {
    const imagesByType: { [key: string]: string[] } = {
      'House': [
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80',
        'https://images.unsplash.com/photo-1598228723793-52759bba239c?w=1200&q=80'
      ],
      'Apartment': [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
        'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=1200&q=80'
      ],
      'Villa': [
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
        'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=1200&q=80'
      ],
      'Plot': [
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80'
      ],
      'Commercial': [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80',
        'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80'
      ],
      'Farm House': [
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
        'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80',
        'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=1200&q=80',
        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80'
      ]
    };
    return imagesByType[type] || imagesByType['House'] || [];
  };

  const images = getImages();
  const formatPrice = (price: number) => price.toLocaleString('en-PK');

  const nextImage = () => {
    setSelectedImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Contact form submitted! In production, this would send to your backend.');
    setShowContactForm(false);
    setFormData({ name: '', email: '', phone: '', message: '', features: [] });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: property.name,
        text: `Check out this property: ${property.name}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const features = [
    'Electricity Backup',
    'Waste Disposal',
    'Flooring',
    'Elevators',
    'Service Elevators Lifts',
    'Parking Spaces',
    'Security Staff',
    'CCTV Security',
    'Lawn or Garden',
    'Nearby Schools',
    'Nearby Hospitals',
    'Nearby Shopping Malls',
    'Nearby Restaurants',
    'Distance From Airport',
    'Nearby Public Transport',
    'Other Nearby Places'
  ];

  const getSchemaType = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'house': return 'SingleFamilyResidence';
      case 'apartment':
      case 'flat': return 'Apartment';
      case 'plot':
      case 'land': return 'Landform';
      case 'shop':
      case 'commercial':
      case 'office':
      case 'factory': return 'Place';
      case 'hotel': return 'Hotel';
      case 'restaurant': return 'Restaurant';
      default: return 'Accommodation';
    }
  };

  const jsonLd = property ? {
    '@context': 'https://schema.org',
    '@type': getSchemaType(property.type),
    'name': property.name,
    'description': property.description
      ? property.description.replace(/<[^>]*>?/gm, '').substring(0, 300).trim() + '...'
      : `${property.name} in ${toTitleCase(property.location)}, ${toTitleCase(property.city)}`,
    'image': images,
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': toTitleCase(property.city),
      'addressRegion': toTitleCase(property.location),
      'addressCountry': 'PK'
    },
    ...(property.bedrooms && property.bedrooms > 0 ? { 'numberOfBedrooms': property.bedrooms } : {}),
    ...(property.bathrooms && property.bathrooms > 0 ? { 'numberOfBathrooms': property.bathrooms } : {}),
    'floorSize': {
      '@type': 'QuantitativeValue',
      'value': property.area,
      'unitCode': 'SQF'
    },
    'offers': {
      '@type': 'Offer',
      'price': property.price,
      'priceCurrency': 'PKR',
      'businessFunction': property.purpose === 'buy' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
      'availability': 'https://schema.org/InStock',
      'url': typeof window !== 'undefined' ? window.location.href : ''
    }
  } : null;

  return (
    <div className="min-h-screen bg-background max-w-full">
      {isMounted && jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="pt-4 md:pt-24">
        <div className="container mx-auto md:px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title and Excerpt Section */}
              <div>
                <div className="flex hidden md:flex items-start justify-between mb-4">
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
                      <MapPin className="w-5 h-5 text-primary" />
                      <span className="text-lg">
                        {toTitleCase(property.areaName || property.location)}
                        {property.city && property.city.toLowerCase() !== (property.areaName || property.location).toLowerCase()
                          ? `, ${toTitleCase(property.city)}`
                          : ''}
                      </span>

                      {property.latitude && property.longitude && (
                        <button
                          onClick={() => scrollToSection('location-section')}
                          className="text-primary hover:underline text-sm ml-2 font-medium"
                        >
                          (Show on Map)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="icon" onClick={handleShare}>
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Price and Stats */}
                <div className="flex hidden md:flex items-center justify-between p-6 bg-secondary rounded-lg mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {property.purpose === 'buy' ? 'Total Price' : 'Monthly Rent'}
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-primary">
                      Rs. {formatPrice(property.price)}
                    </p>
                  </div>
                  {property.bedrooms > 0 && (
                    <div className="flex gap-6">
                      <div className="text-center">
                        <Bed className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-semibold">{property.bedrooms}</p>
                        <p className="text-xs text-muted-foreground"> Beds</p>
                      </div>
                      <div className="text-center">
                        <Bath className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-semibold">{property.bathrooms}</p>
                        <p className="text-xs text-muted-foreground">Baths</p>
                      </div>
                      <div className="text-center">
                        <Maximize className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-semibold">{property.marla && property.marla > 0 ? property.marla : property.area}</p>
                        <p className="text-xs text-muted-foreground">{property.marla && property.marla > 0 ? 'marla' : 'sq ft'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Slider Section */}
              <section>
                <div className="relative w-full group">
                  <div
                    className="relative w-full h-[250px] md:h-[600px] overflow-hidden bg-secondary cursor-zoom-in"
                  >
                    {images.length > 0 && images[selectedImage] ? (
                      <div className="relative w-full h-full">
                        <img
                          src={images[selectedImage]}
                          alt={`${property.name} - Image ${selectedImage + 1}`}
                          className="w-full h-full object-cover transition-opacity duration-300"
                          onClick={() => setIsLightboxOpen(true)}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const placeholder = getPlaceholderImages(property.type)[selectedImage] || getPlaceholderImages(property.type)[0];
                            if (placeholder && target.src !== placeholder) {
                              target.src = placeholder;
                            }
                          }}
                        />
                        {/* Price Overlay - Mobile Only */}
                        <div className="md:hidden absolute bottom-4 left-4 z-20">
                          <div className="bg-primary/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg shadow-xl font-bold text-lg border border-white/20">
                            Rs. {property.price >= 10000000
                              ? `${(property.price / 10000000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} Crore`
                              : property.price >= 100000
                                ? `${(property.price / 100000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} Lac`
                                : formatPrice(property.price)
                            }
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No image available</p>
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    {images.length > 1 && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg ${isLightboxOpen ? 'opacity-0' : 'opacity-50 lg:opacity-0 group-hover:opacity-100 transition-opacity z-10'}`}
                          onClick={prevImage}
                        >
                          <ChevronLeft className="md:w-6 md:h-6 w-2 h-2" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg ${isLightboxOpen ? 'opacity-0' : 'opacity-50 lg:opacity-0 group-hover:opacity-100 transition-opacity z-10'}`}
                          onClick={nextImage}
                        >
                          <ChevronRight className="md:w-6 md:h-6 w-2 h-2" />
                        </Button>
                      </>
                    )}

                    {/* Image Counter */}
                    {images.length > 1 && (
                      <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-10">
                        {selectedImage + 1} / {images.length}
                      </div>
                    )}

                    {/* Thumbnail Indicators */}
                    {images.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedImage(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${selectedImage === idx
                              ? 'bg-white w-8'
                              : 'bg-white/50 hover:bg-white/75'
                              }`}
                            aria-label={`Go to image ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Thumbnail Strip */}
                  {images.length > 1 && (
                    <div className="flex hidden md:flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedImage(idx)}
                          className={`shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedImage === idx
                            ? 'border-primary ring-2 ring-primary ring-offset-2'
                            : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                        >
                          <img
                            src={img}
                            alt={`Thumbnail ${idx + 1}`}
                            className="w-20 h-20 object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const placeholder = getPlaceholderImages(property.type)[idx] || getPlaceholderImages(property.type)[0];
                              if (placeholder && target.src !== placeholder) {
                                target.src = placeholder;
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Mobile call/whatsapp buttons */}
              <div className="md:hidden flex flex-col -mt-2 space-y-3">
                <div className="px-4 flex items-center justify-between font-medium text-sm text-muted-foreground">
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 mr-1 mt-0.5 shrink-0 text-primary" />
                    <div className="line-clamp-1">
                      {toTitleCase(property.location)}{property.city ? `, ${toTitleCase(property.city)}` : ''}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleShare} className="-mr-2 text-primary hover:bg-primary/10">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary rounded-none border-y">
                  {property.bedrooms > 0 && (
                    <div className="flex gap-4 md:gap-6 justify-around w-full">
                      <div className="text-center flex items-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bed className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">{property.bedrooms}</p>
                        </div>
                        <p className="text-[11px] tracking-wider text-muted-foreground">Beds</p>
                      </div>
                      <div className="text-center flex gap-2 items-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bath className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">{property.bathrooms}</p>
                        </div>
                        <p className="text-[11px] gap-2 tracking-wider text-muted-foreground">Baths</p>
                      </div>
                      <div className="text-center flex gap-2 items-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Maximize className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">{property.marla && property.marla > 0 ? property.marla : property.area}</p>
                        </div>
                        <p className="text-[11px] tracking-wider text-muted-foreground">
                          {property.marla && property.marla > 0 ? 'Marla' : 'Sq Ft'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex px-4 py-1" ref={contactButtonsRef}>
                  <div className="flex space-x-3 w-full">
                    <Button
                      className="flex-1 bg-[#25D366] rounded-sm hover:bg-[#128C7E] text-white border-none shadow-sm"
                      size="lg"
                      onClick={() => {
                        const message = encodeURIComponent(`I want to know more about this property: ${property.name}\nLink: ${window.location.href}`);
                        const waNumber = property.whatsappNumber || property.contactNumber || '923123456789';
                        const cleanNumber = waNumber.replace(/\D/g, '');
                        window.open(`https://wa.me/${cleanNumber.startsWith('92') ? cleanNumber : '92' + cleanNumber.replace(/^0/, '')}?text=${message}`, '_blank');
                      }}
                    >
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-sm border-primary text-primary hover:bg-primary/5 shadow-sm" size="lg" asChild>
                      <a href={`tel:${property.contactNumber}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sticky Navigation Bar */}
              <div className="sticky mx-1 max-w-full overflow-x-auto top-[64px] md:top-[80px] z-30 bg-black/80 backdrop-blur-sm border-b pb-0 mb-2 md:mb-6 pt-2 -mx-4 px-4 md:mx-0 md:px-0 transition-all">
                <div ref={tabsRef} className="flex gap-6 overflow-x-auto scrollbar-hide">
                  {[
                    { id: 'overview-section', label: 'Overview' },
                    { id: 'description-section', label: 'Description' },
                    { id: 'features-section', label: 'Features & Amenities' },
                    ...(property.videoUrl ? [{ id: 'video-section', label: 'Video' }] : []),
                    { id: 'location-section', label: 'Location' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      data-section={tab.id}
                      onClick={() => scrollToSection(tab.id)}
                      className={`md:pb-3 pb-2 text-white whitespace-nowrap font-semibold transition-all border-b-2 m-2 ${activeSection === tab.id
                        ? 'border-white text-white'
                        : 'border-transparent text-muted-foreground hover:text-gray-200 hover:border-primary/50'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overview Section */}
              <Card id="overview-section" className="scroll-mt-32">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Details & Overview</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <House className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Type</p>
                        <p className="font-semibold">{property.type}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Price</p>
                        <p className="font-semibold text-primary">Rs. {formatPrice(property.price)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Maximize className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Area</p>
                        <p className="font-semibold">
                          {property.marla && property.marla > 0 ? `${property.marla} Marla` : `${property.area} Sq Ft`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <LayoutDashboard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Purpose</p>
                        <p className="font-semibold">{property.purpose === 'buy' ? 'For Sale' : 'For Rent'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Bed className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Bedrooms</p>
                        <p className="font-semibold">{property.bedrooms}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Bath className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Bathrooms</p>
                        <p className="font-semibold">{property.bathrooms}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Added</p>
                        <p className="font-semibold">{getTimeAgo(backendProperty?.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Location</p>
                        <p className="font-semibold line-clamp-1">{toTitleCase(property.location)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <Card id="description-section" className="scroll-mt-32">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Description</h2>
                  <div className={`overflow-hidden transition-all duration-300 ${!isDescriptionExpanded ? 'max-h-[150px] relative' : 'max-h-full'}`}>
                    <div
                      className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: property.description || `This beautiful ${property.type.toLowerCase()} is located in the prime area of ${toTitleCase(property.location)}, ${toTitleCase(property.city)}.`
                      }}
                    />
                    {!isDescriptionExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4 text-primary font-semibold hover:bg-primary/5 p-0 h-auto"
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  >
                    {isDescriptionExpanded ? 'Read Less' : 'Read More'}
                  </Button>
                </CardContent>
              </Card>

              {/* Features */}
              <Card id="features-section" className="scroll-mt-32">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Features & Amenities</h2>
                  {backendProperty?.features && backendProperty.features.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
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

              {property.videoUrl && (
                <Card id="video-section" className="scroll-mt-32">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold mb-4">Property Video</h2>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary">
                      {(() => {
                        const url = property.videoUrl || '';
                        let videoId = '';
                        if (url.includes('v=')) {
                          videoId = url.split('v=')[1]?.split('&')[0] || '';
                        } else if (url.includes('youtu.be/')) {
                          videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
                        } else {
                          videoId = url.split('/').pop() || '';
                        }
                        return (
                          <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title="Property Video"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0"
                          />
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Location */}
              <Card id="location-section" className="scroll-mt-32">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Location</h2>
                  {property.latitude && property.longitude ? (
                    <div className="space-y-4">
                      <PropertyMap
                        latitude={property.latitude}
                        longitude={property.longitude}
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

            {/* Sidebar - Right Side */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <Card>
                  <CardContent className="p-6 hidden md:block">
                    <h3 className="text-lg font-bold mb-4">Contact Agent</h3>
                    <div className="space-y-3 mb-6">
                      <Button
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none"
                        size="lg"
                        onClick={() => {
                          const message = encodeURIComponent(`I want to know more about this property: ${property.name}\nLink: ${window.location.href}`);
                          const waNumber = property.whatsappNumber || property.contactNumber || '923123456789';
                          const cleanNumber = waNumber.replace(/\D/g, '');
                          window.open(`https://wa.me/${cleanNumber.startsWith('92') ? cleanNumber : '92' + cleanNumber.replace(/^0/, '')}?text=${message}`, '_blank');
                        }}
                      >
                        <svg className="w-5 h-5 mr-2 fill-current" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp Inquiry
                      </Button>
                      <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" size="lg" asChild>
                        <a href={`tel:${property.contactNumber}`}>
                          <Phone className="w-4 h-4 mr-2" />
                          Call: {property.contactNumber}
                        </a>
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Property ID:</span>
                        <span className="font-semibold">{property.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold">{property.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purpose:</span>
                        <span className="font-semibold">
                          {property.purpose === 'buy' ? 'For Sale' : 'For Rent'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">City:</span>
                        <span className="font-semibold">{toTitleCase(property.city)}</span>
                      </div>
                      {property.areaName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Area:</span>
                          <span className="font-semibold">{toTitleCase(property.areaName)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-semibold">{toTitleCase(property.location)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* ═══════════════════════ SIMILAR PROPERTIES ═══════════════════════ */}

          {/* Similar by Area */}
          {relatedByArea.length > 0 && (
            <section className="pt-10 border-t max-w-full overflow-x-hidden">
              <div className="flex items-center justify-between mb-5 px-4 md:px-0">
                <h2 className="text-lg md:text-2xl font-bold">
                  Similar {toTitleCase(property.type)}s around {toTitleCase(property.location)}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80 shrink-0 ml-2 text-xs font-semibold"
                  onClick={() => router.push(`/properties/${property.purpose === 'buy' ? 'sale' : 'rent'}/${property.city.toLowerCase()}/${property.areaSlug === undefined ? '' : property.areaSlug}`)}
                >
                  View All
                </Button>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-6 scrollbar-hide snap-x px-4 md:px-0">
                {relatedByArea.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-[47vw] max-w-[47vw] md:min-w-[300px] md:max-w-[300px] shrink-0 snap-start rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.10)] border border-gray-100 bg-white hover:shadow-[0_4px_24px_rgba(0,0,0,0.16)] transition-shadow duration-200"
                  >
                    <PropertyCard property={item} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Similar by Owner */}
          {relatedByOwner.length > 0 && (
            <section className="pt-10 border-t max-w-full overflow-x-hidden">
              <div className="flex items-center justify-between mb-5 px-4 md:px-0">
                <h2 className="text-lg md:text-2xl font-bold">
                  More properties by {backendProperty?.owner?.name || 'this Agency'}
                </h2>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-6 scrollbar-hide snap-x px-4 md:px-0">
                {relatedByOwner.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-[47vw] max-w-[47vw] md:min-w-[300px] md:max-w-[300px] shrink-0 snap-start rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.10)] border border-gray-100 bg-white hover:shadow-[0_4px_24px_rgba(0,0,0,0.16)] transition-shadow duration-200"
                  >
                    <PropertyCard property={item} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Similar by City */}
          {relatedByCity.length > 0 && (
            <section className="pt-10 border-t max-w-full overflow-x-hidden">
              <div className="flex items-center justify-between mb-5 px-4 md:px-0">
                <h2 className="text-lg md:text-2xl font-bold">
                  Similar {toTitleCase(property.type)}s in {toTitleCase(property.city)}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80 shrink-0 ml-2 text-xs font-semibold"
                  onClick={() => router.push(`/properties/${backendProperty?.listingType}/${property.citySlug || property.city.toLowerCase()}`)}
                >
                  View All
                </Button>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-6 scrollbar-hide snap-x px-4 md:px-0">
                {relatedByCity.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-[47vw] max-w-[47vw] md:min-w-[300px] md:max-w-[300px] shrink-0 snap-start rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.10)] border border-gray-100 bg-white hover:shadow-[0_4px_24px_rgba(0,0,0,0.16)] transition-shadow duration-200"
                  >
                    <PropertyCard property={item} />
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Contact Form Modal */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <Input
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Input
                type="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Input
                type="tel"
                placeholder="Your Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <Textarea
                placeholder="Your Message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sticky Mobile Contact Bar */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${showStickyContact ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="grid grid-cols-2 gap-3 p-4">
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary/5 h-12"
            asChild
          >
            <a href={`tel:${property.contactNumber}`}>
              <Phone className="w-4 h-4" />
              Call
            </a>
          </Button>
          <Button
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none h-12 font-semibold"
            onClick={() => {
              const message = encodeURIComponent(`I want to know more about this property: ${property.name}\nLink: ${window.location.href}`);
              const waNumber = property.whatsappNumber || property.contactNumber || '923123456789';
              const cleanNumber = waNumber.replace(/\D/g, '');
              window.open(`https://wa.me/${cleanNumber.startsWith('92') ? cleanNumber : '92' + cleanNumber.replace(/^0/, '')}?text=${message}`, '_blank');
            }}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Image Lightbox */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent showCloseButton={false} className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/98 border-none flex flex-col items-center justify-center rounded-none overflow-hidden sm:max-w-[100vw] z-[9999]">
          
          <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent z-50">
            <div className="text-white font-medium">
              {selectedImage + 1} / {images.length}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 rounded-full h-10 w-10 flex items-center justify-center"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center" ref={emblaRef}>
            <div className="flex h-full w-full">
              {images.map((img, idx) => (
                <div key={idx} className="flex-[0_0_100%] min-w-0 relative h-full flex items-center justify-center p-2 md:p-12">
                  <img
                    src={img}
                    alt={`${property.name} - Full Image ${idx + 1}`}
                    className="w-full max-h-full object-contain select-none"
                    onClick={(e) => e.stopPropagation()}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const placeholder = getPlaceholderImages(property.type)[idx] || getPlaceholderImages(property.type)[0];
                      if (placeholder && target.src !== placeholder) {
                        target.src = placeholder;
                      }
                    }}
                  />
                </div>
              ))}
            </div>

            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-50 rounded-full border border-white/20 h-14 w-14"
                  onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-50 rounded-full border border-white/20 h-14 w-14"
                  onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="w-full bg-black/90 p-4 pb-8 overflow-hidden z-20">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-start px-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); emblaApi?.scrollTo(idx); }}
                    className={`shrink-0 cursor-pointer rounded-sm overflow-hidden border-2 transition-all w-20 h-14 ${
                      selectedImage === idx
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-white/10 opacity-40 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const placeholder = getPlaceholderImages(property.type)[idx] || getPlaceholderImages(property.type)[0];
                        if (placeholder && target.src !== placeholder) {
                          target.src = placeholder;
                        }
                      }}
                    />
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