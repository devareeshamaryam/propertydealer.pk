 import { serverApi, isNotFoundError } from '@/lib/server-api';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteName } from "@/lib/site-settings.server";
import { getMaterialRates, getMaterialType, materialSlugFromPage } from '@/lib/materials';
import CustomMaterialClient from '@/components/MaterialRate/CustomMaterialClient';


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

  // /today-<material>-rate-in-pakistan of a material added from the dashboard.
  const material = materialSlugFromPage(slug);
  if (material) {
    const t = await getMaterialType(material).catch(() => null);
    if (t) {
      const year = new Date().getFullYear();
      const title = t.metaTitle || `Today ${t.name} Rate in Pakistan ${year} | ${site}`;
      const description = t.metaDescription || `Check today's ${t.name.toLowerCase()} rates in Pakistan — prices from the main brands and suppliers, updated daily.`;
      return { title, description, alternates: { canonical: `/${slug}` }, openGraph: { title, description, type: 'website' } };
    }
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

  const material = materialSlugFromPage(slug);
  if (material) {
    // An API that is down throws (the cached page stays); no such material falls through to the CMS pages.
    const t = await getMaterialType(material);
    if (t) {
      const rates = await getMaterialRates(t.slug);
      return <CustomMaterialClient slug={t.slug} rates={rates} heading={`Today ${t.name} Rate in Pakistan`} content={t.content} />;
    }
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