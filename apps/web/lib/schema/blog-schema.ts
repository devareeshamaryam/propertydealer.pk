// lib/schema/blog-schema.ts
// Schema.org JSON-LD generators for blog pages

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

/**
 * Build a full graph schema for a single blog post page as requested.
 * Contains BlogPosting and BreadcrumbList.
 */
export function buildBlogPostSchema(data: {
  url: string;
  title: string;
  description: string;
  image: string;
  publishedAt: string;
  updatedAt: string;
}) {
  const { url, title, description, image, publishedAt, updatedAt } = data;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        'mainEntityOfPage': url,
        'headline': title,
        'description': description,
        'image': [image],
        'datePublished': publishedAt,
        'dateModified': updatedAt,
        'author': {
          '@type': 'Organization',
          'name': 'PropertyDealer Team'
        },
        'publisher': {
          '@id': `${BASE_URL}/#organization`
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': `${BASE_URL}/`
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Blog',
            'item': `${BASE_URL}/blog`
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': title,
            'item': url
          }
        ]
      }
    ]
  };
}
