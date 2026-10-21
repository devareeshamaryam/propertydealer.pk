'use client'
import { sortCitiesByPopularity } from '@/lib/pk';
import SearchPanel from '@/components/search/SearchPanel';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved } from '@/lib/site-settings';
import Image from 'next/image';

/*
 * The search band at the top of the homepage.
 *
 * Portals open with one job: pick buy or rent, a city, maybe an area and a
 * type, and go. The old hero wrapped that in a 400px canvas of three pastel
 * radial gradients over a grid pattern, a 60px black headline with an
 * animated underline, and a frosted card with 24px corners and a hover
 * shadow — and on phones a separate layout with a hand-drawn wave and two
 * full-screen modals just to choose a city. Everything a search needs fits in
 * one compact panel that works the same way at every width; native selects
 * already give phones a proper picker.
 */

interface HeroSectionProps {
  initialCities?: { _id: string; name: string }[];
  /** No longer used: the search suggests places, not listings. */
  initialProperties?: unknown[];
  initialTypes?: string[];
}

const HeroSection: React.FC<HeroSectionProps> = ({ initialCities, initialTypes }) => {
  const settings = useSiteSettings();
  const { heroTitle, heroSubtitle, heroImage } = resolved(settings);
  // 0–95: how much of the dark brand colour sits over the photo.
  const overlay = Math.min(95, Math.max(0, settings.heroOverlay ?? 50)) / 100;
  const cityList = sortCitiesByPopularity((initialCities ?? []).map((c) => ({ _id: c._id, name: c.name })));

  return (
    <section className="relative isolate z-10 rounded-b-[28px] bg-navy md:rounded-b-[44px]">
      {/*
        Settings → Appearance → Hero background: a photo under the brand's
        dark colour, faded so the white text and the search panel stay the
        thing you read. Off, it is the plain dark band.
      */}
      {heroImage && (
        // Clipped to the rounded corners here, not on the section, so the
        // search suggestions can still drop below the band.
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-b-[28px] md:rounded-b-[44px]">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            // Hosts outside next.config's image list are shown as-is.
            unoptimized={!heroImage.startsWith('/') && !heroImage.includes('images.unsplash.com') && !heroImage.includes('propertydealer.pk')}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-navy" style={{ opacity: overlay }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />
        </div>
      )}
      <div className="container mx-auto px-4 py-9 sm:py-14 lg:py-20">
        <h1 className="text-center text-[27px] font-extrabold leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-[46px]">
          {heroTitle}
        </h1>
        <p className="mt-2 text-center text-[15px] text-white/90 sm:text-[17px]">
          {heroSubtitle}
        </p>

        {/* Buy / rent, city, location, type — then price, size, beds. Same panel as the results pages. */}
        <SearchPanel
          variant="hero"
          initialCities={cityList}
          initialTypes={initialTypes}
          defaultCity={settings.defaultCity || 'lahore'}
        />
      </div>
    </section>
  );
};

export default HeroSection;
