 'use client'
import { useRouter } from 'next/navigation';
import { MapPin, Bed, Bath, Maximize, Play, Phone } from 'lucide-react';
import { Property } from '@/lib/data';
import { toTitleCase } from '@/lib/utils';

interface PropertyCardProps {
  property: Property;
  hideActions?: boolean;
}

const PropertyCard = ({ property, hideActions = false }: PropertyCardProps) => {
  const router = useRouter();

  const formatPrice = (price: number) => {
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Crore`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} Lakh`;
    return price.toLocaleString('en-PK');
  };

  const getPlaceholderImage = (type: string) => {
    const images: { [key: string]: string } = {
      'House': 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
      'Apartment': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
      'Villa': 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      'Plot': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
      'Commercial': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
      'Farm House': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    };
    return images[type] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80';
  };

  const fallbackImage = getPlaceholderImage(property.type);
  const imageUrl = (property.image && property.image.trim() !== '') ? property.image : fallbackImage;

  const whatsappNumber = property.whatsappNumber || property.contactNumber || '';
  const phoneNumber = property.contactNumber || property.whatsappNumber || '';

  const handleCardClick = () => {
    router.push(`/properties/${property.slug}`);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (whatsappNumber) {
      window.open(`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`, '_blank');
    } else {
      alert(`WhatsApp: ${property.name}`);
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    } else {
      alert(`Call: ${property.name}`);
    }
  };

  return (
    <>
      {/* ════════════════════════════════════════
          MOBILE
      ════════════════════════════════════════ */}
      <div
        className="md:hidden cursor-pointer bg-card rounded-xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 flex flex-col"
        onClick={handleCardClick}
      >
        {/* Image on top when hideActions */}
        {hideActions ? (
          <>
            <div className="relative w-full overflow-hidden bg-secondary" style={{ height: '110px' }}>
              <img
                src={imageUrl}
                alt={property.name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
              />
              <div className="absolute top-1.5 left-1.5">
                <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded">
                  {property.purpose === 'buy' ? 'For Sale' : 'For Rent'}
                </span>
              </div>
            </div>
            <div className="flex flex-col p-2 gap-1">
              <p className="text-xs font-bold text-primary leading-tight">
                PKR {formatPrice(property.price)}
              </p>
              <h3 className="text-[11px] font-semibold text-foreground line-clamp-2 leading-tight">
                {property.name}
              </h3>
              <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
                <span className="line-clamp-1">{toTitleCase(property.location)}, {toTitleCase(property.city)}</span>
              </div>
              {property.bedrooms > 0 && (
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Bed className="w-3 h-3" />{property.bedrooms}</span>
                  <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{property.bathrooms}</span>
                  <span className="flex items-center gap-0.5">
                    <Maximize className="w-3 h-3" />
                    {property.marla && property.marla > 0 ? `${property.marla}M` : `${property.area}sqft`}
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Top row: image + details */}
            <div className="flex flex-row" style={{ height: '110px' }}>
              {/* Image */}
              <div className="relative shrink-0 overflow-hidden bg-secondary" style={{ width: '120px' }}>
                <img
                  src={imageUrl}
                  alt={property.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
                />
                <div className="absolute top-1.5 left-1.5">
                  <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded">
                    {property.purpose === 'buy' ? 'For Sale' : 'For Rent'}
                  </span>
                </div>
                {property.videoUrl && (
                  <div className="absolute bottom-1.5 left-1.5">
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">
                      <Play className="w-2 h-2 fill-current" /> Video
                    </span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-col flex-1 px-2.5 py-2 min-w-0 justify-between">
                <div>
                  <p className="text-sm font-bold text-primary leading-tight">
                    PKR {formatPrice(property.price)}
                  </p>
                  <h3 className="text-[11px] font-semibold text-foreground mt-0.5 line-clamp-2 leading-tight">
                    {property.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground text-[10px]">
                    <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
                    <span className="line-clamp-1">{property.location}, {toTitleCase(property.city)}</span>
                  </div>
                </div>
                {property.bedrooms > 0 && (
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Bed className="w-3 h-3" />{property.bedrooms}</span>
                    <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{property.bathrooms}</span>
                    <span className="flex items-center gap-0.5">
                      <Maximize className="w-3 h-3" />
                      {property.marla && property.marla > 0 ? `${property.marla}M` : `${property.area}sqft`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp + Call buttons — mobile */}
            <div className="flex border-t border-[#25D366]">
              <button
                onClick={handleCall}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors duration-200 border-r border-[#25D366]"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </button>
              <button
                onClick={handleWhatsApp}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════
          DESKTOP
      ════════════════════════════════════════ */}
      <div
        className="hidden md:flex flex-col cursor-pointer bg-card rounded-xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-lg transition-all duration-300"
        onClick={handleCardClick}
      >
        {/* Top row: image + details */}
        <div className="flex flex-row" style={{ height: '190px' }}>
          {/* Image */}
          <div className="relative shrink-0 overflow-hidden bg-secondary" style={{ width: '250px' }}>
            <img
              src={imageUrl}
              alt={property.name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
            />
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full shadow-md">
                {property.purpose === 'buy' ? 'For Sale' : 'For Rent'}
              </span>
              {property.videoUrl && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                  <Play className="w-3 h-3 fill-current" /> Video
                </span>
              )}
            </div>
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 bg-black/60 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                {property.type}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col flex-1 p-4 min-w-0 justify-between">
            <div>
              <p className="text-xl font-bold text-primary leading-tight">
                PKR {formatPrice(property.price)}
              </p>
              <h3 className="text-base font-semibold text-foreground mt-1 line-clamp-2 hover:text-primary transition-colors duration-200">
                {property.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground text-sm">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="line-clamp-1">{property.location}, {toTitleCase(property.city)}</span>
              </div>
            </div>

            <div>
              {property.bedrooms > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5"><Bed className="w-4 h-4 text-primary" />{property.bedrooms} Beds</span>
                  <span className="flex items-center gap-1.5"><Bath className="w-4 h-4 text-primary" />{property.bathrooms} Baths</span>
                  <span className="flex items-center gap-1.5">
                    <Maximize className="w-4 h-4 text-primary" />
                    {property.marla && property.marla > 0 ? `${property.marla} Marla` : `${property.area} sq ft`}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                {property.purpose === 'buy' ? 'Total Price' : 'Monthly Rent'}
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp + Call buttons — desktop (hidden if hideActions) */}
        {!hideActions && (
          <div className="flex border-t border-[#25D366]">
            <button
              onClick={handleCall}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors duration-200 border-r border-[#25D366]"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors duration-200"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default PropertyCard;