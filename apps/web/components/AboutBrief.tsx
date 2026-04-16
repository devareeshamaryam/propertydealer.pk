'use client'
import React from 'react';

const AboutBrief = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
            Your Trusted Partner for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Real Estate in Pakistan</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed font-medium">
            Property Dealer is Pakistan's premier property portal, dedicated to helping you find the perfect place to call home. Whether you're looking to <span className="text-gray-900 font-bold">rent a house</span>, <span className="text-gray-900 font-bold">buy an apartment</span>, or invest in <span className="text-gray-900 font-bold">commercial real estate</span>, our platform connects you with thousands of verified listings across major cities like Karachi, Lahore, and Islamabad.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-bold uppercase tracking-wider text-gray-400">
            <span>Residential</span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 self-center"></span>
            <span>Commercial</span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 self-center"></span>
            <span>Plots</span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 self-center"></span>
            <span>Projects</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutBrief;
