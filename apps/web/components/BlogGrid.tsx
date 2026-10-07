"use client";

/**
 * The blog index, grouped by section.
 *
 * It used to be one flat grid of everything with chips that filtered in place:
 * nothing told you what the blog covers, picking a topic changed no URL (so it
 * could not be shared, linked or indexed), and the category pages that already
 * exist — with their own titles and intros — were unreachable from here.
 *
 * Now the index is a contents page: the newest articles, then a row per
 * category with a link into that category's own page. Choosing a topic
 * navigates to that real page instead of hiding rows.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import blogApi from "@/lib/api/blog/blog.api";
import blogCategoryApi from "@/lib/api/blog-category/blog-category.api";
import { transformBlogsToPosts } from "@/lib/utils/blog-utils";
import type { BlogPost } from "@/lib/utils/blog-utils";
import { Blog } from "@/lib/types/blog";
import { cn } from "@/lib/utils";

interface BlogGridProps {
  /**
   * A category name, passed by /blog/category/[slug]. Present = show only that
   * category as a grid; absent = show the grouped index.
   */
  initialCategory?: string;
}

interface CategoryRef {
  _id?: string;
  name: string;
  slug?: string;
}

/** How many of a category's articles the index shows before "View all". */
const PER_SECTION = 3;
const PAGE_SIZE = 9;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function BlogCard({ post, index = 0 }: { post: BlogPost; index?: number }) {
  return (
    <Link href={`/blog/${post.slug}`} className="h-full">
      <article
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
        style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both` }}
      >
        <div className="relative h-44 overflow-hidden">
          <img
            src={post.image}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute left-3 top-3">
            <span className="rounded-md bg-background/95 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              {post.category}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {post.date}
            </span>
            <span>•</span>
            <span>{post.readTime}</span>
          </div>

          <h3 className="mb-2 line-clamp-2 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {post.title}
          </h3>

          <p className="mb-3 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User size={12} />
              {post.author}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-primary transition-all group-hover:gap-2">
              Read
              <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

const BlogGrid = ({ initialCategory }: BlogGridProps) => {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visiblePosts, setVisiblePosts] = useState(PAGE_SIZE);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // The category list is a nicety — it supplies the real slugs for the
        // links. Posts are what the page is for, so one must not fail the other.
        const [postsResult, categoriesResult] = await Promise.allSettled([
          blogApi.getPublishedBlogs(),
          blogCategoryApi.getAllCategories(),
        ]);

        if (postsResult.status !== "fulfilled") throw postsResult.reason;
        setBlogs(transformBlogsToPosts(postsResult.value as Blog[]));

        if (categoriesResult.status === "fulfilled") {
          const list = Array.isArray(categoriesResult.value)
            ? categoriesResult.value
            : (categoriesResult.value?.categories ?? []);
          setCategories(list as CategoryRef[]);
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Failed to load blogs";
        setError(message);
        toast.error("Error", { description: message });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    setVisiblePosts(PAGE_SIZE);
  }, [initialCategory]);

  /** name → slug, preferring the real category record over a derived slug. */
  const slugFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      if (category?.name) map.set(category.name, category.slug || slugify(category.name));
    }
    return (name: string) => map.get(name) || slugify(name);
  }, [categories]);

  /** Every category that actually has published articles, biggest first. */
  const sections = useMemo(() => {
    const counts = new Map<string, BlogPost[]>();
    for (const post of blogs) {
      const key = post.category || "Uncategorized";
      const bucket = counts.get(key);
      if (bucket) bucket.push(post);
      else counts.set(key, [post]);
    }
    return [...counts.entries()]
      .map(([name, posts]) => ({ name, posts }))
      .sort((a, b) => b.posts.length - a.posts.length);
  }, [blogs]);

  const inCategory = useMemo(
    () => (initialCategory ? blogs.filter((post) => post.category === initialCategory) : blogs),
    [blogs, initialCategory],
  );

  if (loading) {
    return (
      <section className="bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading articles…</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="py-20 text-center">
            <p className="mb-4 text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </section>
    );
  }

  const displayed = inCategory.slice(0, visiblePosts);
  const hasMore = visiblePosts < inCategory.length;

  return (
    <section className="bg-background py-8">
      <div className="container mx-auto px-4">
        {/*
          The topic bar. Each chip is a link to that category's own page, so a
          topic can be shared, bookmarked and indexed — and the back button
          works the way people expect.
        */}
        <nav
          aria-label="Blog categories"
          className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            href="/blog"
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              !initialCategory
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            All articles
            <span className="ml-1.5 opacity-70">{blogs.length}</span>
          </Link>

          {sections.map((section) => {
            const on = initialCategory === section.name;
            return (
              <Link
                key={section.name}
                href={`/blog/category/${slugFor(section.name)}`}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {section.name}
                <span className="ml-1.5 opacity-70">{section.posts.length}</span>
              </Link>
            );
          })}
        </nav>

        {initialCategory ? (
          /* ── One category: a plain grid with Load more ── */
          <>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-bold text-foreground">
                {initialCategory}
              </h2>
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {displayed.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">
                  {inCategory.length}
                </span>
              </p>
            </div>

            {displayed.length === 0 ? (
              <div className="rounded-2xl bg-secondary/20 py-16 text-center">
                <p className="mb-4 text-base text-muted-foreground">
                  No articles in this category yet.
                </p>
                <Button variant="outline" asChild className="gap-2">
                  <Link href="/blog">
                    View all articles
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {displayed.map((post, index) => (
                  <BlogCard key={post.id} post={post} index={index} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-8 text-center">
                <Button
                  size="lg"
                  onClick={() => setVisiblePosts((n) => n + PAGE_SIZE)}
                  className="gap-2"
                >
                  Load more
                  <ArrowRight size={16} />
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  {inCategory.length - visiblePosts} more to read
                </p>
              </div>
            )}
          </>
        ) : (
          /* ── The index: newest first, then a row per section ── */
          <div className="space-y-12">
            <div>
              <h2 className="mb-4 text-lg font-bold text-foreground">
                Latest articles
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {blogs.slice(0, 6).map((post, index) => (
                  <BlogCard key={post.id} post={post} index={index} />
                ))}
              </div>
            </div>

            {sections.map((section) => (
              <div key={section.name}>
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b pb-2">
                  <h2 className="text-lg font-bold text-foreground">
                    {section.name}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {section.posts.length}{" "}
                      {section.posts.length === 1 ? "article" : "articles"}
                    </span>
                  </h2>
                  <Link
                    href={`/blog/category/${slugFor(section.name)}`}
                    className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:gap-2"
                  >
                    View all
                    <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.posts.slice(0, PER_SECTION).map((post, index) => (
                    <BlogCard key={post.id} post={post} index={index} />
                  ))}
                </div>
              </div>
            ))}

            {blogs.length === 0 && (
              <p className="rounded-2xl bg-secondary/20 py-16 text-center text-muted-foreground">
                No articles published yet.
              </p>
            )}
          </div>
        )}
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
