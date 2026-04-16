 'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Youtube, Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react';
import { pageApi } from '@/lib/api/page/page.api';

const Footer = () => {
  const [pages, setPages] = useState<any[]>([]);

  useEffect(() => {
    const fetchPublishedPages = async () => {
      try {
        const data = await pageApi.getPublishedPages();
        if (Array.isArray(data)) {
          setPages(data);
        }
      } catch (error) {
        console.error('Error fetching footer pages:', error);
      }
    };
    fetchPublishedPages();
  }, []);

  const cities = [
    { name: 'Lahore',     href: '/properties/all/lahore'     },
    { name: 'Islamabad',  href: '/properties/all/islamabad'  },
    { name: 'Karachi',    href: '/properties/all/karachi'    },
    { name: 'Multan',     href: '/properties/all/multan'     },
    { name: 'Faisalabad', href: '/properties/all/faisalabad' },
  ];

  const quickLinks = [
    { name: 'Properties for Rent', href: '/properties/rent' },
    { name: 'Properties for Sale', href: '/properties/sale' },
    { name: 'About Us',            href: '/about'           },
  ];

  const socials = [
    { icon: Facebook, href: 'https://www.facebook.com/pkpropertydealer',         label: 'Facebook' },
    { icon: Youtube,  href: 'https://www.youtube.com/@Propertydealer-y9r',        label: 'YouTube'  },
    { icon: Linkedin, href: 'https://www.linkedin.com/company/propertydealer-pk/about/', label: 'LinkedIn' },
  ];

  return (
    <footer className="bg-gray-950 text-white">

      {/* ── Top divider accent ── */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

      <div className="container mx-auto px-4 pt-14 pb-8">

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Property<span className="text-primary">Dealer</span>
              </span>
            </Link>

            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              Pakistan's premier property portal connecting buyers, sellers, and renters. Trusted since 2007.
            </p>

            {/* Socials */}
            <div className="flex gap-2">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-primary hover:scale-110 flex items-center justify-center transition-all duration-200 border border-white/10 hover:border-primary"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-5">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1.5 text-gray-300 hover:text-primary transition-colors text-sm"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-5">Popular Cities</h3>
            <ul className="space-y-3">
              {cities.map(city => (
                <li key={city.href}>
                  <Link
                    href={city.href}
                    className="group flex items-center gap-1.5 text-gray-300 hover:text-primary transition-colors text-sm"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-5">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="text-gray-300 text-sm leading-snug pt-1">Lahore, Pakistan</span>
              </li>
              <li>
                <a href="tel:+923030119992" className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-gray-300 text-sm group-hover:text-white transition-colors">+92 303 011 9992</span>
                </a>
              </li>
              <li>
                <a href="mailto:propertydealer.pk01@gmail.com" className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-gray-300 text-sm group-hover:text-white transition-colors break-all">propertydealer.pk01@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-white/5 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© 2025–2026 PropertyDealer. All rights reserved.</p>
          <p className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Trusted since 2007
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;