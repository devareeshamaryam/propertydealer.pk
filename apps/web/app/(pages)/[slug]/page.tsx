 import { serverApi, isNotFoundError } from '@/lib/server-api';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteName } from "@/lib/site-settings.server";


/* CMS pages: rendered on first visit, then cached; the API revalidates them on edit. */
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type PageProps = {
  params: Promise<{ slug: string }>
}

// ✅ Static files jo is route pe nahi aane chahiye
function isStaticFile(slug: string): boolean {
  // Also the e-map pages' own texts ("emap", "emap-<city>"): they belong to /emap, not to a page of their own.
  return slug.includes('.') || slug === 'og-image' || slug === 'favicon' || slug === 'emap' || slug.startsWith('emap-');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await getSiteName();
  const { slug } = await params;

  // ✅ Static file request aaye toh metadata nahi banao
  if (isStaticFile(slug)) {
    return { title: `${site}` };
  }

  try {
    const page = await serverApi.getPageBySlug(slug);

    if (!page) {
      return { title: 'Page Not Found' };
    }

    const title = page.metaTitle || `${page.title} | ${site}`;
    const description = page.metaDescription || `Read more about this on ${site}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
      },
      alternates: {
        canonical: `/${slug}`,
      },
    };
  } catch (error) {
    return { title: 'Custom Page' };
  }
}

export default async function CustomPage({ params }: PageProps) {
  const { slug } = await params;

  // ✅ Static file request aaye toh 404 karo
  if (isStaticFile(slug)) {
    notFound();
  }

  try {
    const page = await serverApi.getPageBySlug(slug);

    if (!page) {
      notFound();
    }

    return (
      <div className="container mx-auto px-4 pt-8 pb-16 min-h-screen bg-background">
        <h1 className="text-4xl font-bold text-foreground mb-8">{page.title}</h1>
        <div
          className="prose prose-lg max-w-none text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </div>
    );
  } catch (error) {
    // notFound() above lands here too: let it through. A real 404 from the
    // API is a 404; anything else (API down) is thrown so the cached page stays.
    if (isNotFoundError(error)) notFound();
    throw error;
  }
}