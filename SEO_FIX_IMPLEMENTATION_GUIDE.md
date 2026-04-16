# 🔧 SEO Fix Implementation Guide

## ✅ COMPLETED FIXES

### 1. Environment Variables (DONE)
- ✅ Added `NEXT_PUBLIC_BASE_URL` to `.env`
- ✅ Added `NEXT_PUBLIC_SITE_URL` to `.env.production`
- ✅ Updated both development and production configs

### 2. Canonical URL Fix (DONE)
- ✅ Fixed property detail page canonical from `/${slug}` to `/properties/${slug}`

### 3. Robots.txt Improvements (DONE)
- ✅ Added separate rules for Googlebot
- ✅ Added crawl-delay directive
- ✅ Removed `/search` from disallow (if you want it indexed)
- ✅ Added `/api` and `/_next` to disallow

---

## 🚨 CRITICAL: Fix 409/499 Googlebot Errors

### Problem
Your `PropertiesListing` component is client-side and shows "Error Loading Properties" when API fails. Googlebot sees this error screen.

### Solution: Add Fallback Content

**File:** `apps/web/components/PropertiesListing.tsx`

Add this at the top of the error return:

```typescript
if (error && !properties.length) return (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-4 pt-32 pb-16">
      {/* SEO Fallback Content - Visible to Googlebot */}
      <div className="prose max-w-none mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Properties for {purpose === 'buy' ? 'Sale' : purpose === 'rent' ? 'Rent' : 'Rent & Sale'} 
          {matchedCity ? ` in ${matchedCity}` : ' in Pakistan'}
        </h1>
        <p className="text-lg text-muted-foreground mb-4">
          Browse the latest property listings in Pakistan. We offer houses, apartments, 
          plots, and commercial properties for rent and sale across major cities including 
          Lahore, Islamabad, Karachi, Multan, Faisalabad, and Gujranwala.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Popular Cities</h3>
            <ul className="space-y-1 text-sm">
              <li><a href="/properties/rent/lahore" className="text-primary hover:underline">Lahore</a></li>
              <li><a href="/properties/rent/islamabad" className="text-primary hover:underline">Islamabad</a></li>
              <li><a href="/properties/rent/karachi" className="text-primary hover:underline">Karachi</a></li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Property Types</h3>
            <ul className="space-y-1 text-sm">
              <li><a href="/properties/rent/house" className="text-primary hover:underline">Houses</a></li>
              <li><a href="/properties/rent/apartment" className="text-primary hover:underline">Apartments</a></li>
              <li><a href="/properties/rent/plot" className="text-primary hover:underline">Plots</a></li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Quick Links</h3>
            <ul className="space-y-1 text-sm">
              <li><a href="/properties/rent" className="text-primary hover:underline">Properties for Rent</a></li>
              <li><a href="/properties/sale" className="text-primary hover:underline">Properties for Sale</a></li>
              <li><a href="/blog" className="text-primary hover:underline">Real Estate Blog</a></li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* User-facing error message */}
      <div className="text-center mt-8">
        <h2 className="text-2xl font-bold mb-4">Temporarily Unable to Load Listings</h2>
        <p className="text-muted-foreground mb-8">{error}</p>
        <Button onClick={() => setCurrentPage(1)}>Retry</Button>
      </div>
    </div>
  </div>
);
```

### Why This Works
1. **Googlebot sees content** - Not a blank error screen
2. **Internal links** - Helps Googlebot discover other pages
3. **Keywords** - Relevant content for SEO
4. **User experience** - Still shows error to users with retry button

---

## 🔧 API Performance Fixes

### 1. Increase Server Timeout

**File:** `apps/api/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Increase timeout for slow requests (especially from bots)
  app.use((req, res, next) => {
    req.setTimeout(30000); // 30 seconds
    res.setTimeout(30000);
    next();
  });
  
  // Enable CORS
  app.enableCors();
  
  await app.listen(3005);
}
bootstrap();
```

### 2. Add Caching Headers

**File:** `apps/api/src/property/property.controller.ts`

```typescript
@Get()
@Header('Cache-Control', 'public, max-age=300, s-maxage=600')
async getProperties(@Query() query: any) {
  // Your existing code
}
```

### 3. Optimize Database Queries

Check your property service for N+1 queries:

```typescript
// BAD: N+1 query
const properties = await this.propertyModel.find();
for (const prop of properties) {
  prop.city = await this.cityModel.findById(prop.cityId);
}

// GOOD: Use populate
const properties = await this.propertyModel
  .find()
  .populate('city')
  .populate('area')
  .lean(); // Use lean() for read-only queries
```

---

## 📊 Add Missing Structured Data

### 1. Homepage - Add ItemList Schema

**File:** `apps/web/app/(pages)/page.tsx`

Add this before the return statement:

```typescript
// Generate ItemList schema for featured properties
const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  'name': 'Featured Properties',
  'itemListElement': featuredProperties.slice(0, 10).map((prop, index) => ({
    '@type': 'ListItem',
    'position': index + 1,
    'item': {
      '@type': 'RealEstateListing',
      '@id': `https://propertydealer.pk/properties/${prop.slug}`,
      'name': prop.title,
      'url': `https://propertydealer.pk/properties/${prop.slug}`,
      'image': prop.image,
      'offers': {
        '@type': 'Offer',
        'price': prop.price,
        'priceCurrency': 'PKR',
      },
    },
  })),
};

