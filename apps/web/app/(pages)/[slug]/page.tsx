 import { serverApi } from '@/lib/server-api';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ slug: string }>
}

// ✅ Static files jo is route pe nahi aane chahiye
function isStaticFile(slug: string): boolean {
  return slug.includes('.') || slug === 'og-image' || slug === 'favicon';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // ✅ Static file request aaye toh metadata nahi banao
  if (isStaticFile(slug)) {
    return { title: 'PropertyDealer' };
  }

  try {
    const page = await serverApi.getPageBySlug(slug);

    if (!page) {
      return { title: 'Page Not Found' };
    }

    const title = page.metaTitle || `${page.title} | PropertyDealer`;
    const description = page.metaDescription || "Read more about this on PropertyDealer.";

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
      <div className="container mx-auto px-4 pt-24 pb-16 min-h-screen bg-background">
        <h1 className="text-4xl font-bold text-foreground mb-8">{page.title}</h1>
        <div
          className="prose prose-lg max-w-none text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </div>
    );
  } catch (error) {
    console.error('Error loading custom page:', error);
    notFound();
  }
}