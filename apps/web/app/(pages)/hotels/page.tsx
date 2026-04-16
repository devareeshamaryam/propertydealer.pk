 'use client'
import { useState, useMemo } from 'react';
import { Hotel as HotelIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 //import Navbar from '@/components/NavBar';
//import Footer from '@/components/Footer';
import HotelCard from '@/components/HotelCard';
import { hotels, cities } from '@/lib/data';

const Hotels = () => {
  const [city, setCity] = useState('');

  const filteredHotels = useMemo(() => {
    if (!city || city === 'all') return hotels;
    return hotels.filter((hotel) => hotel.city === city);
  }, [city]);

  return (
    <div className="min-h-screen bg-background">
       
      {/* Hero Banner - Enhanced with Beautiful Animations */}
      <section className="pt-24 pb-8 md:pt-28 md:pb-12 bg-gradient-to-br from-secondary via-secondary/95 to-secondary/80 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Floating Hotel Icons */}
        <div className="absolute top-10 left-10 opacity-5 animate-bounce" style={{ animationDuration: '3s' }}>
          <HotelIcon className="w-16 h-16 text-primary" />
        </div>
        <div className="absolute bottom-10 right-20 opacity-5 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
          <HotelIcon className="w-12 h-12 text-primary" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 animate-in fade-in slide-in-from-bottom-6 duration-700">
            Premium <span className="text-primary bg-primary/10 px-3 py-1 rounded-lg inline-block animate-in fade-in zoom-in duration-700 delay-300 shadow-lg shadow-primary/20">Hotels</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            Book the best hotels across Pakistan at competitive rates
          </p>
        </div>
      </section>

      {/* Filters - Enhanced with Smooth Transitions */}
      <section className="py-6 border-b border-border bg-background/95 backdrop-blur-lg sticky top-16 md:top-20 z-40 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Filter by City:
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-[180px] transition-all duration-300 hover:border-primary/50 hover:shadow-md hover:scale-105 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="transition-colors duration-200 hover:bg-primary/10">
                  All Cities
                </SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c} className="transition-colors duration-200 hover:bg-primary/10">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Animated Results Counter */}
            {city && city !== 'all' && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full animate-in fade-in zoom-in duration-300">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                <span className="text-sm font-medium text-primary">
                  {filteredHotels.length} results in {city}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Hotels Grid - Enhanced with Staggered Animations */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground bg-gradient-to-r from-primary/20 to-primary/5 px-3 py-1 rounded-lg transition-all duration-300 hover:scale-105 inline-block shadow-sm">
                  {filteredHotels.length}
                </span> 
                <span className="ml-2">hotels available</span>
              </p>
            </div>
          </div>

          {filteredHotels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHotels.map((hotel, index) => (
                <div
                  key={hotel.id}
                  className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <HotelCard hotel={hotel} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 animate-in fade-in zoom-in duration-700">
              {/* Empty State with Beautiful Animation */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                {/* Pulsing Rings */}
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
                
                {/* Main Icon Container */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center shadow-xl animate-in spin-in duration-1000">
                  <HotelIcon className="w-10 h-10 text-primary animate-bounce" style={{ animationDuration: '2s' }} />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                No hotels found
              </h3>
              <p className="text-muted-foreground mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
                No hotels available in this city at the moment
              </p>
              
              {city && city !== 'all' && (
                <button
                  onClick={() => setCity('all')}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30 active:scale-95 animate-in fade-in zoom-in duration-500 delay-700 relative overflow-hidden group"
                >
                  <span className="relative z-10">View All Hotels</span>
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

     </div>
  );
};

export default Hotels;