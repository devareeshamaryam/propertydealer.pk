'use client'
import React from 'react';
import { ShieldCheck, UserCheck, PhoneCall, Key } from 'lucide-react';

const features = [
  {
    title: 'Verified Listings',
    description: 'Every property on our platform is thoroughly verified to ensure authenticity and peace of mind.',
    icon: ShieldCheck,
    color: 'bg-blue-50 text-blue-600'
  },
  {
    title: 'Expert Support',
    description: 'Our team of real estate experts is available 24/7 to guide you through every step of your journey.',
    icon: UserCheck,
    color: 'bg-indigo-50 text-indigo-600'
  },
  {
    title: "Expert Consultation",
    description: "Our licensed dealers provide specialized advice on property valuation, documentation, and market investment trends.",
    icon: PhoneCall,
    color: 'bg-purple-50 text-purple-600'
  },
  {
    title: 'Secure Transactions',
    description: 'We prioritize your security with encrypted data and transparent transaction processes.',
    icon: Key,
    color: 'bg-pink-50 text-pink-600'
  }
];

const WhyChooseUs = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Why Choose Property Dealer?</h2>
          <p className="text-gray-600 max-w-2xl mx-auto font-medium">We provide a seamless and secure property experience tailored to the Pakistani market.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-8 rounded-3xl border border-gray-100 hover:border-black/5 hover:shadow-2xl hover:shadow-black/5 transition-all duration-500 group">
              <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed font-medium">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
