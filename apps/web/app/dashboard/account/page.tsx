"use client"

import React, { useState } from 'react';
import {
  User, Mail, Phone, Save, Trash2, TrendingUp, Eye, Home,
  MapPin, Briefcase, Camera, MessageSquare, Globe, Plus,
  Github, Twitter, Linkedin
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserAccount() {
  const [role] = useState('AGENT'); // Simulating role for testing UI sections

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">Profile Management</h1>
          <p className="text-gray-500 text-lg">Manage your digital identity and professional presence</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Side: Navigation/Avatar Preview */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-gray-50 group-hover:ring-black/10 transition-all duration-300">
                  <img
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Hamza"
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button className="absolute bottom-1 right-1 bg-black text-white p-2.5 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all duration-300">
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Hamza Aziz</h2>
              <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-4">Platinum Agent</p>
              <div className="w-full h-px bg-gray-100 mb-6" />
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-gray-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">12</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Listings</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">4.9</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Rating</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-4 px-2 tracking-wider uppercase">Social Connectivity</h3>
              <div className="space-y-2">
                {[
                  { icon: <Linkedin className="w-5 h-5" />, label: "LinkedIn", connected: true },
                  { icon: <Twitter className="w-5 h-5" />, label: "Twitter", connected: false },
                  { icon: <Github className="w-5 h-5" />, label: "Github", connected: false },
                ].map((social, i) => (
                  <button key={i} className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="text-gray-400 group-hover:text-black transition-colors">{social.icon}</div>
                      <span className="font-semibold text-gray-600 group-hover:text-gray-900">{social.label}</span>
                    </div>
                    {social.connected ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">Connected</span>
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Form Sections */}
          <div className="lg:col-span-8 space-y-6">

            {/* Personal Details */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
                    <p className="text-gray-500 text-sm">Update your basic identification details</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="Hamza Aziz"
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="hamza@rentghar.com"
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+92 300 1234567"
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      placeholder="+92 300 1234567"
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Details (Conditional for Agents) */}
            {role === 'AGENT' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Professional Branding</h2>
                      <p className="text-gray-500 text-sm">Managed your agency and business presence</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Agency Name</label>
                        <input
                          type="text"
                          placeholder="Platinum Real Estate"
                          className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Experience (Years)</label>
                        <input
                          type="number"
                          placeholder="10"
                          className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Professional Bio</label>
                      <textarea
                        rows={4}
                        placeholder="Tell clients about your expertise and history..."
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Office Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="DHA Phase 6, Lahore"
                          className="w-full pl-12 pr-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black transition-all duration-300 outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Button size="lg" className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-black hover:bg-black/90 text-lg font-bold shadow-xl shadow-black/10 transition-all duration-300 active:scale-95 group">
                <Save className="mr-2 w-5 h-5 transition-transform group-hover:rotate-12" />
                Save Changes
              </Button>

              <Button variant="ghost" className="w-full sm:w-auto h-16 px-8 rounded-2xl text-red-600 hover:text-red-700 hover:bg-red-50 font-bold transition-all duration-300 group">
                <Trash2 className="mr-2 w-5 h-5 transition-transform group-hover:scale-110" />
                Delete Account
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}