// Add to JSX
return (
  <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
    />
    {/* Rest of your components */}
  </>
);
```

### 2. Homepage - Add FAQPage Schema

**File:** `apps/web/components/FAQSection.tsx`

```typescript
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': 'How do I list my property?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'You can list your property by creating an account and using our dashboard...',
      },
    },
    // Add more FAQs
  ],
};

export default function FAQSection() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Your FAQ UI */}
    </>
  );
}
```

---

## 🖼️ Add Dynamic OG Images

### Option 1: Using @vercel/og (Recommended)

```bash
npm install @vercel/og
```

**File:** `apps/web/app/(pages)/properties/[slug]/opengraph-image.tsx`

```typescript
import { ImageResponse } from '@vercel/og';
import { serverApi } from '@/lib/server-api';

export const runtime = 'edge';
export const alt = 'Property Image';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const property = await serverApi.getPropertyBySlug(params.slug);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 'bold', marginBottom: 20 }}>
          {property.title}
        </div>
        <div style={{ fontSize: 36, color: '#666' }}>
          Rs. {property.price.toLocaleString('en-PK')}
        </div>
        <div style={{ fontSize: 24, color: '#999', marginTop: 20 }}>
          {property.city} • {property.bedrooms} Beds • {property.marla} Marla
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
```

### Option 2: Static OG Image

Create a default OG image:

```bash
# Add to apps/web/public/og-image.jpg
# Size: 1200x630px
# Include: Logo, tagline, website URL
```

---

## 🍞 Add Visible Breadcrumbs

**File:** `apps/web/components/Breadcrumbs.tsx`

```typescript
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        {items.map((item, index) => (
          <li
            key={index}
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="flex items-center gap-2"
          >
            {index < items.length - 1 ? (
              <>
                <Link
                  href={item.url}
                  itemProp="item"
                  className="hover:text-foreground transition-colors"
                >
                  <span itemProp="name">{item.name}</span>
                </Link>
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <span itemProp="name" className="text-foreground font-medium">
                {item.name}
              </span>
            )}
            <meta itemProp="position" content={String(index + 1)} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

**Usage in property detail page:**

```typescript
import Breadcrumbs from '@/components/Breadcrumbs';

export default async function PropertyDetailPage({ params }: PageProps) {
  // ... existing code ...
  
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Properties', url: '/properties' },
    { name: cityName, url: `/properties/rent/${citySlug}` },
    { name: property.title, url: `/properties/${slug}` },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbItems} />
      {/* Rest of your page */}
    </div>
  );
}
```

---

## 📈 Split Large Sitemap

**File:** `apps/web/app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://propertydealer.pk';
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/properties`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];
}
```

**File:** `apps/web/app/sitemap-properties.xml/route.ts`

```typescript
import { serverApi } from '@/lib/server-api';

export async function GET() {
  const properties = await serverApi.getProperties('limit=1000');
  const baseUrl = 'https://propertydealer.pk';
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${properties.map((prop: any) => `
        <url>
          <loc>${baseUrl}/properties/${prop.slug}</loc>
          <lastmod>${new Date(prop.updatedAt).toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.6</priority>
        </url>
      `).join('')}
    </urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=7200',
    },
  });
}
```

---

## 🧪 Testing Checklist

### 1. Test Googlebot Rendering

```bash
# Use Google Search Console
# URL Inspection Tool → Test Live URL
# Check the screenshot - should show content, not error
```

### 2. Test Structured Data

```bash
# Visit: https://validator.schema.org/
# Paste your page URL
# Check for errors
```

### 3. Test Meta Tags

```bash
# Visit: https://www.opengraph.xyz/
# Enter your URL
# Verify OG image, title, description
```

### 4. Test Page Speed

```bash
# Visit: https://pagespeed.web.dev/
# Test both mobile and desktop
# Aim for 90+ score
```

### 5. Test Sitemap

```bash
# Visit: https://propertydealer.pk/sitemap.xml
# Should load without errors
# Submit to Google Search Console
```

---

## 📊 Monitoring

### Google Search Console

1. **Coverage Report**
   - Check for 409/499 errors
   - Monitor indexed pages

2. **Performance Report**
   - Track impressions and clicks
   - Monitor average position

3. **Core Web Vitals**
   - LCP < 2.5s
   - FID < 100ms
   - CLS < 0.1

### Set Up Alerts

```typescript
// apps/web/lib/monitoring.ts
export async function logError(error: Error, context: string) {
  // Send to your monitoring service
  console.error(`[${context}]`, error);
  
  // Optional: Send to Sentry, LogRocket, etc.
  // Sentry.captureException(error);
}
```

---

## 🚀 Deployment Checklist

Before deploying:

- [ ] Environment variables updated
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Test on staging environment
- [ ] Verify robots.txt: `/robots.txt`
- [ ] Verify sitemap: `/sitemap.xml`
- [ ] Test 3-5 property pages in Google Search Console
- [ ] Monitor error logs for 24 hours
- [ ] Check Search Console for new errors

---

## 📞 Need Help?

If you encounter issues:

1. Check browser console for errors
2. Check server logs for API errors
3. Use Google Search Console URL Inspection
4. Test with curl to see raw HTML:
   ```bash
   curl -A "Googlebot" https://propertydealer.pk/properties/rent/lahore
   ```

---

**Last Updated:** April 9, 2026
