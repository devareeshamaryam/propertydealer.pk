# Complete Blog API Integration Flow - Step by Step Guide

This document explains how blogs are fetched from the API and displayed on the frontend, with detailed explanations of each step.

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Complete Flow Diagram](#complete-flow-diagram)
4. [Step-by-Step Explanation](#step-by-step-explanation)
5. [Code Examples](#code-examples)

---

## 🏗️ Architecture Overview

```
Frontend (Next.js)          Backend (NestJS)          Database (MongoDB)
─────────────────          ─────────────────          ────────────────
BlogGrid Component  ────→  BlogController    ────→    Blog Collection
     │                          │                          │
     │ 1. User visits /blog     │                          │
     │ 2. useEffect triggers    │                          │
     │ 3. blogApi.getPublished  │                          │
     │    Blogs()               │                          │
     │                          │                          │
     │                          │ 4. GET /blog/published   │
     │                          │                          │
     │                          │ 5. blogService           │
     │                          │    .findPublishedBlogs() │
     │                          │                          │
     │                          │                          │ 6. Query: 
     │                          │                          │    { status: 'published' }
     │                          │                          │
     │                          │ 7. Returns Blog[]        │
     │                          │    (with populated       │
     │                          │     author & categories)  │
     │                          │                          │
     │ 8. Transform backend      │                          │
     │    format to frontend     │                          │
     │    format                 │                          │
     │                          │                          │
     │ 9. Display in UI          │                          │
```

---

## 📁 File Structure

```
apps/web/
├── lib/
│   ├── api.ts                    # API client & blog API functions
│   ├── types/
│   │   └── blog.ts               # TypeScript interfaces for Blog data
│   └── utils/
│       └── blog-utils.ts        # Transform functions (backend → frontend)
│
├── components/
│   ├── BlogGrid.tsx              # Blog listing page component
│   ├── BlogSection.tsx           # Homepage blog preview
│   └── BlogDetailPage.tsx       # Individual blog post page
│
└── app/
    └── (pages)/
        └── blog/
            ├── page.tsx          # Blog listing route
            └── [id]/
                └── page.tsx     # Blog detail route
```

---

## 🔄 Complete Flow Diagram

### Flow 1: Blog Listing Page (`/blog`)

```
1. User navigates to /blog
   ↓
2. BlogGrid component mounts
   ↓
3. useEffect hook runs (empty dependency array = runs once)
   ↓
4. fetchBlogs() async function called
   ↓
5. blogApi.getPublishedBlogs() executed
   ↓
6. HTTP Request: GET /api/blog/published
   ↓
7. Next.js rewrites /api/* → http://localhost:3001/* (next.config.ts)
   ↓
8. Backend receives request at BlogController.getPublishedBlogs()
   ↓
9. BlogService.findPublishedBlogs() called
   ↓
10. MongoDB query: BlogModel.find({ status: 'published' })
    ↓
11. Backend populates author and categories references
    ↓
12. Returns array of Blog documents
    ↓
13. Response sent back to frontend
    ↓
14. transformBlogsToPosts() converts backend format to frontend format
    ↓
15. setBlogs() updates component state
    ↓
16. Component re-renders with blog data
    ↓
17. Blogs displayed in grid layout
```

### Flow 2: Blog Detail Page (`/blog/[id]`)

```
1. User clicks on a blog post
   ↓
2. Navigates to /blog/[id] (e.g., /blog/507f1f77bcf86cd799439011)
   ↓
3. BlogPostPage component mounts
   ↓
4. useParams() extracts id from URL
   ↓
5. useEffect runs with postId dependency
   ↓
6. fetchBlogData() async function called
   ↓
7. blogApi.getBlogById(postId) executed
   ↓
8. HTTP Request: GET /api/blog/:id
   ↓
9. Backend: BlogController.getBlogById(id)
   ↓
10. BlogService.findBlogById(id) called
    ↓
11. MongoDB query: BlogModel.findById(id)
    ↓
12. Backend populates author and categories
    ↓
13. Returns single Blog document
    ↓
14. Frontend transforms data
    ↓
15. blogApi.incrementViews(postId) called (analytics)
    ↓
16. Fetch all published blogs for related posts
    ↓
17. Filter related posts (exclude current, take first 3)
    ↓
18. Display blog content and related posts
```

---

## 📝 Step-by-Step Explanation

### Step 1: API Client Setup (`lib/api.ts`)

**Purpose**: Configure axios instance and define blog API functions

```typescript
// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',              // Next.js will rewrite this
  withCredentials: true,        // Send cookies for auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Blog API functions
export const blogApi = {
  // Get all published blogs (public endpoint)
  getPublishedBlogs: async () => {
    const response = await api.get('/blog/published');
    return response.data;  // Returns array of Blog objects
  },

  // Get blog by ID
  getBlogById: async (id: string) => {
    const response = await api.get(`/blog/${id}`);
    return response.data;  // Returns single Blog object
  },
};
```

**What happens here:**
- `api.get('/blog/published')` makes HTTP GET request
- Next.js rewrites `/api/blog/published` → `http://localhost:3001/blog/published`
- Backend receives request and processes it
- Response data is returned to frontend

---

### Step 2: Type Definitions (`lib/types/blog.ts`)

**Purpose**: Define TypeScript interfaces matching backend schema

```typescript
// Backend Blog format (from MongoDB)
export interface Blog {
  _id: string;                    // MongoDB ObjectId
  title: string;
  slug: string;
  content: string;
  author: BlogAuthor | string;    // Populated object or ID
  categories: BlogCategory[] | string[]; // Populated array or IDs
  status: 'draft' | 'published';
  // ... more fields
}

// Frontend BlogPost format (transformed)
export interface BlogPost {
  id: string;                     // Using _id as id
  title: string;
  excerpt: string;
  author: string;                 // Just the name
  category: string;               // First category name
  // ... more fields
}
```

**Why two formats?**
- Backend format matches MongoDB schema (with ObjectIds, populated references)
- Frontend format is simpler and easier to work with in React components

---

### Step 3: Transform Functions (`lib/utils/blog-utils.ts`)

**Purpose**: Convert backend Blog format to frontend BlogPost format

```typescript
export function transformBlogToPost(blog: Blog): BlogPost {
  return {
    id: blog._id,                          // Convert _id to id
    title: blog.title,
    excerpt: blog.excerpt || blog.title.substring(0, 150) + '...',
    date: formatDate(blog.createdAt),      // Format ISO date
    author: getAuthorName(blog),           // Extract name from object
    category: getCategoryName(blog),       // Extract first category name
    readTime: calculateReadTime(blog.content), // Calculate from content
    image: getImage(blog),                 // Use featuredImage or placeholder
    // ... more fields
  };
}
```

**What each function does:**
- `formatDate()`: Converts "2026-01-20T10:30:00Z" → "January 20, 2026"
- `getAuthorName()`: Extracts name from populated author object
- `getCategoryName()`: Gets first category name from populated array
- `calculateReadTime()`: Counts words and estimates reading time
- `getImage()`: Uses featuredImage or returns placeholder

---

### Step 4: Component Implementation (`components/BlogGrid.tsx`)

**Purpose**: Fetch and display blogs in a grid layout

```typescript
const BlogGrid = () => {
  // STATE: Store blogs and UI state
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FETCH BLOGS ON MOUNT
  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        setLoading(true);
        
        // STEP 1: Make API call
        const response = await blogApi.getPublishedBlogs();
        
        // STEP 2: Transform data
        const transformed = transformBlogsToPosts(response as Blog[]);
        
        // STEP 3: Update state (triggers re-render)
        setBlogs(transformed);
      } catch (err) {
        setError('Failed to load blogs');
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []); // Empty array = run once on mount

  // FILTER BY CATEGORY
  const filteredPosts = selectedCategory === 'All' 
    ? blogs 
    : blogs.filter(post => post.category === selectedCategory);

  // RENDER
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage />;
  
  return (
    <div>
      {filteredPosts.map(post => (
        <BlogCard key={post.id} post={post} />
      ))}
    </div>
  );
};
```

**Key concepts:**
- `useState`: Manages component state (blogs, loading, error)
- `useEffect`: Runs side effects (API calls) when component mounts
- `async/await`: Handles asynchronous API calls
- `try/catch`: Handles errors gracefully

---

### Step 5: Backend Processing (`apps/api/src/blog/blog.service.ts`)

**Purpose**: Query MongoDB and return blog data

```typescript
async findPublishedBlogs(): Promise<BlogDocument[]> {
  return await this.blogModel
    .find({ status: 'published' })  // MongoDB query
    .populate('author', 'name email')  // Replace author ID with author object
    .populate('categories', 'name slug')  // Replace category IDs with category objects
    .sort({ createdAt: -1 })  // Sort by newest first
    .exec();  // Execute query
}
```

**What happens:**
1. MongoDB finds all blogs with `status: 'published'`
2. `.populate()` replaces ObjectIds with actual documents
3. `.sort()` orders results by creation date (newest first)
4. Returns array of Blog documents

---

## 💡 Code Examples

### Example 1: Fetching Blogs

```typescript
// In BlogGrid component
useEffect(() => {
  const fetchBlogs = async () => {
    // API call
    const response = await blogApi.getPublishedBlogs();
    // Response: [{ _id: "...", title: "...", author: { name: "..." }, ... }]
    
    // Transform
    const blogs = transformBlogsToPosts(response);
    // Blogs: [{ id: "...", title: "...", author: "John Doe", ... }]
    
    // Update state
    setBlogs(blogs);
  };
  
  fetchBlogs();
}, []);
```

### Example 2: Data Transformation

```typescript
// Backend format (from API)
const backendBlog = {
  _id: "507f1f77bcf86cd799439011",
  title: "IT Sector Growth",
  author: { _id: "...", name: "John Doe", email: "..." },
  categories: [{ _id: "...", name: "Market Insights" }],
  createdAt: "2026-01-20T10:30:00Z"
};

// After transformation
const frontendBlog = {
  id: "507f1f77bcf86cd799439011",
  title: "IT Sector Growth",
  author: "John Doe",  // Just the name
  category: "Market Insights",  // First category name
  date: "January 20, 2026"  // Formatted date
};
```

---

## 🎯 Key Takeaways

1. **Separation of Concerns**: API logic, transformation, and UI are separated
2. **Type Safety**: TypeScript interfaces ensure data structure consistency
3. **Error Handling**: Try/catch blocks handle API failures gracefully
4. **Loading States**: Show spinners while data is being fetched
5. **Data Transformation**: Backend format is converted to frontend-friendly format
6. **Reusability**: Transform functions can be used across multiple components

---

## 🐛 Common Issues & Solutions

### Issue 1: Blogs not loading
- **Check**: Backend server is running on port 3001
- **Check**: Next.js rewrite config in `next.config.ts`
- **Check**: Browser console for CORS errors

### Issue 2: Type errors
- **Solution**: Ensure Blog and BlogPost types match backend schema
- **Solution**: Use type assertions: `response as Blog[]`

### Issue 3: Empty categories
- **Check**: Backend is populating categories correctly
- **Check**: Categories exist in database

---

## 📚 Next Steps

1. Add pagination for large blog lists
2. Implement search functionality
3. Add caching to reduce API calls
4. Implement infinite scroll
5. Add error retry mechanism

---

**End of Documentation**

