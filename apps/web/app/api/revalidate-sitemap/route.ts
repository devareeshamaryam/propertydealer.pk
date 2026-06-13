 // app/api/revalidate-sitemap/route.ts
// ─── SITEMAP REVALIDATION WEBHOOK ─────────────────────────────────────────
// NestJS is endpoint ko call karta hai jab bhi koi data save hota hai.
// Ye tamam sitemaps ko fresh kar deta hai taake Google ko latest URLs milein.

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Secret verify karo — sirf NestJS call kar sake
  const secret = req.headers.get('x-revalidate-secret');

  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Tamam sitemaps ek saath revalidate
    revalidatePath('/sitemap-properties.xml');
    revalidatePath('/sitemap-pages.xml');
    revalidatePath('/sitemap-blogs.xml');
    revalidatePath('/sitemap-areas.xml');
    revalidatePath('/sitemap-rates.xml');

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
      sitemaps: [
        '/sitemap-properties.xml',
        '/sitemap-pages.xml',
        '/sitemap-blogs.xml',
        '/sitemap-areas.xml',
        '/sitemap-rates.xml',
      ],
    });
  } catch (err: any) {
    console.error('[revalidate-sitemap] Error:', err);
    return NextResponse.json(
      { error: 'Revalidation failed', message: err.message },
      { status: 500 }
    );
  }
}

// GET — browser se test karne ke liye (development only)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  return NextResponse.json({
    message: 'Sitemap revalidation endpoint is working',
    usage: 'POST with x-revalidate-secret header',
  });
}