// Blog types matching the backend schema
// This file defines the structure of blog data coming from the API

// Category type (populated from backend)
export interface BlogCategory {
  _id: string;
  name: string;
  slug: string;
}

// Author type (populated from backend)
export interface BlogAuthor {
  _id: string;
  name: string;
  email: string;
}

// Main Blog type matching the backend Blog schema
export interface Blog {
  _id: string;                    // MongoDB ObjectId
  title: string;                  // Blog title
  slug: string;                   // SEO-friendly URL slug
  content: string;                // Blog content (HTML/markdown)
  excerpt?: string;               // Short description
  featuredImage?: string;         // Image URL
  tags: string[];                 // Array of tags
  status: 'draft' | 'published';  // Publication status
  views: number;                  // View count
  author: BlogAuthor | string;    // Author object (populated) or ID
  categories: BlogCategory[] | string[]; // Categories (populated) or IDs
  metaTitle?: string;             // SEO meta title
  metaDescription?: string;        // SEO meta description
  canonicalUrl?: string;          // Canonical URL
  createdAt: string;              // ISO date string
  updatedAt: string;              // ISO date string
}

// Frontend-friendly blog post format (transformed from API)
export interface BlogPost {
  id: string;                     // Using _id as id
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;                    // Formatted date
  author: string;                  // Author name
  image: string;                   // Featured image or placeholder
  category: string;               // First category name or "Uncategorized"
  readTime: string;               // Calculated read time
  views?: number;                 // View count
}

