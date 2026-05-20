 'use client';

import React from 'react';
import { UserPlus, UserCheck, Home, ArrowRight, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const steps = [
  {
    icon: <UserPlus className="w-5 h-5 sm:w-8 sm:h-8" />,
    title: "Create Account",
    description: "Sign up as an agent in minutes. Start with your first listing for free and manage your inventory with our professional dashboard.",
  },
  {
    icon: <UserCheck className="w-5 h-5 sm:w-8 sm:h-8" />,
    title: "Complete Profile",
    description: "Add your professional details, experience, and contact info to build trust with potential clients.",
  },
  {
    icon: <Home className="w-5 h-5 sm:w-8 sm:h-8" />,
    title: "List Properties",
    description: "Upload high-quality photos and details of your properties to reach thousands of buyers and tenants.",
  },
];

export default function AgentSignupSection() {
  return (
    <section className="py-16 sm:py-24 relative overflow-hidden bg-white">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gray-100 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 opacity-60" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gray-100 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4 opacity-60" />

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-black font-bold text-xs sm:text-sm mb-5 sm:mb-6">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <Link href="/register?role=agent">Become a Partner</Link>
          </div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-4 sm:mb-8 tracking-tight leading-tight">
            List Your Property &{' '}
            <span className="text-black underline decoration-gray-200 decoration-4 underline-offset-4">Grow Your Agency</span>
          </h2>
          <p className="text-base sm:text-xl text-gray-600 leading-relaxed font-medium max-w-2xl mx-auto">
            Join Pakistan's fastest growing property portal. Gain access to thousands of daily visitors and professional tools to manage your listings effectively.
          </p>
        </div>

        {/* Grid */}
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-start">

          {/* Left: Steps */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`group relative bg-white rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-start ${idx === 2 ? 'sm:col-span-2' : ''}`}
              >
                <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-black flex items-center justify-center text-white mb-5 sm:mb-8 group-hover:scale-110 transition-transform duration-500 shadow-lg">
                  {step.icon}
                </div>
                <h3 className="text-lg sm:text-2xl font-black text-gray-900 mb-2 sm:mb-4 tracking-tight">{step.title}</h3>
                <p className="text-gray-600 text-sm sm:text-lg leading-relaxed font-medium">{step.description}</p>
                <div className="mt-5 sm:mt-8 flex items-center gap-2 text-black font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm">
                  <Link href="/register?role=agent">Get Started</Link>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>

          {/* Right: CTA + Testimonial */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">

            {/* Dark CTA Card */}
            <div className="bg-gray-900 rounded-2xl sm:rounded-[2.5rem] p-7 sm:p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex -space-x-3 sm:-space-x-4 mb-6 sm:mb-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-gray-900 overflow-hidden ring-1 ring-white/20">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 20}`} alt="Agent" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center border-4 border-gray-900 text-xs font-bold">
                    +5k
                  </div>
                </div>
                <h4 className="text-xs font-bold opacity-60 uppercase tracking-widest mb-2">Trusted by Professionals</h4>
                <p className="text-2xl sm:text-3xl font-black mb-7 sm:mb-10 leading-tight">Join 5,000+ Active Agents Today</p>
                <div className="space-y-3 sm:space-y-4">
                  <Button asChild size="lg" className="w-full h-12 sm:h-16 rounded-xl sm:rounded-2xl bg-white text-black hover:bg-gray-100 text-sm sm:text-lg font-bold transition-all duration-300 group/btn">
                    <Link href="/register?role=agent">
                      Register as Agent
                      <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild size="lg" className="w-full h-12 sm:h-16 rounded-xl sm:rounded-2xl border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm sm:text-lg font-bold">
                    <Link href="/about">Learn More</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Testimonial — black */}
            <div className="bg-black rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 text-white shadow-2xl shadow-black/20">
              <div className="flex gap-1 mb-3 sm:mb-4">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-white" />)}
              </div>
              <p className="text-sm sm:text-lg font-bold leading-relaxed italic mb-5 sm:mb-6 text-white/90">
                "Property Dealer has transformed how I manage my property portfolio. The leads are high-quality and the platform is incredibly intuitive."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-base border border-white/20 shrink-0">
                  H
                </div>
                <div>
                  <p className="font-bold text-sm sm:text-base">Hamza Aziz</p>
                  <p className="text-xs opacity-60 font-medium">Platinum Real Estate Agency</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}