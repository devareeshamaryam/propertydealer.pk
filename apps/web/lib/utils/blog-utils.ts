// Utility functions to transform backend blog data to frontend format
import { Blog, BlogPost } from '../types/blog';

// Re-export BlogPost type for convenience
export type { BlogPost };

/**
 * Calculate estimated read time based on content length
 * Average reading speed: 200 words per minute
 */
function calculateReadTime(content: string): string {
  // Remove HTML tags and count words
  const textContent = content.replace(/<[^>]*>/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
}

/**
 * Format date from ISO string to readable format
 */
function formatDate(dateString?: string): string {
  if (!dateString) {
    return 'Date not available';
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    // SSR safe date formatting: YYYY-MM-DD
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return 'Date not available';
  }
}

/**
 * Get category name from blog
 * Returns first category name or "Uncategorized"
 */
function getCategoryName(blog: Blog): string {
  if (Array.isArray(blog.categories) && blog.categories.length > 0) {
    const firstCategory = blog.categories[0];
    // Check if it's populated (object) or just ID (string)
    if (typeof firstCategory === 'object' && 'name' in firstCategory) {
      return firstCategory.name;
    }
  }
  return 'Uncategorized';
}

/**
 * Get author name from blog
 * Returns author name or "PropertyDealer Team"
 */
function getAuthorName(blog: Blog): string {
  if (typeof blog.author === 'object' && blog.author !== null && 'name' in blog.author) {
    return blog.author.name;
  }
  return 'PropertyDealer Team';
}

/**
 * Get featured image or placeholder
 */
function getImage(blog: Blog): string {
  if (blog.featuredImage) {
    return blog.featuredImage;
  }
  // Return a placeholder image based on category
  return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop';
}

/**
 * Transform backend Blog to frontend BlogPost format
 */
export function transformBlogToPost(blog: Blog | null | undefined): BlogPost {
  if (!blog) {
    console.error('Blog data is null or undefined');
    return {} as BlogPost; // Fallback instead of throwing
  }

  if (!blog._id || !blog.title || !blog.slug) {
    console.error('Blog data is missing required fields', blog);
    // Return a minimal valid BlogPost object instead of throwing
    return {
      id: blog._id || 'unknown',
      slug: blog.slug || 'unknown',
      title: blog.title || 'Untitled',
      excerpt: '',
      content: '',
      date: 'Date not available',
      author: 'PropertyDealer Team',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop',
      category: 'Uncategorized',
      readTime: '0 min read',
    };
  }

  return {
    id: blog._id,
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt || blog.title.substring(0, 150) + '...',
    content: blog.content || '',
    date: formatDate(blog.createdAt),
    author: getAuthorName(blog),
    image: getImage(blog),
    category: getCategoryName(blog),
    readTime: calculateReadTime(blog.content || ''),
    views: blog.views || 0,
  };
}

/**
 * Transform array of blogs to blog posts
 */
export function transformBlogsToPosts(blogs: Blog[]): BlogPost[] {
  return blogs.map(transformBlogToPost);
}

