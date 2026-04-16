'use client'
import { Calendar, User, ArrowLeft, Share2, Facebook, Twitter, Linkedin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Import BlogPost type for type safety
import { BlogPost } from '@/lib/utils/blog-utils';

interface BlogDetailPageProps {
  post: BlogPost; // Use the BlogPost type from utils
  relatedPosts?: BlogPost[]; // Related posts also use BlogPost type
}


const BlogDetailPage = ({ post, relatedPosts = [] }: BlogDetailPageProps) => {
  const sharePost = (platform: string) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = post.title;

    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    };

    if (typeof window !== 'undefined' && shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  // Get base URL for structured data
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://propertydealer.pk';

  // Get full image URL
  const fullImageUrl = post.image?.startsWith('http')
    ? post.image
    : `${baseUrl}${post.image?.startsWith('/') ? '' : '/'}${post.image || '/default-blog.jpg'}`;

  // Get page URL
  const pageUrl = `${baseUrl}/blog/${post.slug}`;

  // Parse date for structured data
  const publishedDate = post.date ? new Date(post.date).toISOString() : new Date().toISOString();

  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data (JSON-LD) for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt || post.title.substring(0, 160),
            image: {
              '@type': 'ImageObject',
              url: fullImageUrl,
              width: 1200,
              height: 630,
            },
            datePublished: publishedDate,
            dateModified: publishedDate,
            author: {
              '@type': 'Person',
              name: post.author,
            },
            publisher: {
              '@type': 'Organization',
              name: 'RentGhar',
              logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/logo.png`,
                width: 200,
                height: 200,
              },
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': pageUrl,
            },
            url: pageUrl,
            articleSection: post.category || 'General',
            keywords: post.category || '',
            wordCount: post.content?.replace(/<[^>]*>/g, '').split(/\s+/).length || 0,
            inLanguage: 'en-US',
            isAccessibleForFree: true,
            ...(post.readTime && {
              timeRequired: post.readTime,
            }),
          }),
        }}
      />
      {/* Back Button */}
      <div className="container mx-auto px-4 pt-24 pb-8">
        <Link href="/blog">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft size={20} />
            Back to Blog
          </Button>
        </Link>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Category Badge */}
          {post.category && (
            <span className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-semibold mb-4">
              {post.category}
            </span>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-8">
            <span className="flex items-center gap-2">
              <Calendar size={18} />
              {post.date}
            </span>
            <span className="flex items-center gap-2">
              <User size={18} />
              {post.author}
            </span>
            {post.readTime && (
              <span className="flex items-center gap-2">
                📖 {post.readTime}
              </span>
            )}
          </div>

          {/* Featured Image */}
          <div className="rounded-2xl overflow-hidden mb-12 shadow-2xl">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-[400px] md:h-[500px] object-cover"
            />
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-12 gap-8">
            {/* Main Content */}
            <div className="md:col-span-8">
              <div
                className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>

            {/* Sidebar */}
            <div className="md:col-span-4">
              <div className="sticky top-24 space-y-6">
                {/* Share Section */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Share2 size={20} />
                    Share Article
                  </h3>
                  <div className="flex gap-3">
                    <Button
                      title="Share on Facebook"
                      onClick={() => sharePost('facebook')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Facebook size={18} />
                    </Button>
                    <Button
                      title="Share on Twitter"
                      onClick={() => sharePost('twitter')}
                      className="flex-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Twitter size={18} />
                    </Button>
                    <Button
                      title="Share on LinkedIn"
                      onClick={() => sharePost('linkedin')}
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Linkedin size={18} />
                    </Button>
                  </div>
                </div>

                {/* Author Card */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-bold text-foreground mb-4">About Author</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{post.author}</p>
                      <p className="text-sm text-muted-foreground">Property Expert</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Experienced real estate professional sharing insights about Pakistan's property market.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <div className="bg-secondary/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-foreground mb-8">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.slice(0, 3).map(relatedPost => (
                  <Link href={`/blog/${relatedPost.slug}`} key={relatedPost.id}>
                    <article className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group">
                      <div className="relative overflow-hidden h-48">
                        <img
                          src={relatedPost.image}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-muted-foreground mb-2">{relatedPost.date}</p>
                        <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                          {relatedPost.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {relatedPost.excerpt}
                        </p>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogDetailPage;