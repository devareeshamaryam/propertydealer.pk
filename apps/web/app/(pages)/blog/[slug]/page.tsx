import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogPostClient from './BlogPostClient';
import { Blog } from '@/lib/types/blog';
import { serverApi, isNotFoundError } from '@/lib/server-api';
import { transformBlogToPost, transformBlogsToPosts } from '@/lib/utils/blog-utils';
import { buildBlogPostSchema } from '@/lib/schema/blog-schema';

/*
 * A blog post, rendered on the server: the article is in the HTML. Made on
 * first visit, then cached; refreshed every 10 minutes and whenever the post
 * is edited (the API revalidates "blogs").
 */
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const SITE = 'Property Dealer';

/** The post, or a 404 for one that does not exist. An API that is down throws, so the cached page stays. */
async function getBlog(slug: string): Promise<Blog> {
  try {
    const blog = await serverApi.get<Blog>(`/blog/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 600, tags: ['blogs', `blog:slug:${slug}`] },
    });
    if (!blog) notFound();
    return blog;
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
}

const plain = (html?: string) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function imageOf(blog: Blog): string {
  if (!blog.featuredImage) return `${BASE_URL}/og-image.jpg`;
  return blog.featuredImage.startsWith('http') ? blog.featuredImage : `${BASE_URL}${blog.featuredImage.startsWith('/') ? '' : '/'}${blog.featuredImage}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);

  const authorName =
    typeof blog.author === 'object' && blog.author !== null && 'name' in blog.author ? String(blog.author.name) : `${SITE} Team`;
  const categories =
    Array.isArray(blog.categories) && blog.categories.length > 0
      ? blog.categories.map((c) => (typeof c === 'object' && c && 'name' in c ? String(c.name) : '')).filter(Boolean)
      : [];
  const pageUrl = `${BASE_URL}/blog/${blog.slug}`;
  const title = blog.metaTitle || blog.title;
  const description = (blog.metaDescription || blog.excerpt || plain(blog.content)).slice(0, 160);
  const image = imageOf(blog);
  const published = blog.createdAt ? new Date(blog.createdAt).toISOString() : undefined;
  const modified = blog.updatedAt ? new Date(blog.updatedAt).toISOString() : published;

  return {
    title,
    description,
    ...(blog.tags?.length || categories.length ? { keywords: [...(blog.tags ?? []), ...categories] } : {}),
    authors: [{ name: authorName }],
    alternates: { canonical: blog.canonicalUrl || pageUrl },
    openGraph: {
      type: 'article',
      title,
      description,
      url: pageUrl,
      siteName: SITE,
      images: [{ url: image, alt: blog.title }],
      locale: 'en_PK',
      ...(published ? { publishedTime: published } : {}),
      ...(modified ? { modifiedTime: modified } : {}),
      authors: [authorName],
      ...(categories[0] ? { section: categories[0] } : {}),
      ...(blog.tags?.length ? { tags: blog.tags } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const blog = await getBlog(slug);

  // Related posts are a nice-to-have: their failure must not take the article down.
  let related: Blog[] = [];
  try {
    const all = await serverApi.getPublishedBlogs();
    related = (Array.isArray(all) ? all : []).filter((b) => b.slug !== blog.slug && b._id !== blog._id).slice(0, 3);
  } catch {
    related = [];
  }

  const post = transformBlogToPost(blog);
  const published = blog.createdAt ? new Date(blog.createdAt).toISOString() : new Date().toISOString();
  const schema = buildBlogPostSchema({
    url: `${BASE_URL}/blog/${blog.slug}`,
    title: blog.metaTitle || blog.title,
    description: (blog.metaDescription || blog.excerpt || plain(blog.content)).slice(0, 160),
    image: imageOf(blog),
    publishedAt: published,
    updatedAt: blog.updatedAt ? new Date(blog.updatedAt).toISOString() : published,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <BlogPostClient post={post} relatedPosts={transformBlogsToPosts(related)} />
    </>
  );
}
