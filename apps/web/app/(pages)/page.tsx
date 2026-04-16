import HeroSection from "@/components/HeroSection";
import FeaturedSection from "@/components/FeaturedSection";
import TestimonialSection from "@/components/TestimonialSection";
import BlogSection from "@/components/BlogSection";
import ExploreTools from "@/components/ExploreTools";
import AboutBrief from "@/components/AboutBrief";
import PopularLocations from "@/components/PopularLocations";
import WhyChooseUs from "@/components/WhyChooseUs";
import AgentSignupSection from "@/components/AgentSignupSection";
import FAQSection from "@/components/FAQSection";
import { serverApi } from "@/lib/server-api";
import { mapBackendToFrontendProperty, sortPropertyTypes } from "@/lib/types/property-utils";
import { transformBlogsToPosts } from "@/lib/utils/blog-utils";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Property Dealer | Buy, Sell & Rent Property",
  description: "Property Dealer is a property buying and selling marketplace across Pakistan, connecting buyers and sellers for residential and commercial real estate.",
  alternates: {
    canonical: "/",
  },
};

// Home Page - Server Component
// =============================
export default async function Home() {
  // 1. Fetch data on the server with Next.js caching
  // Promise.allSettled ensures one failing API doesn't crash the entire homepage
  const [citiesResult, propertiesResult, typesResult, blogsResult] =
    await Promise.allSettled([
      serverApi.getCities(),
      serverApi.getProperties("limit=8"),
      serverApi.getTypes(),
      serverApi.getPublishedBlogs(),
    ]);

  // Log any failures for debugging
  if (citiesResult.status === "rejected")
    console.error("❌ Cities fetch failed:", citiesResult.reason?.message || citiesResult.reason);
  if (propertiesResult.status === "rejected")
    console.error("❌ Properties fetch failed:", propertiesResult.reason?.message || propertiesResult.reason);
  if (typesResult.status === "rejected")
    console.error("❌ Types fetch failed:", typesResult.reason?.message || typesResult.reason);
  if (blogsResult.status === "rejected")
    console.error("❌ Blogs fetch failed:", blogsResult.reason?.message || blogsResult.reason);

  const citiesData: any[] =
    citiesResult.status === "fulfilled" ? citiesResult.value ?? [] : [];
  const propertiesData: any =
    propertiesResult.status === "fulfilled" ? propertiesResult.value : [];
  const typesData: any[] =
    typesResult.status === "fulfilled" ? typesResult.value ?? [] : [];
  const blogsData: any[] =
    blogsResult.status === "fulfilled" ? blogsResult.value ?? [] : [];

  // 2. Pre-process Cities for PopularLocations
  const cityToSlug = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const DEFAULT_CITY_IMAGES: Record<string, string> = {
    karachi:
      "https://images.unsplash.com/photo-1570533113000-67623306634d?w=800&q=80",
    lahore:
      "https://images.unsplash.com/photo-1596422846543-75c6fc18a5ce?w=800&q=80",
    islamabad:
      "https://images.unsplash.com/photo-1621538356947-f495bf847683?w=800&q=80",
    faisalabad:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
    multan:
      "https://images.unsplash.com/photo-1570533113000-67623306634d?w=800&q=80",
    gujranwala:
      "https://images.unsplash.com/photo-1596422846543-75c6fc18a5ce?w=800&q=80",
  };
  const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80";

  const CITY_ORDER = [
    "lahore",
    "islamabad",
    "karachi",
    "multan",
    "gujranwala",
    "faisalabad",
  ];

  // Filter cities based on CITY_ORDER first, then process
  const filteredCities = citiesData
    .filter((city: any) => {
      const cityName = (city?.name ?? "").trim().toLowerCase();
      return CITY_ORDER.includes(cityName) || cityName === "faislabad";
    })
    .sort((a: any, b: any) => {
      const nameA = (a?.name ?? "").trim().toLowerCase();
      const nameB = (b?.name ?? "").trim().toLowerCase();
      const getIndex = (name: string) => {
        if (name === "faislabad") return CITY_ORDER.indexOf("faisalabad");
        return CITY_ORDER.indexOf(name);
      };
      return getIndex(nameA) - getIndex(nameB);
    });

  const processedCities = await Promise.all(
    filteredCities.map(async (city: any) => {
      const nameKey = (city?.name ?? "").trim().toLowerCase();
      const cityImage =
        city?.thumbnail ||
        DEFAULT_CITY_IMAGES[nameKey] ||
        DEFAULT_CITY_IMAGES["faisalabad"] ||
        FALLBACK_IMAGE;
      try {
        const stats = await serverApi.getLocationStats(city.name);
        return {
          ...city,
          count: stats?.total ?? 0,
          slug: cityToSlug(city.name),
          image: cityImage,
        };
      } catch {
        return {
          ...city,
          count: 0,
          slug: cityToSlug(city.name),
          image: cityImage,
        };
      }
    })
  );

  // 3. Pre-process Properties for FeaturedSection and Hero suggestions
  const backendProperties = Array.isArray(propertiesData)
    ? propertiesData
    : (propertiesData as any)?.properties ?? [];

  const transformedProperties = backendProperties
    .map((p: any) => {
      try {
        return mapBackendToFrontendProperty(p);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const featuredProperties = transformedProperties.map((property: any) => ({
    id: property.id,
    image:
      property.image ||
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
    title: property.name,
    location: `${property.location ?? ""}, ${property.city ?? ""}`.replace(
      /^, |, $/g,
      ""
    ),
    price: `Rs. ${(property.price ?? 0).toLocaleString("en-PK")}`,
    priceLabel: property.purpose === "buy" ? "Total Price" : "Monthly Rent",
    beds: property.bedrooms ?? 0,
    baths: property.bathrooms ?? 0,
    marla: `${property.marla ?? 0} marla`,
    slug: property.slug,
  }));

  // 4. Pre-process Types for HeroSection
  const processedTypes = typesData
    .filter((t: any) => typeof t === "string")
    .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));

  const sortedProcessedTypes = sortPropertyTypes(processedTypes, t => t);

  // 5. Pre-process Blogs for BlogSection
  const processedBlogs = transformBlogsToPosts(blogsData).slice(0, 6);

  // 6. Build ItemList Schema for Featured Properties
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
      {/* ItemList Schema for Featured Properties */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      
      <HeroSection
        initialCities={citiesData
          .map((c: any) => ({ _id: c._id, name: c.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))}
        initialProperties={transformedProperties}
        initialTypes={sortedProcessedTypes}
      />
      <PopularLocations initialCities={processedCities} />
      <FeaturedSection initialProperties={featuredProperties} />
      <WhyChooseUs />
      <AgentSignupSection />
      <ExploreTools />
      <TestimonialSection />
      <BlogSection initialPosts={processedBlogs} />
      <FAQSection />
    </>
  );
}
