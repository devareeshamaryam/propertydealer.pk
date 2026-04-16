import { Metadata, ResolvingMetadata } from 'next';
import BlogGrid from '@/components/BlogGrid';
import blogCategoryApi from '@/lib/api/blog-category/blog-category.api';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata(
  props: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await props.params;

  try {
    const category = await blogCategoryApi.getCategoryBySlug(slug);

    if (!category) return {};

    return {
      title: category.metaTitle || `${category.name}`,
      description: category.metaDescription || category.description?.replace(/<[^>]*>/g, '').substring(0, 160),
      alternates: {
        canonical: category.canonicalUrl || undefined,
      },
    };
  } catch (error) {
    return {
      title: 'Blog Category ',
    };
  }
}

export default async function BlogCategoryPage(props: PageProps) {
  const { slug } = await props.params;
  let category = null;

  try {
    category = await blogCategoryApi.getCategoryBySlug(slug);
  } catch (error) {
    console.error('Error fetching category:', error);
  }

  return (
    <div className="min-h-screen">
      {/* Blog Page Header */}
      <div className="pt-24 pb-12 bg-secondary/20">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {category?.name || 'Blog Category'}
          </h1>
          {category?.description && (
            <div
              className="mt-6 prose prose-sm max-w-4xl text-muted-foreground prose-headings:text-foreground prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: category.description }}
            />
          )}
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <BlogGrid initialCategory={category?.name} />
      </Suspense>
    </div>
  );
}
