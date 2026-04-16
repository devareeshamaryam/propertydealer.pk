import { serverApi } from '@/lib/server-api';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
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

  try {
    const page = await serverApi.getPageBySlug(slug);

    if (!page) {
      notFound();
    }

    // ← Add this debug log (check Vercel logs, PM2 logs, or browser console via hydration)
    console.log('Raw page.content:', page.content);
    console.log('First 200 chars:', page.content.slice(0, 200));

    // Also render it safely for inspection
    return (
      <div className="container mx-auto px-4 pt-24 pb-16 min-h-screen bg-background">
        <h1 className="text-4xl font-bold text-foreground mb-8">{page.title}</h1>

        {/* Debug: show raw string */}
        {/* <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm mb-8">
          {page.content}
        </pre> */}

        {/* Your original render */}
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
