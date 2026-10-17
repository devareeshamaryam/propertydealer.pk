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
          '/_next/static/',
          '/_next/image',
          '/uploads/',
        ],
        disallow: [
          '/dashboard',
          '/login',
          '/register',
          '/api',
          // Page data only; the CSS, JS and images under /_next are needed to render pages.
          '/_next/data/',
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
