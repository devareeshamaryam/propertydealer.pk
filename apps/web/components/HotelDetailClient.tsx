'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, Star, Wifi, Coffee, Dumbbell, 
  Car, UtensilsCrossed, Sparkles, ArrowLeft,
  Calendar, Users, Phone, Mail, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Hotel } from '@/lib/data';
import Navbar from '@/components/NavBar';
import Footer from '@/components/Footer';

interface HotelDetailClientProps {
  hotel: Hotel;
}

const amenityIcons: Record<string, any> = {
  WiFi: Wifi,
  Pool: Sparkles,
  Spa: Sparkles,
  Restaurant: UtensilsCrossed,
  Gym: Dumbbell,
  Parking: Car,
  'Business Center': Coffee,
  Bar: Coffee,
  Conference: Coffee,
  Lounge: Coffee,
};

const HotelDetailClient = ({ hotel }: HotelDetailClientProps) => {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-PK');
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const date1 = new Date(checkIn);
    const date2 = new Date(checkOut);
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalPrice = () => {
    const nights = calculateNights();
    return nights * hotel.price;
  };

  const handleBooking = () => {
    if (!checkIn || !checkOut) {
      alert('Please select check-in and check-out dates');
      return;
    }
    alert(`Booking Confirmed! 🎉

Hotel: ${hotel.name}
Check-in: ${new Date(checkIn).toLocaleDateString()}
Check-out: ${new Date(checkOut).toLocaleDateString()}
Guests: ${guests}
Total Nights: ${calculateNights()}
Total Price: Rs. ${formatPrice(totalPrice())}

Thank you for booking with us!`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 md:pt-24">
        {/* Back Button */}
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center gap-2 hover:gap-3 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hotels
          </Button>
        </div>

        {/* Hero Image Section */}
        <div className="container mx-auto px-4 mb-8">
          <div className="relative overflow-hidden rounded-2xl aspect-[21/9] max-h-[500px] shadow-2xl">
            <img
              src={hotel.image}
              alt={hotel.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-semibold rounded-full shadow-lg">
                  <Star className="w-5 h-5 fill-current" />
                  {hotel.rating} Rating
                </div>
                <div className="px-4 py-2 bg-white/90 backdrop-blur-sm text-foreground font-medium rounded-full shadow-lg">
                  {hotel.rooms} Rooms Available
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 pb-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Hotel Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hotel Header */}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                  {hotel.name}
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="text-lg">{hotel.location}, {hotel.city}, Pakistan</span>
                </div>
              </div>

              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">Free Cancellation</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Instant Confirmation</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">Best Price Guarantee</span>
                </div>
              </div>

              {/* Description */}
              <Card className="p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary" />
                  About This Hotel
                </h2>
                <p className="text-muted-foreground leading-relaxed text-base mb-4">
                  {hotel.description}
                </p>
                <p className="text-muted-foreground leading-relaxed text-base">
                  Experience world-class hospitality with premium amenities and exceptional service. 
                  Our hotel offers the perfect blend of comfort and luxury, ensuring your stay is 
                  memorable and relaxing. Whether you're here for business or leisure, we have 
                  everything you need for a perfect getaway.
                </p>
                <div className="mt-6 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="font-medium">{hotel.rooms} Rooms</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="w-5 h-5 text-amber-500 fill-current" />
                    <span className="font-medium">{hotel.rating} Star Rating</span>
                  </div>
                </div>
              </Card>

              {/* Amenities */}
              <Card className="p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary" />
                  Amenities & Facilities
                </h2>
                <p className="text-muted-foreground mb-6">
                  Enjoy premium facilities designed for your comfort and convenience
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hotel.amenities.map((amenity) => {
                    const Icon = amenityIcons[amenity] || Sparkles;
                    return (
                      <div
                        key={amenity}
                        className="flex items-center gap-3 p-4 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Hotel Policies */}
              <Card className="p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Hotel Policies
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Check-in Time</p>
                      <p className="text-sm text-muted-foreground">After 2:00 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Check-out Time</p>
                      <p className="text-sm text-muted-foreground">Before 12:00 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Cancellation Policy</p>
                      <p className="text-sm text-muted-foreground">Free cancellation up to 24 hours before check-in</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Pets</p>
                      <p className="text-sm text-muted-foreground">Contact hotel for pet policy</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Location */}
              <Card className="p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-primary" />
                  Location
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{hotel.name}</p>
                      <p className="text-muted-foreground">{hotel.location}, {hotel.city}</p>
                      <p className="text-sm text-muted-foreground mt-1">Pakistan</p>
                    </div>
                  </div>
                  
                  {/* Map placeholder with better styling */}
                  <div className="w-full h-80 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border">
                    <MapPin className="w-12 h-12 text-primary mb-3" />
                    <p className="text-lg font-medium text-foreground">{hotel.city}, Pakistan</p>
                    <p className="text-sm text-muted-foreground mt-1">Interactive map view</p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h3 className="font-medium text-foreground mb-2">Nearby Attractions</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• City Center - 2 km</li>
                      <li>• Airport - 15 km</li>
                      <li>• Shopping Mall - 1.5 km</li>
                      <li>• Historical Sites - 3 km</li>
                    </ul>
                  </div>
                </div>
              </Card>

              {/* Contact Information */}
              <Card className="p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Contact Information
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-foreground font-medium">+92 300 1234567</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-foreground font-medium">info@{hotel.name.toLowerCase().replace(/\s+/g, '')}.com</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column - Booking Card (Sticky) */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-24 shadow-xl border-2">
                <div className="mb-6 pb-6 border-b border-border">
                  <p className="text-sm text-muted-foreground mb-1">Starting from</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-primary">
                      Rs. {formatPrice(hotel.price)}
                    </p>
                    <span className="text-sm text-muted-foreground">/night</span>
                  </div>
                  {calculateNights() > 0 && (
                    <div className="mt-3 p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total for {calculateNights()} nights</p>
                      <p className="text-xl font-bold text-primary">Rs. {formatPrice(totalPrice())}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Check-in */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Check-in Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>

                  {/* Check-out */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Check-out Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || new Date().toISOString().split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>

                  {/* Guests */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Number of Guests
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <select
                        value={guests}
                        onChange={(e) => setGuests(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer transition-all"
                      >
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'Guest' : 'Guests'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                   <p className="text-xs text-muted-foreground text-center pt-2">
                    ✓ Free cancellation • ✓ Instant confirmation
                  </p>
                </div>

                {/* Features */}
                <div className="mt-6 pt-6 border-t border-border space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Star className="w-4 h-4 text-amber-500 fill-current" />
                    </div>
                    <span className="text-muted-foreground">{hotel.rating} Star Rating</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-muted-foreground">Premium Facilities</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-muted-foreground">Best Price Guarantee</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HotelDetailClient;