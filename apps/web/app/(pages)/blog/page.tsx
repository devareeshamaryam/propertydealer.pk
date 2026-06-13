 //import Navbar from '@/components/NavBar';
import BlogGrid from '@/components/BlogGrid';  // ← BlogSection ki jagah BlogGrid
//import Footer from '@/components/Footer';

export const metadata = {
  title: "Pakistan Real Estate Blog | Property News, Trends & Tips",
  description: "Explore the latest Pakistan property market news, real estate trends, investment tips, and city-wise insights for Lahore, Karachi, Islamabad & more.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen">
      
      {/* Blog Page Header */}
      <div className="pt-24 pb-12 bg-secondary/20">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Pakistan Real Estate Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Make smarter property decisions in Pakistan. Read the latest market trends, price updates, area guides, and expert tips on buying, selling, and renting real estate.
          </p>
        </div>
      </div>
      
      <BlogGrid />   
      
    </div>
  );
}