 import HeroSection from "@/components/HeroSection";
import FeaturedSection from "@/components/FeaturedSection";
import BlogSection from "@/components/BlogSection";
import ExploreTools from "@/components/ExploreTools";
import CityStories from "@/components/CityStories";
import AgentSignupSection from "@/components/AgentSignupSection";
import FAQSection from "@/components/FAQSection";
import { serverApi, getCityStories, getPlans, getRatesSummary, getSpotlightAgencies } from "@/lib/server-api";
import HomePlans from "@/components/home/HomePlans";
import HomeRates from "@/components/home/HomeRates";
import AdSlot from "@/components/ads/AdSlot";
import VerifiedAgencies from "@/components/home/VerifiedAgencies";
import { getSiteSettings } from "@/lib/site-settings.server";
import { mapBackendToFrontendProperty, sortPropertyTypes } from "@/lib/types/property-utils";
import { transformBlogsToPosts } from "@/lib/utils/blog-utils";
import { sortCitiesByPopularity } from "@/lib/pk";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Property Dealer | Buy, Sell & Rent Property",
  description: "Property Dealer is a property buying and selling marketplace across Pakistan, connecting buyers and sellers for residential and commercial real estate.",
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  // Settings → General → Homepage sections.
  const settings = await getSiteSettings();
  // ✅ Sab kuch ek saath fetch — parallel requests
  const [citiesResult, propertiesResult, typesResult, blogsResult, cityStoriesResult, plansResult, agenciesResult, ratesResult] =
    await Promise.allSettled([
      serverApi.getCityNames(),
      serverApi.getProperties(`limit=${settings.homeLatestCount || 8}`),
      serverApi.getTypes(),
      serverApi.getPublishedBlogs(),
      getCityStories(),
      settings.homeShowPlans ? getPlans() : Promise.resolve([]),
      settings.homeShowAgencies ? getSpotlightAgencies() : Promise.resolve([]),
      settings.homeShowRates ? getRatesSummary() : Promise.resolve([]),
    ]);
  const cityStories = cityStoriesResult.status === "fulfilled" ? cityStoriesResult.value : [];
  const plans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const agencies = agenciesResult.status === "fulfilled" ? agenciesResult.value : [];
  const rates = ratesResult.status === "fulfilled" ? ratesResult.value : [];

  if (citiesResult.status === "rejected")
    console.error("❌ Cities fetch failed:", citiesResult.reason?.message || citiesResult.reason);
  if (propertiesResult.status === "rejected")
    console.error("❌ Properties fetch failed:", propertiesResult.reason?.message || propertiesResult.reason);
  if (typesResult.status === "rejected")
    console.error("❌ Types fetch failed:", typesResult.reason?.message || typesResult.reason);
  if (blogsResult.status === "rejected")
    console.error("❌ Blogs fetch failed:", blogsResult.reason?.message || blogsResult.reason);

  const citiesData: any[] = citiesResult.status === "fulfilled" ? citiesResult.value ?? [] : [];
  const propertiesData: any = propertiesResult.status === "fulfilled" ? propertiesResult.value : [];
  const typesData: any[] = typesResult.status === "fulfilled" ? typesResult.value ?? [] : [];
  const blogsData: any[] = blogsResult.status === "fulfilled" ? blogsResult.value ?? [] : [];

  // Properties
  const backendProperties = Array.isArray(propertiesData)
    ? propertiesData
    : (propertiesData as any)?.properties ?? [];

  const transformedProperties = backendProperties
    .map((p: any) => {
      // Cards need no description — it is the bulk of each listing's data.
      try { return { ...mapBackendToFrontendProperty(p), description: undefined }; }
      catch { return null; }
    })
    .filter(Boolean);

  const featuredProperties = transformedProperties.map((property: any) => ({
    id: property.id,
    image: property.image || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
    title: property.name,
    location: `${property.location ?? ""}, ${property.city ?? ""}`.replace(/^, |, $/g, ""),
    price: `Rs. ${(property.price ?? 0).toLocaleString("en-PK")}`,
    priceLabel: property.purpose === "buy" ? "Total Price" : "Monthly Rent",
    beds: property.bedrooms ?? 0,
    baths: property.bathrooms ?? 0,
    marla: `${property.marla ?? 0} marla`,
    slug: property.slug,
  }));

  const processedTypes = typesData
    .filter((t: any) => typeof t === "string")
    .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));

  const sortedProcessedTypes = sortPropertyTypes(processedTypes, t => t);
  // Four cards with title and excerpt — not each article's full HTML, which
  // was most of the homepage's 1 MB.
  const processedBlogs = transformBlogsToPosts(blogsData)
    .slice(0, 4)
    .map((post) => ({ ...post, content: "" }));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Featured Properties',
    'description': 'Featured property listings on Property Dealer',
    'numberOfItems': featuredProperties.length,
    'itemListElement': featuredProperties.slice(0, 10).map((prop: any, index: number) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'RealEstateListing',
        '@id': `${baseUrl}/properties/${prop.slug}`,
        'name': prop.title,
        'url': `${baseUrl}/properties/${prop.slug}`,
        'image': prop.image,
        'offers': {
          '@type': 'Offer',
          'price': prop.price.replace(/[^0-9]/g, ''),
          'priceCurrency': 'PKR',
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <HeroSection
        initialCities={sortCitiesByPopularity(
          citiesData.map((c: any) => ({ _id: c._id, name: c.name }))
        )}
        initialProperties={transformedProperties}
        initialTypes={sortedProcessedTypes}
      />
      {/* Cities as round shortcuts — the ten most popular, then "View all". */}
      {settings.homeShowCities && cityStories.length > 0 && (
        <section className="bg-white pb-2 pt-5 sm:pt-7">
          <div className="container mx-auto px-3 sm:px-4">
            <CityStories cities={cityStories} />
          </div>
        </section>
      )}
      {/* Ads: each placement is switched on and off in Settings → Ads. */}
      <div className="container mx-auto px-[var(--gutter)] sm:px-4">
        <AdSlot placement="HomeTop" variant="banner" className="my-4" />
      </div>
      {settings.homeShowLatest && (
        <FeaturedSection initialProperties={transformedProperties} count={settings.homeLatestCount} />
      )}
      <div className="container mx-auto px-[var(--gutter)] sm:px-4">
        <AdSlot placement="HomeMiddle" className="my-6" />
      </div>
      {settings.homeShowAgencies && <VerifiedAgencies agencies={agencies} />}
      {settings.homeShowAgentBand && <AgentSignupSection />}
      {settings.homeShowPlans && <HomePlans plans={plans} />}
      {settings.homeShowRates && <HomeRates rates={rates} />}
      {settings.homeShowExplore && <ExploreTools />}
      {/*
        A testimonials section was removed: its four reviews (all five stars,
        from a "Marketing Director", a "Legal Consultant", a "Tech
        Entrepreneur" and a "Design Lead") read as template copy, and
        reviews a visitor cannot trace to a real customer do more harm than
        none. Add one back with real reviews — Google reviews, say.
      */}
      {settings.homeShowBlog && <BlogSection initialPosts={processedBlogs} />}
      {settings.homeShowFaq && <FAQSection />}
      <div className="container mx-auto px-[var(--gutter)] sm:px-4">
        <AdSlot placement="HomeBottom" variant="banner" className="my-6" />
      </div>
    </>
  );
}