 'use client'
import { useRouter } from 'next/navigation';
import { MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hotel } from '@/lib/data';

interface HotelCardProps {
  hotel: Hotel;
}

const HotelCard = ({ hotel }: HotelCardProps) => {
  const router = useRouter();

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-PK');
  };

  const handleViewDetails = () => {
    router.push(`/hotels/${hotel.id}`);
  };

  const handleCardClick = () => {
    router.push(`/hotels/${hotel.id}`);
  };

  return (
    <div 
      className="property-card group cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative overflow-hidden aspect-[4/3]">
        <img
          src={hotel.image}
          alt={hotel.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex items-center gap-1 px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
          <Star className="w-3 h-3 fill-current" />
          {hotel.rating}
        </div>
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium rounded-full">
            {hotel.rooms} Rooms
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors">
          {hotel.name}
        </h3>

        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <MapPin className="w-4 h-4 text-primary" />
          <span>{hotel.location}, {hotel.city}</span>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {hotel.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {hotel.amenities.slice(0, 3).map((amenity) => (
            <span
              key={amenity}
              className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md"
            >
              {amenity}
            </span>
          ))}
          {hotel.amenities.length > 3 && (
            <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md">
              +{hotel.amenities.length - 3} more
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Price per night</p>
            <p className="text-lg font-bold text-primary">
              Rs. {formatPrice(hotel.price)}
            </p>
          </div>
          <Button 
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Prevents card click when button is clicked
              handleViewDetails();
            }}
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HotelCard;