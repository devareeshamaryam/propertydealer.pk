 "use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';

interface Testimonial {
  id: number;
  title: string;
  text: string;
  name: string;
  role: string;
  rating: number;
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
  },
  {
    id: 2,
    title: "Efficiency at its Best",
    text: "The entire process was seamless from start to finish. The team at Property Dealer demonstrated exceptional professionalism and market knowledge. They sold our apartment quickly and at a great price. Highly recommended!",
    name: "Ahmad Raees",
    role: "Legal Consultant",
    rating: 5,
  },
  {
    id: 3,
    title: "Found Our Dream Home",
    text: "Property Dealer helped us find our dream home in Multan. Their expertise in the local market and dedication to understanding our needs made all the difference. Always available and provided valuable insights.",
    name: "Ismail Butt",
    role: "Tech Entrepreneur",
    rating: 5,
  },
  {
    id: 4,
    title: "Unmatched Professionalism",
    text: "I've worked with several real estate agencies, but Property Dealer stands out for their integrity and results-driven approach. They understood exactly what I was looking for and delivered beyond expectations.",
    name: "Humna Khan",
    role: "Design Lead",
    rating: 5,
  }
];

const total = defaultTestimonials.length;

const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const TestimonialCard = ({ testimonial, isAnimating }: { testimonial: Testimonial; isAnimating: boolean }) => (
  <div
    className={`group relative bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 hover:shadow-2xl hover:border-black/5 transition-all duration-500 transform ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
  >
    <div className="absolute top-6 right-6 sm:top-8 sm:right-8 text-gray-50 group-hover:text-gray-100 transition-colors duration-500">
      <Quote size={60} strokeWidth={1} />
    </div>

    <div className="relative z-10">
      <div className="flex gap-1 mb-4 sm:mb-6">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={16} className={i < testimonial.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
        ))}
      </div>

      <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 group-hover:text-black transition-colors">
        "{testimonial.title}"
      </h3>

      <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6 sm:mb-8 italic line-clamp-4 sm:line-clamp-none">
        {testimonial.text}
      </p>

      <div className="flex items-center gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-100">
        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-black flex items-center justify-center text-white font-bold text-base sm:text-xl shadow-lg group-hover:scale-110 transition-transform duration-500 shrink-0">
          {getInitials(testimonial.name)}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm sm:text-lg">{testimonial.name}</h4>
          <p className="text-gray-500 text-xs sm:text-base font-medium">{testimonial.role}</p>
        </div>
      </div>
    </div>
  </div>
);

const TestimonialSection: React.FC<TestimonialSectionProps> = ({
  heading = "Customer Success Stories",
  subheading = "Testimonials",
  description = "Join hundreds of satisfied homeowners and investors who trust Property Dealer for their real estate journey in Pakistan."
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const navigate = (newIndex: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(newIndex);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const next = () => navigate((currentIndex + 1) % total);
  const prev = () => navigate((currentIndex - 1 + total) % total);

  // Safe accessors — always return a valid Testimonial
  const getCard = (index: number): Testimonial =>
    defaultTestimonials[index % total] as Testimonial;

  const mobileCard: Testimonial = getCard(currentIndex);
  const desktopCards: Testimonial[] = [getCard(currentIndex), getCard(currentIndex + 1)];

  return (
    <section className="relative bg-white py-16 sm:py-24 overflow-hidden">
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-gray-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-gray-50 rounded-full blur-3xl opacity-50" />

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
        <div className="max-w-3xl mb-10 sm:mb-16">
          <Badge text={subheading} />
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-4 sm:mb-6 leading-tight">
            {heading}
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>

        <div className="relative">
          {/* Mobile: single card */}
          <div className="block md:hidden">
            <TestimonialCard testimonial={mobileCard} isAnimating={isAnimating} />
          </div>

          {/* Desktop: two cards */}
          <div className="hidden md:grid md:grid-cols-2 gap-8">
            {desktopCards.map((testimonial, idx) => (
              <TestimonialCard
                key={`${testimonial.id}-${idx}`}
                testimonial={testimonial}
                isAnimating={isAnimating}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-8 sm:mt-12">
            <div className="flex gap-2">
              {defaultTestimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => navigate(i)}
                  className={`h-2 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-black' : 'w-2 bg-gray-200 hover:bg-gray-300'}`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={prev}
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:text-black hover:border-black hover:shadow-xl transition-all duration-300 group active:scale-90"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <button
                onClick={next}
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-black flex items-center justify-center text-white hover:bg-gray-800 hover:shadow-xl transition-all duration-300 group active:scale-90"
              >
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
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