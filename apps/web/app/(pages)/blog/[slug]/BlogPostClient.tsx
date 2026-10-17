'use client';

/*
 * A blog post. The post and its related posts come from the server, so the
 * article is in the page's HTML for search engines and readers alike (it used
 * to be fetched here after the page loaded, leaving the HTML with a spinner).
 * The only thing done in the browser is counting the view, once per session.
 */

import { useEffect } from 'react';
import BlogDetailPage from '@/components/BlogDetailPage';
import blogApi from '@/lib/api/blog/blog.api';
import type { BlogPost } from '@/lib/utils/blog-utils';

interface BlogPostClientProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
}

export default function BlogPostClient({ post, relatedPosts }: BlogPostClientProps) {
  useEffect(() => {
    if (!post?.id) return;
    const key = `pd:blog-view:${post.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // storage blocked: count it anyway
    }
    void blogApi.incrementViews(post.id).catch(() => undefined);
  }, [post?.id]);

  return (
    <main className="min-h-screen">
      <BlogDetailPage post={post} relatedPosts={relatedPosts} />
    </main>
  );
}
