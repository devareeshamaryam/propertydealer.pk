'use client';

import React from 'react';
import { UserPlus, UserCheck, Home, ArrowRight, CheckCircle2, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const steps = [
  {
    icon: <UserPlus className="w-8 h-8" />,
    title: "Create Account",
    description: "Sign up as an agent in minutes. Start with your first listing for free and manage your inventory with our professional dashboard.",
    gradient: "from-blue-600 to-indigo-600",
    shadow: "shadow-blue-200",
  },
  {
    icon: <UserCheck className="w-8 h-8" />,
    title: "Complete Profile",
    description: "Add your professional details, experience, and contact info to build trust with potential clients.",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-200",
  },
  {
    icon: <Home className="w-8 h-8" />,
    title: "List Properties",
    description: "Upload high-quality photos and details of your properties to reach thousands of buyers and tenants.",
    gradient: "from-orange-500 to-rose-500",
    shadow: "shadow-orange-200",
  },
];

export default function AgentSignupSection() {
  return (
    <section className="py-24 relative overflow-hidden bg-white">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-bold text-sm mb-6 animate-fade-in">
            <Users className="w-4 h-4" />
            <Link href="/register?role=agent"> Become a Partner</Link>
          </div>
          <h2 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-8 tracking-tight leading-[1.1]">
            List Your Property & <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-600 to-indigo-600">
              Grow Your Agency
            </span>
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed font-medium">
            Join Pakistan's fastest growing property portal. Gain access to thousands of daily visitors and professional tools to manage your listings effectively.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: Onboarding Steps (Bento Style) */}
          <div className="lg:col-span-8 grid md:grid-cols-2 gap-6">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`group relative bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-start ${idx === 2 ? 'md:col-span-2' : ''}`}
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center text-white mb-8 shadow-xl ${step.shadow} group-hover:scale-110 transition-transform duration-500`}>
                  {step.icon}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">{step.title}</h3>
                <p className="text-gray-600 text-lg leading-relaxed font-medium">
                  {step.description}
                </p>
                <div className="mt-8 flex items-center gap-2 text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Link href="/register?role=agent">Get Started</Link>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>

          {/* Right: Premium CTA & Proof Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group">
              {/* Abstract pattern */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="relative z-10">
                <div className="flex -space-x-4 mb-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-12 h-12 rounded-full border-4 border-gray-900 overflow-hidden ring-1 ring-white/20">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 20}`}
                        alt="Agent avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center border-4 border-gray-900 text-xs font-bold ring-1 ring-white/20">
                    +5k
                  </div>
                </div>
                <h4 className="text-lg font-bold opacity-80 uppercase tracking-widest mb-2">Trusted by Professionals</h4>
                <p className="text-3xl font-black mb-10 leading-tight">Join 5,000+ Active Agents Today</p>

                <div className="space-y-4">
                  <Button asChild size="lg" className="w-full h-16 rounded-2xl bg-primary hover:bg-white hover:text-black text-lg font-bold transition-all duration-300 group/btn">
                    <Link href="/register?role=agent">
                      Register as Agent
                      <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild size="lg" className="w-full h-16 rounded-2xl border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white text-lg font-bold">
                    <Link href="/about">Learn More</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Floating Testimonial Card */}
            <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-200">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-current text-white" />)}
              </div>
              <p className="text-lg font-bold leading-relaxed italic mb-6">
                "Property Dealer has transformed how I manage my property portfolio. The leads are high-quality and the platform is incredibly intuitive."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                  H
                </div>
                <div>
                  <p className="font-bold">Hamza Aziz</p>
                  <p className="text-sm opacity-80 font-medium tracking-tight whitespace-nowrap">Platinum Real Estate Agency</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Banner (Social Proof) */}
        {/* <div className="mt-24 pt-12 border-t border-gray-100 flex flex-wrap justify-between items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
          <div className="text-2xl font-black tracking-tighter text-gray-900 italic">ELITE REALTY</div>
          <div className="text-2xl font-black tracking-tighter text-gray-900 italic">NEST FINDER</div>
          <div className="text-2xl font-black tracking-tighter text-gray-900 italic">URBAN PROS</div>
          <div className="text-2xl font-black tracking-tighter text-gray-900 italic">PAK ESTATE</div>
        </div> */}
      </div>
    </section>
  );
}
