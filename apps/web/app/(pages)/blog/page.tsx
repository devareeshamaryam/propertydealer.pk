 //import Navbar from '@/components/NavBar';
import BlogGrid from '@/components/BlogGrid';  // ← BlogSection ki jagah BlogGrid
//import Footer from '@/components/Footer';

export default function BlogPage() {
  return (
    <div className="min-h-screen">
      
      {/* Blog Page Header */}
      <div className="pt-24 pb-12 bg-secondary/20">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Property Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Stay updated with the latest trends and insights from Pakistan's property market
          </p>
        </div>
      </div>
      
      <BlogGrid />   
      
    </div>
  );
}