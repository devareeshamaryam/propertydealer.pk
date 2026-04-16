'use client'
/**
 * BlogGrid Component - Complete Flow Explanation
 * 
 * FLOW:
 * 1. Component mounts → useEffect runs → Fetches blogs from API
 * 2. API call goes to /api/blog/published (Next.js rewrites to backend)
 * 3. Backend returns array of blog objects
 * 4. Transform function converts backend format to frontend format
 * 5. Extract unique categories from blogs
 * 6. Filter blogs by selected category
 * 7. Display blogs in grid with pagination
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, User, ArrowRight, Grid3x3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import blogApi from '@/lib/api/blog/blog.api';
import { transformBlogsToPosts } from '@/lib/utils/blog-utils';
import type { BlogPost } from '@/lib/utils/blog-utils';
import { Blog } from '@/lib/types/blog';
import { toast } from 'sonner';

interface BlogGridProps {
  initialCategory?: string;
}

const BlogGrid = ({ initialCategory = 'All' }: BlogGridProps) => {
  // STATE MANAGEMENT
  // ================
  // These state variables store the component's data and UI state

  const [blogs, setBlogs] = useState<BlogPost[]>([]); // All blogs from API (transformed)
  const [loading, setLoading] = useState(true);        // Loading state for API call
  const [error, setError] = useState<string | null>(null); // Error message if API fails
  const [selectedCategory, setSelectedCategory] = useState(initialCategory); // Currently selected category filter
  const [visiblePosts, setVisiblePosts] = useState(9); // Number of posts to show (pagination)

  // FETCH BLOGS FROM API
  // ====================
  // This useEffect runs once when component mounts (empty dependency array [])
  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        setLoading(true); // Show loading state
        setError(null);   // Clear any previous errors

        // STEP 1: Make API call to backend
        // blogApi.getPublishedBlogs() → GET /api/blog/published
        // Next.js rewrites /api/* to http://localhost:3001/* (see next.config.ts)
        // Backend controller receives request at /blog/published
        // Backend service queries MongoDB for blogs with status='published'
        // Backend returns array of Blog documents (with populated author & categories)
        const response = await blogApi.getPublishedBlogs();

        // STEP 2: Transform backend data to frontend format
        // Backend returns: { _id, title, slug, content, author: { name, email }, categories: [{ name, slug }], ... }
        // Transform function converts to: { id, title, slug, excerpt, date, author: "Name", category: "Category Name", ... }
        const transformedBlogs = transformBlogsToPosts(response as Blog[]);

        // STEP 3: Store in state (triggers re-render)
        setBlogs(transformedBlogs);
      } catch (err: any) {
        // Handle errors gracefully
        const errorMessage = err.response?.data?.message || 'Failed to load blogs';
        setError(errorMessage);
        toast.error('Error', { description: errorMessage });
        console.error('Error fetching blogs:', err);
      } finally {
        setLoading(false); // Hide loading state
      }
    };

    fetchBlogs(); // Call the async function
  }, []); // Empty array = run only once on mount

  // Update selected category when initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  // EXTRACT CATEGORIES FROM BLOGS
  // =============================
  // Get unique categories from all blogs
  // ['All', ...uniqueCategories] creates array starting with 'All' option
  const categories = ['All', ...Array.from(new Set(blogs.map(blog => blog.category)))];

  // FILTER BLOGS BY CATEGORY
  // ========================
  // If 'All' selected → show all blogs
  // Otherwise → filter blogs where category matches selectedCategory
  const filteredPosts = selectedCategory === 'All'
    ? blogs
    : blogs.filter(post => post.category === selectedCategory);

  // PAGINATION LOGIC
  // ================
  // Slice array to show only first N posts (visiblePosts)
  const displayedPosts = filteredPosts.slice(0, visiblePosts);
  const hasMore = visiblePosts < filteredPosts.length; // Check if more posts available

  // LOAD MORE FUNCTION
  // ==================
  // Increases visiblePosts count by 9 to show more posts
  const loadMore = () => {
    setVisiblePosts(prev => prev + 9);
  };

  // LOADING STATE
  // =============
  // Show loading spinner while fetching data
  if (loading) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading blogs...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ERROR STATE
  // ===========
  // Show error message if API call failed
  if (error) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </section>
    );
  }

  // MAIN RENDER
  // ===========
  // Render the blog grid with all the data
  return (
    <section className="py-8 bg-background">
      <div className="container mx-auto px-4">
        {/* Header with Filter and Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          {/* Category Filter - Premium Smooth Buttons */}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setVisiblePosts(9);
                }}
                className={`relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-500 overflow-hidden group ${selectedCategory === category
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
              >
                {/* Smooth Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 -translate-x-full transition-transform duration-700 ${selectedCategory !== category ? 'group-hover:translate-x-full' : ''
                  }`} />

                {/* Glow Effect */}
                <div className={`absolute inset-0 rounded-lg transition-all duration-500 ${selectedCategory === category
                    ? 'bg-primary/20 blur-xl'
                    : 'bg-transparent group-hover:bg-primary/5 group-hover:blur-md'
                  }`} />

                {/* Text */}
                <span className="relative z-10">{category}</span>

                {/* Bottom Border Animation */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary transform origin-left transition-transform duration-500 ${selectedCategory === category
                    ? 'scale-x-100'
                    : 'scale-x-0 group-hover:scale-x-100'
                  }`} />
              </button>
            ))}
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground font-medium">
            Showing <span className="text-foreground font-semibold">{displayedPosts.length}</span> of <span className="text-foreground font-semibold">{filteredPosts.length}</span> articles
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Blog Grid - Main Content */}
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedPosts.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-secondary/20 rounded-2xl">
                  <p className="text-muted-foreground text-base mb-4">
                    No posts found in this category.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCategory('All')}
                    className="gap-2"
                  >
                    View All Posts
                    <ArrowRight size={16} />
                  </Button>
                </div>
              ) : (
                displayedPosts.map((post, index) => (
                  <Link key={post.id} href={`/blog/${post.slug}`}>
                    <article
                      className="bg-card border border-border/50 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer group h-full flex flex-col"
                      style={{
                        animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both`
                      }}
                    >
                      {/* Image - Smaller */}
                      <div className="relative overflow-hidden h-44">
                        <img
                          src={post.image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Subtle Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                        {/* Category Badge - Smaller */}
                        <div className="absolute top-3 left-3">
                          <span className="px-3 py-1 bg-background/95 backdrop-blur-sm text-foreground text-xs font-medium rounded-md shadow-sm">
                            {post.category}
                          </span>
                        </div>
                      </div>

                      {/* Content - Compact */}
                      <div className="p-4 flex-1 flex flex-col">
                        {/* Meta Info - Smaller */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {post.date}
                          </span>
                          <span>•</span>
                          <span>{post.readTime}</span>
                        </div>

                        {/* Title - Smaller */}
                        <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {post.title}
                        </h3>

                        {/* Excerpt - Smaller */}
                        <p className="text-muted-foreground text-xs mb-3 line-clamp-2 leading-relaxed flex-1">
                          {post.excerpt}
                        </p>

                        {/* Read More - Inline */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User size={12} />
                            {post.author}
                          </span>
                          <span className="flex items-center gap-1 text-primary text-xs font-semibold group-hover:gap-2 transition-all">
                            Read
                            <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Sidebar - Load More & Info */}
          <aside className="lg:w-80 space-y-6">
            {/* Load More Card */}
            {hasMore && (
              <div className="bg-card border border-border/50 rounded-xl p-6 sticky top-24">
                <h3 className="text-lg font-bold text-foreground mb-2">
                  More Articles Available
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredPosts.length - visiblePosts} more articles in this category
                </p>
                <Button
                  onClick={loadMore}
                  className="w-full gap-2 relative overflow-hidden bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/30 group"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <span className="relative z-10">Load More</span>
                  <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            )}

            {/* End Message */}
            {!hasMore && filteredPosts.length > 0 && (
              <div className="bg-secondary/30 border border-border/50 rounded-xl p-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Grid3x3 className="text-primary" size={24} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    All Caught Up!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    You've seen all articles in this category
                  </p>
                </div>
              </div>
            )}

            {/* Categories Overview */}
            <div className="bg-card border border-border/50 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground mb-4">
                Popular Topics
              </h3>
              <div className="space-y-2">
                {categories.slice(1, 6).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setVisiblePosts(9);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300 relative group overflow-hidden"
                  >
                    {/* Smooth Slide Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                    <span className="relative z-10">{cat}</span>

                    {/* Arrow on Hover */}
                    <ArrowRight
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-300 text-primary"
                    />
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
};

export default BlogGrid;