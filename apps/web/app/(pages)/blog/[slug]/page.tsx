import type { Metadata } from 'next';
import BlogPostClient from './BlogPostClient';
import { Blog } from '@/lib/types/blog';
import { serverApi } from '@/lib/server-api';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// SEO Metadata Generation - Server Component
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Next.js 15: params is now a Promise, must await it
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';

  try {
    // Fetch blog data for SEO using serverApi
    const blog: Blog = await serverApi.get(`/blog/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 }
    });

    // Get author name
    const authorName = typeof blog.author === 'object' && blog.author !== null && 'name' in blog.author
      ? blog.author.name
      : 'RentGhar Team';

    // Get category names
    const categories = Array.isArray(blog.categories) && blog.categories.length > 0
      ? blog.categories.map(cat => typeof cat === 'object' && 'name' in cat ? cat.name : 'Uncategorized')
      : ['Uncategorized'];

    // Get featured image or default
    const imageUrl = blog.featuredImage
      ? (blog.featuredImage.startsWith('http')
        ? blog.featuredImage
        : `${baseUrl}${blog.featuredImage.startsWith('/') ? '' : '/'}${blog.featuredImage}`)
      : `${baseUrl}/default-blog.jpg`;

    // Get canonical URL
    const canonicalUrl = blog.canonicalUrl || `${baseUrl}/blog/${blog.slug}`;
    const pageUrl = `${baseUrl}/blog/${blog.slug}`;

    // Meta title and description
    const metaTitle = blog.metaTitle || blog.title;
    const metaDescription = blog.metaDescription || blog.excerpt || blog.title.substring(0, 160);

    // Format date
    const publishedDate = blog.createdAt ? new Date(blog.createdAt).toISOString() : new Date().toISOString();
    const modifiedDate = blog.updatedAt ? new Date(blog.updatedAt).toISOString() : publishedDate;

    // Get author email for additional metadata
    const authorEmail = typeof blog.author === 'object' && blog.author !== null && 'email' in blog.author
      ? blog.author.email
      : undefined;

    // Generate keywords array
    const keywords = blog.tags && blog.tags.length > 0
      ? [...blog.tags, ...categories]
      : categories;

    return {
      title: `${metaTitle} | RentGhar Blog`,
      description: metaDescription,
      keywords: keywords.join(', '),
      authors: [{ name: authorName, ...(authorEmail && { email: authorEmail }) }],
      creator: authorName,
      publisher: 'RentGhar',
      applicationName: 'RentGhar',
      referrer: 'origin-when-cross-origin',
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
      metadataBase: new URL(baseUrl),
      alternates: {
        canonical: canonicalUrl,
        languages: {
          'en-US': pageUrl,
        },
      },
      openGraph: {
        type: 'article',
        title: metaTitle,
        description: metaDescription,
        url: pageUrl,
        siteName: 'RentGhar',
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: blog.title,
            type: 'image/jpeg',
          },
        ],
        locale: 'en_US',
        publishedTime: publishedDate,
        modifiedTime: modifiedDate,
        authors: [authorName],
        section: categories[0] || 'General',
        tags: blog.tags || categories,
      },
      twitter: {
        card: 'summary_large_image',
        title: metaTitle,
        description: metaDescription,
        images: [imageUrl],
        creator: '@rentghar',
        site: '@rentghar',
      },
      robots: {
        index: blog.status === 'published',
        follow: true,
        nocache: false,
        googleBot: {
          index: blog.status === 'published',
          follow: true,
          noimageindex: false,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      verification: {
        // Add verification codes if available
        // google: 'your-google-verification-code',
        // yandex: 'your-yandex-verification-code',
        // yahoo: 'your-yahoo-verification-code',
      },
      category: categories[0] || 'General',
      classification: 'Blog Post',
      other: {
        'article:published_time': publishedDate,
        'article:modified_time': modifiedDate,
        'article:author': authorName,
        'article:section': categories[0] || 'General',
        'article:expiration_time': '', // Can be set if blog has expiration
        ...(blog.tags && blog.tags.length > 0 && {
          'article:tag': blog.tags.join(', '),
        }),
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:type': 'image/jpeg',
        'twitter:image:alt': blog.title,
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Blog Post | RentGhar',
      description: 'Read the latest blog posts about real estate in Pakistan.',
    };
  }
}

import { buildBlogPostSchema } from '@/lib/schema/blog-schema';

// Server Component - passes params to client component
export default async function BlogPostPage({ params }: PageProps) {
  // Next.js 15: params is now a Promise, must await it
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';

  // Fetch blog data for structured data using serverApi
  let blog: Blog | null = null;
  try {
    blog = await serverApi.get(`/blog/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 }
    });
  } catch (error) {
    console.error('Error fetching blog for structured data:', error);
  }

  // --- Schema ---
  let blogSchema: any = null;
  if (blog) {
    const publishedDate = blog.createdAt ? new Date(blog.createdAt).toISOString() : new Date().toISOString();
    const modifiedDate = blog.updatedAt ? new Date(blog.updatedAt).toISOString() : publishedDate;
    const imageUrl = blog.featuredImage
      ? (blog.featuredImage.startsWith('http')
        ? blog.featuredImage
        : `${baseUrl}${blog.featuredImage.startsWith('/') ? '' : '/'}${blog.featuredImage}`)
      : `${baseUrl}/default-blog.jpg`;

    blogSchema = buildBlogPostSchema({
      url: `${baseUrl}/blog/${blog.slug}`,
      title: blog.metaTitle || blog.title,
      description: blog.metaDescription || blog.excerpt || blog.title.substring(0, 160),
      image: imageUrl,
      publishedAt: publishedDate,
      updatedAt: modifiedDate,
    });
  }

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      {blogSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
        />
      )}
      <BlogPostClient slug={slug} />
    </>
  );
}
