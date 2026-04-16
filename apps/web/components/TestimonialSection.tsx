"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star, User } from 'lucide-react';

interface Testimonial {
  id: number;
  title: string;
  text: string;
  name: string;
  role: string;
  rating: number;
  color: string;
}

interface TestimonialSectionProps {
  heading?: string;
  subheading?: string;
  description?: string;
}

const defaultTestimonials: Testimonial[] = [
  {
    id: 1,
    title: "Seamless Selling Experience",
    text: "Working with Property Dealer was an absolute pleasure. Their professional team guided me through every step of the selling process. The attention to detail and commitment to finding the right buyer exceeded my expectations.",
    name: "Ayesha Khan",
    role: "Marketing Director",
    rating: 5,
    color: "from-blue-500 to-indigo-600"
  },
  {
    id: 2,
    title: "Efficiency at its Best",
    text: "The entire process was seamless from start to finish. The team at Property Dealer demonstrated exceptional professionalism and market knowledge. They sold our apartment quickly and at a great price. Highly recommended!",
    name: "Ahmad Raees",
    role: "Legal Consultant",
    rating: 5,
    color: "from-emerald-500 to-teal-600"
  },
  {
    id: 3,
    title: "Found Our Dream Home",
    text: "Property Dealer helped us find our dream home in Multan. Their expertise in the local market and dedication to understanding our needs made all the difference. Always available and provided valuable insights.",
    name: "Ismail Butt",
    role: "Tech Entrepreneur",
    rating: 5,
    color: "from-orange-500 to-red-600"
  },
  {
    id: 4,
    title: "Unmatched Professionalism",
    text: "I've worked with several real estate agencies, but Property Dealer stands out for their integrity and results-driven approach. They understood exactly what I was looking for and delivered beyond expectations.",
    name: "Humna Khan",
    role: "Design Lead",
    rating: 5,
    color: "from-purple-500 to-pink-600"
  }
];

const TestimonialSection: React.FC<TestimonialSectionProps> = ({
  heading = "Customer Success Stories",
  subheading = "Testimonials",
  description = "Join hundreds of satisfied homeowners and investors who trust Property Dealer for their real estate journey in Pakistan."
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const nextTestimonial = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % defaultTestimonials.length);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const prevTestimonial = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + defaultTestimonials.length) % defaultTestimonials.length);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const getVisibleTestimonials = () => {
    const first = defaultTestimonials[currentIndex];
    const second = defaultTestimonials[(currentIndex + 1) % defaultTestimonials.length];
    return [first, second].filter((t): t is Testimonial => !!t);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <section className="relative bg-white py-24 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-gray-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-gray-50 rounded-full blur-3xl opacity-50" />

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
        {/* Header Section */}
        <div className="max-w-3xl mb-16">
          <Badge text={subheading} />
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6 leading-tight">
            {heading}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>

        <div className="relative">
          {/* Main Content Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {getVisibleTestimonials().map((testimonial, idx) => (
              <div
                key={`${testimonial.id}-${idx}`}
                className={`group relative bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-2xl hover:border-black/5 transition-all duration-500 transform ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              >
                {/* Quote Icon Background */}
                <div className="absolute top-8 right-8 text-gray-50 group-hover:text-gray-100 transition-colors duration-500">
                  <Quote size={80} strokeWidth={1} />
                </div>

                <div className="relative z-10">
                  {/* Rating */}
                  <div className="flex gap-1 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={18}
                        className={i < testimonial.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}
                      />
                    ))}
                  </div>

                  {/* Testimonial Text */}
                  <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-black transition-colors">
                    "{testimonial.title}"
                  </h3>
                  <p className="text-gray-600 leading-relaxed min-h-[100px] mb-8 italic">
                    {testimonial.text}
                  </p>

                  {/* Author Profile */}
                  <div className="flex items-center gap-4 pt-6 border-t border-gray-50">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                      {getInitials(testimonial.name)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{testimonial.name}</h4>
                      <p className="text-gray-500 font-medium">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Controls Overlay */}
          <div className="flex items-center justify-between mt-12">
            {/* Pagination Dots */}
            <div className="flex gap-2">
              {defaultTestimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (isAnimating) return;
                    setIsAnimating(true);
                    setCurrentIndex(i);
                    setTimeout(() => setIsAnimating(false), 500);
                  }}
                  className={`h-2 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-black' : 'w-2 bg-gray-200 hover:bg-gray-300'}`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>

            {/* Navigation Arrows */}
            <div className="flex gap-4">
              <button
                onClick={prevTestimonial}
                className="w-14 h-14 rounded-2xl border border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:text-black hover:border-black hover:shadow-xl transition-all duration-300 group active:scale-90"
              >
                <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <button
                onClick={nextTestimonial}
                className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-white hover:bg-gray-800 hover:shadow-xl transition-all duration-300 group active:scale-90"
              >
                <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Badge = ({ text }: { text: string }) => (
  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold uppercase tracking-widest shadow-sm">
    {text}
  </span>
);

export default TestimonialSection;