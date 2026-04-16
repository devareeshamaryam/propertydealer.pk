import { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const currentDate = new Date();

  // Helper to convert city/type to slug
  const toSlug = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 1. Static Pages
  const staticPages = [
    '',
    '/about',
    '/blog',
    '/contact',
    '/properties',
    '/properties/rent',
    '/properties/sale',
    '/properties/all',
    '/hotels',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: currentDate,
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // 2. Fetch Dynamic Data for Categories
  const categoryPages: MetadataRoute.Sitemap = [];
  try {
    const [cities, types] = await Promise.all([
      serverApi.getCities(),
      serverApi.getTypes()
    ]);

    const purposes = ['rent', 'sale', 'all'];

    // For each city, we fetch areas and generate URLs
    const cityAreaPages: MetadataRoute.Sitemap = [];
    
    await Promise.all(cities.map(async (city: any) => {
      const citySlug = toSlug(city.name);
      
      // Fetch areas for this city
      let cityAreas: any[] = [];
      try {
        cityAreas = await serverApi.getAreasByCity(city._id);
      } catch (err) {
        console.error(`Error fetching areas for city ${city.name}:`, err);
      }

      purposes.forEach(purpose => {
        // 1. City Pages (/properties/rent/karachi)
        categoryPages.push({
          url: `${BASE_URL}/properties/${purpose}/${citySlug}`,
          lastModified: currentDate,
          changeFrequency: 'weekly',
          priority: 0.7,
        });

        // 2. City + Area Pages (/properties/rent/karachi/model-town)
        cityAreas.forEach(area => {
          if (area.areaSlug) {
            categoryPages.push({
              url: `${BASE_URL}/properties/${purpose}/${citySlug}/${area.areaSlug}`,
              lastModified: currentDate,
              changeFrequency: 'weekly',
              priority: 0.6,
            });
          }
        });

        // 3. City + Type Pages (/properties/rent/karachi/house)
        types.forEach(type => {
          const typeSlug = type.toLowerCase();
          categoryPages.push({
            url: `${BASE_URL}/properties/${purpose}/${citySlug}/${typeSlug}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
          });
        });
      });
    }));
  } catch (error) {
    console.error('Sitemap Categories Fetch Error:', error);
  }

  // 3. Dynamic Properties
  let dynamicProperties: MetadataRoute.Sitemap = [];
  try {
    const response = await serverApi.getProperties('limit=1000'); // Fetch all approved
    const properties = response.properties || response || [];
    
    dynamicProperties = properties.map((prop: any) => ({
      url: `${BASE_URL}/properties/${prop.slug}`,
      lastModified: new Date(prop.updatedAt || prop.createdAt || currentDate),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Sitemap Properties Fetch Error:', error);
  }

  // 4. Dynamic Blogs
  let dynamicBlogs: MetadataRoute.Sitemap = [];
  try {
    const blogs = await serverApi.getPublishedBlogs();
    dynamicBlogs = (blogs || []).map((blog: any) => ({
      url: `${BASE_URL}/blog/${blog.slug}`,
      lastModified: new Date(blog.updatedAt || blog.createdAt || currentDate),
      changeFrequency: 'monthly',
      priority: 0.5,
    }));
  } catch (error) {
    console.error('Sitemap Blogs Fetch Error:', error);
  }

  return [...staticPages, ...categoryPages, ...dynamicProperties, ...dynamicBlogs];
}
