 import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 60,
    // The same widths the API's /img makes (lib/img.ts), so every srcset entry is one cached file.
    deviceSizes: [480, 640, 828, 1080, 1280, 1600],
    imageSizes: [96, 160, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'ptcptourism.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'english.news.cn' },
      { protocol: 'https', hostname: 'propertydealer.pk' },
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    optimizeCss: true,
    // How long the browser reuses a page it already fetched while you click
    // around. Next's default is 5 minutes, so an edit saved in the dashboard
    // still looked unchanged on the site; 30 seconds is the shortest allowed.
    staleTimes: { dynamic: 0, static: 30 },
  },

  compress: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control',   value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'origin-when-cross-origin' },
          /*
           * geolocation=(self), not ().
           *
           * () blocks it outright, including for our own pages — so the "I'm
           * here" button on the map picker threw "Permissions policy
           * violation: Geolocation access has been blocked" and did nothing.
           * (self) keeps it off for embedded third parties and lets our own
           * page ask, which the browser still gates behind the user's own
           * permission prompt.
           */
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // One address per city's dealers page: the folder path redirects to the readable one.
  async redirects() {
    return [{ source: '/property-dealers/:city([a-z0-9-]+)', destination: '/property-dealers-in-:city', permanent: true }];
  },

  async rewrites() {
    // 📡 Determine the correct NestJS API URL.
    // ⚠️ CRITICAL: DO NOT proxy to localhost:3010 or the public domain (propertydealer.pk) as it causes infinite proxy loops.
    let baseUrl = process.env.INTERNAL_API_URL;
    
    if (!baseUrl) {
      const publicUrl = process.env.NEXT_PUBLIC_API_URL;
      if (publicUrl && !publicUrl.includes('propertydealer.pk') && !publicUrl.includes('localhost:3010')) {
        baseUrl = publicUrl;
      }
    }
    
    if (!baseUrl) {
      // Fallback: PM2 runs NestJS on 5000 in production, dev runs on 3005
      baseUrl = process.env.NODE_ENV === 'production' ? 'http://localhost:5000' : 'http://localhost:3005';
    }

    console.log(`📡 Rewriting /api and /uploads to: ${baseUrl}`);
    return {
      beforeFiles: [
        // ✅ Sitemap XML rewrites
        { source: '/sitemap-pages.xml',      destination: '/sitemap-pages'      },
        { source: '/sitemap-areas.xml',      destination: '/sitemap-areas'      },
        { source: '/sitemap-blogs.xml',      destination: '/sitemap-blogs'      },
        { source: '/sitemap-properties.xml', destination: '/sitemap-properties' },
        { source: '/sitemap-rates.xml',      destination: '/sitemap-rates'      },
        { source: '/sitemap-maps.xml',       destination: '/sitemap-maps'       },
        { source: '/sitemap-cities.xml',     destination: '/sitemap-cities'     },
        { source: '/sitemap-city-:slug.xml', destination: '/sitemap-city-:slug' },
        // A city's archive filtered by type (/properties/all/lahore?type=house):
        // served by its own cached route, so the plain city page needs no
        // query string and is cached too. The address in the browser is unchanged.
        {
          source: '/properties/all/:city',
          has: [{ type: 'query', key: 'type', value: '(?<ptype>[A-Za-z][A-Za-z-]{0,30})' }],
          destination: '/properties/all/:city/by-type/:ptype',
        },
        // A city's property dealers: /property-dealers-in-lahore (app/(pages)/property-dealers/[city]).
        { source: '/property-dealers-in-:city([a-z0-9-]+)', destination: '/property-dealers/:city' },
      ],
      afterFiles: [
        { source: '/api/:path*',     destination: `${baseUrl}/api/:path*`     },
        { source: '/uploads/:path*', destination: `${baseUrl}/uploads/:path*` },
        // Resized photos (see lib/img.ts): made once by the API, then cached by Cloudflare.
        { source: '/img/:path*',     destination: `${baseUrl}/img/:path*`     },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;