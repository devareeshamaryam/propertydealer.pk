'use client'
/**
 * Blog Detail Page Client Component - Handles all client-side interactivity
 * 
 * FLOW:
 * 1. Receives slug from server component
 * 2. Component mounts → useEffect runs → Fetches blog by slug from API
 * 3. API call: GET /api/blog/slug/:slug → Backend queries MongoDB by slug
 * 4. Backend: findOne({ slug, status: 'published' }) → Only returns published blogs
 * 5. Backend returns blog document with populated author & categories
 * 6. Transform backend format to frontend format
 * 7. Fetch all published blogs for "related posts" section
 * 8. Filter related posts (exclude current, take first 3)
 * 9. Display blog content and related posts
 * 10. Backend automatically increments view count
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BlogDetailPage from '@/components/BlogDetailPage';
import blogApi from '@/lib/api/blog/blog.api';
import { transformBlogToPost, transformBlogsToPosts } from '@/lib/utils/blog-utils';
import type { BlogPost } from '@/lib/utils/blog-utils';
import { Blog } from '@/lib/types/blog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface BlogPostClientProps {
  slug?: string;
}

export default function BlogPostClient({ slug: slugProp }: BlogPostClientProps) {
  // Fallback to useParams if slug prop is not provided
  const urlParams = useParams();
  const slug = slugProp || (urlParams?.slug as string) || '';

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('BlogPostClient - Slug resolved:', { slugProp, urlParams, finalSlug: slug });
  }

  // STATE MANAGEMENT
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FETCH BLOG AND RELATED POSTS
  useEffect(() => {
    const fetchBlogData = async () => {
      if (!slug || slug.trim() === '') {
        const errorMsg = 'Slug is missing from URL parameters';
        console.error('❌', errorMsg, { slugProp, urlParams });
        setError(errorMsg);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // STEP 1: Fetch the specific blog by slug
        // API call: GET /api/blog/slug/:slug
        // Backend: blogService.findBlogBySlug(slug) → MongoDB findOne({ slug, status: 'published' })
        // Returns: Blog document with populated author and categories
        // Note: Backend automatically increments views when fetching by slug
        // Note: Next.js automatically decodes URL params, so slug is already decoded
        console.log('Page: Fetching blog with slug:', slug);
        console.log('Page: Slug type:', typeof slug);

        // Next.js already decodes the slug from the URL, so we pass it as-is
        // The API function will handle any necessary encoding
        const blogResponse = await blogApi.getBlogBySlug(slug);
        console.log('Page: Blog response received:', blogResponse);

        if (!blogResponse) {
          throw new Error('Blog not found');
        }

        // STEP 2: Transform backend format to frontend format
        // Backend returns: { _id, title, slug, content, author: { name, email }, categories: [{ name, slug }], ... }
        // Transform to: { id, title, slug, excerpt, date, author: "Name", category: "Category Name", ... }
        const transformedPost = transformBlogToPost(blogResponse as Blog);
        console.log('Transformed post:', transformedPost);
        setPost(transformedPost);

        // STEP 3: Fetch all published blogs for related posts
        const allBlogsResponse = await blogApi.getPublishedBlogs();
        const allBlogs = transformBlogsToPosts(allBlogsResponse as Blog[]);

        // STEP 4: Filter related posts (exclude current, take first 3)
        const related = allBlogs
          .filter(blog => blog.slug !== slug && blog.id !== transformedPost.id) // Exclude current blog by slug and id
          .slice(0, 3); // Take first 3

        setRelatedPosts(related);

      } catch (err: any) {
        // Enhanced error handling with detailed logging
        const status = err.response?.status;
        const errorData = err.response?.data;

        console.error('❌ Error fetching blog:', {
          slug: slug,
          status: status,
          statusText: err.response?.statusText,
          message: err.message,
          errorData: errorData,
          url: err.config?.url,
          fullError: err
        });

        // Provide helpful error messages based on status code
        let errorMessage = `Failed to load blog post`;

        if (status === 404) {
          errorMessage = `Blog post with slug "${slug}" not found. It may not exist or may not be published.`;
        } else if (status === 500) {
          errorMessage = `Server error while loading blog post. Please try again later.`;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        toast.error('Error Loading Blog', {
          description: errorMessage,
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBlogData();
  }, [slug]); // Re-fetch if slug changes

  // LOADING STATE
  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-32 pb-16">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading blog post...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ERROR STATE
  if (error || !post) {
    return (
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-32 pb-16 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Post Not Found
          </h1>
          <p className="text-muted-foreground mb-8">
            {error || 'The blog post you\'re looking for doesn\'t exist.'}
          </p>
          <Link
            href="/blog"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Back to Blog
          </Link>
        </div>
      </main>
    );
  }

  const jsonLd = post ? {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': post.title,
    'description': post.excerpt,
    'image': post.image,
    'datePublished': post.date,
    'author': {
      '@type': 'Person',
      'name': post.author
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'RentGhar',
      'logo': {
        '@type': 'ImageObject',
        'url': `${typeof window !== 'undefined' ? window.location.origin : 'https://propertydealer.pk'}/logo.png`
      }
    }
  } : null;

  // SUCCESS STATE - Render blog detail
  return (
    <main className="min-h-screen">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <BlogDetailPage post={post} relatedPosts={relatedPosts} />
    </main>
  );
}

