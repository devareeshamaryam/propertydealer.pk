'use client'

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, User, ArrowRight, Loader2 } from 'lucide-react';
import { blogApi } from '@/lib/api';
import { transformBlogsToPosts, BlogPost } from '@/lib/utils/blog-utils';
import { Blog } from '@/lib/types/blog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

interface BlogSectionProps {
  initialPosts?: BlogPost[];
}

const BlogSection: React.FC<BlogSectionProps> = ({ initialPosts }) => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(initialPosts || []);
  const [loading, setLoading] = useState(!initialPosts);

  useEffect(() => {
    if (initialPosts) return;

    const fetchBlogs = async () => {
      try {
        setLoading(true);
        const response = await blogApi.getPublishedBlogs();
        const transformed = transformBlogsToPosts(response as Blog[]);
        setBlogPosts(transformed.slice(0, 6));
      } catch (error) {
        console.error('Error fetching blogs:', error);
        setBlogPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, [initialPosts]);

  if (loading) {
    return (
      <section className="py-24 bg-gray-50/50">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gray-300" />
          </div>
        </div>
      </section>
    );
  }

  if (blogPosts.length === 0) {
    return null;
  }

  return (
    <section className="py-24 bg-gray-50/50">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <Badge text="Market Insights" />
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-4 mb-6 leading-tight">
              Latest from Our Blog
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Stay ahead with expert advice on real estate trends, investment tips, and home improvement guides.
            </p>
          </div>
          <Link href="/blog" className="px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 hover:border-black transition-all shadow-sm hover:shadow-xl flex items-center gap-2 mb-2">
            Explore All Articles <ArrowRight size={20} />
          </Link>
        </div>

        <div className="relative">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-6 md:-ml-8">
              {blogPosts.map((post, index) => (
                <CarouselItem
                  key={post.id || index}
                  className="pl-6 md:pl-8 sm:basis-1/2 lg:basis-1/3"
                >
                  <Link href={`/blog/${post.slug}`} className="group h-full block">
                    <article className="bg-white rounded-3xl overflow-hidden border border-gray-100 hover:border-black/5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 h-full flex flex-col">
                      <div className="relative overflow-hidden h-64 w-full">
                        <Image
                          src={post.image}
                          alt={post.title}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-110"
                          sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"
                        />
                        <div className="absolute top-4 left-4">
                          <span className="bg-white/90 backdrop-blur-md text-gray-900 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-xl">
                            {post.category}
                          </span>
                        </div>
                      </div>

                      <div className="p-8 flex flex-col flex-1">
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-50 pb-6">
                          <span className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-300" />
                            {post.date}
                          </span>
                          <span className="flex items-center gap-2">
                            <User size={14} className="text-gray-300" />
                            {post.author}
                          </span>
                        </div>

                        <h3 className="text-2xl font-extrabold text-gray-900 mb-4 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                          {post.title}
                        </h3>

                        <p className="text-gray-500 leading-relaxed mb-8 line-clamp-3 text-sm">
                          {post.excerpt}
                        </p>

                        <div className="mt-auto flex items-center gap-2 text-black font-extrabold text-xs uppercase tracking-[0.2em] group-hover:gap-4 transition-all pb-2">
                          Read Full Article
                          <ArrowRight size={16} className="text-primary" />
                        </div>
                      </div>
                    </article>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden lg:flex absolute top-1/2 -left-20 -translate-y-1/2">
              <CarouselPrevious className="h-14 w-14 rounded-2xl shadow-xl border-none bg-white hover:bg-black hover:text-white transition-all" />
            </div>
            <div className="hidden lg:flex absolute top-1/2 -right-20 -translate-y-1/2">
              <CarouselNext className="h-14 w-14 rounded-2xl shadow-xl border-none bg-white hover:bg-black hover:text-white transition-all" />
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  );
};

const Badge = ({ text }: { text: string }) => (
  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-black text-white text-[10px] font-extrabold uppercase tracking-[0.2em] shadow-sm">
    {text}
  </span>
);

export default BlogSection;