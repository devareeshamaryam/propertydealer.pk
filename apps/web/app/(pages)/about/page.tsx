'use client'
import React from 'react';
import { Handshake, FileCheck, TrendingUp, Truck, Sparkles, Award, Users, Shield, CheckCircle2, Target } from 'lucide-react';
//import NavBar from '@/components/NavBar';
//import Footer from '@/components/Footer';

export default function AboutPage() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const sections = [
    {
      id: 1,
      title: "Ownership Verification",
      icon: Handshake,
      position: "right",
      description: "We prioritize verifying proper land acquisition to mitigate legal concerns. Through rigorous due diligence, we ensure industry-leading compliance and secure property ownership."
    },
    {
      id: 2,
      title: "Legal Approvals",
      icon: FileCheck,
      position: "left",
      description: "We emphasize obtaining all necessary approvals to address legal considerations. Our meticulous compliance process guarantees secure and legitimate properties for our clients."
    },
    {
      id: 3,
      title: "Market Demand",
      icon: TrendingUp,
      position: "right",
      description: "We excel by analyzing market trends and hosting diverse options for Pakistan's growing population. Our expertise creates iconic real estate destinations that meet actual demand."
    },
    {
      id: 4,
      title: "Timely Delivery",
      icon: Truck,
      position: "left",
      description: "Our commitment ensures projects complete on schedule with high quality standards. We consistently meet deadlines while exceeding client expectations at every step."
    }
  ];

  const features = [
    { icon: Shield, title: "Verified Listings", desc: "100% authenticated properties" },
    { icon: CheckCircle2, title: "Secure Transactions", desc: "Safe & transparent deals" },
    { icon: Target, title: "Expert Support", desc: "24/7 customer assistance" }
  ];

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">

      {/* Hero Section - Compact */}
      <div className="relative pt-20 md:pt-24 pb-12 overflow-hidden bg-gradient-to-br from-secondary/40 via-background to-secondary/20">
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute top-10 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-10 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12 text-center">
          {/* Compact Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-in fade-in slide-in-from-top-2 duration-500 backdrop-blur-sm">
            <span className="text-xs font-semibold text-primary tracking-wide">PAKISTAN'S PREMIER PROPERTY PLATFORM</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
            <span className="text-foreground">About </span>
            <span className="text-primary relative inline-block">
              PropertyDealer
              <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 animate-pulse" />
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
            Your trusted platform for finding the perfect property in Pakistan
          </p>
        </div>
      </div>

      {/* Mission Statement - Compact */}
      <div className="relative py-10 px-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            {/* Subtle Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700" />

            {/* Card */}
            <div className="relative bg-card/50 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-lg border border-border/50 animate-in fade-in zoom-in-95 duration-500 delay-200 hover:shadow-xl transition-all">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-12 transition-all duration-500 group-hover:rotate-0 group-hover:scale-110">
                  <Award className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>

              <p className="text-base md:text-lg text-foreground/90 leading-relaxed text-center pt-3">
                Discover thousands of properties for rent and sale across{' '}
                <span className="font-semibold text-primary hover:underline decoration-primary/50 decoration-2 underline-offset-2 transition-all cursor-default">Multan</span>,{' '}
                <span className="font-semibold text-primary hover:underline decoration-primary/50 decoration-2 underline-offset-2 transition-all cursor-default">Lahore</span>,{' '}
                <span className="font-semibold text-primary hover:underline decoration-primary/50 decoration-2 underline-offset-2 transition-all cursor-default">Karachi</span>,{' '}
                <span className="font-semibold text-primary hover:underline decoration-primary/50 decoration-2 underline-offset-2 transition-all cursor-default">Rawalpindi</span> and{' '}
                <span className="font-semibold text-primary hover:underline decoration-primary/50 decoration-2 underline-offset-2 transition-all cursor-default">Islamabad</span>.
                We're committed to making property transactions transparent, secure, and hassle-free.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Bar - NEW */}
      <div className="py-8 px-4 bg-secondary/30 border-y border-border/50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="group flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${i * 100 + 300}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Sections - More Compact */}
      <div className="relative py-12 px-4 bg-background">
        <div className="relative max-w-5xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-10 animate-in fade-in slide-in-from-top-2 duration-500">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Our Process</h2>
            <p className="text-muted-foreground">How we ensure quality at every step</p>
          </div>

          {sections.map((section, index) => {
            const Icon = section.icon;
            const isLeft = section.position === "left";
            const isLast = index === sections.length - 1;

            return (
              <div
                key={section.id}
                className={`relative flex flex-col md:flex-row items-center gap-6 md:gap-12 ${isLast ? 'mb-0' : 'mb-16 md:mb-24'
                  } ${isLeft ? 'md:flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                style={{ animationDelay: `${index * 100 + 400}ms` }}
              >
                {/* Content */}
                <div className={`w-full md:w-5/12 ${isLeft ? 'md:text-right' : 'md:text-left'} text-center group`}>
                  <div className="relative transition-all duration-300 hover:translate-y-[-4px]">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 transition-colors duration-300 group-hover:text-primary">
                      {section.title}
                    </h2>
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                </div>

                {/* Node - Smaller */}
                <div className="relative flex-shrink-0 z-10 group">
                  {/* Connecting Line */}
                  {!isLast && (
                    <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-full h-24">
                      <div className="absolute left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-border via-border to-transparent" />
                      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-full animate-pulse top-0"
                        style={{ animationDuration: '2s', animationDelay: `${index * 0.5}s` }} />
                    </div>
                  )}

                  {/* Glow Ring */}
                  <div className="absolute inset-0 rounded-full bg-primary/30 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500" />

                  {/* Main Circle - Reduced size */}
                  <div className="relative w-28 h-28 md:w-32 md:h-32">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-md group-hover:bg-primary/20 transition-all duration-500" />

                    <div className="absolute inset-1 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-xl shadow-primary/20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12">
                      <div className="w-20 h-20 md:w-24 md:h-24 bg-background rounded-full flex items-center justify-center shadow-inner transition-all duration-500 group-hover:scale-95">
                        <Icon className="w-10 h-10 md:w-12 md:h-12 text-primary transition-all duration-500 group-hover:scale-110" />
                      </div>
                    </div>

                    {/* Orbiting Dots */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <div className="absolute -top-1 left-1/2 w-2 h-2 bg-primary rounded-full animate-ping" />
                      <div className="absolute -bottom-1 right-1/2 w-1.5 h-1.5 bg-primary rounded-full animate-ping"
                        style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>

                <div className="hidden md:block w-5/12" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Section - Compact */}
      <div className="relative py-12 px-4 bg-gradient-to-br from-foreground via-foreground/95 to-foreground overflow-hidden">
        {/* Subtle Background */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute -top-20 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-20 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }} />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-10 animate-in fade-in slide-in-from-top-2 duration-500">
            <h2 className="text-3xl md:text-4xl font-bold text-background mb-2">
              Our Impact
            </h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Award, number: '5000+', label: 'Properties Listed' },
              { icon: Users, number: '2000+', label: 'Happy Customers' },
              { icon: Sparkles, number: '18+', label: 'Years Experience' }
            ].map((stat, index) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={index}
                  className="group relative animate-in fade-in zoom-in-95 duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Glow */}
                  <div className="absolute -inset-1 bg-primary/30 opacity-0 group-hover:opacity-100 blur-lg rounded-2xl transition-all duration-500" />

                  {/* Card */}
                  <div className="relative bg-background/10 backdrop-blur-md rounded-xl p-6 border border-background/20 shadow-xl transition-all duration-500 group-hover:translate-y-[-4px] group-hover:shadow-2xl">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/25 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12">
                      <StatIcon className="w-6 h-6 text-primary-foreground" />
                    </div>

                    {/* Number */}
                    <div className="text-4xl md:text-5xl font-bold text-background mb-2 transition-all duration-300 group-hover:scale-105">
                      {stat.number}
                    </div>

                    {/* Label */}
                    <div className="text-background/70 text-sm font-medium">
                      {stat.label}
                    </div>

                    {/* Bottom accent */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}