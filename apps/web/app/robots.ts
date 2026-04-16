import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/properties',
          '/blog',
          '/about',
          '/contact',
          '/images/',
          '/assets/',
          '/css/',
          '/js/',
        ],
        disallow: [
          '/dashboard',
          '/login',
          '/register',
          '/api',
          '/_next',
        ],
        crawlDelay: 1,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/dashboard',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
