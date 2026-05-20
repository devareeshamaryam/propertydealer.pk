 'use client'
import { Calculator, TrendingUp, MapPin, Building2, FileText, ShieldCheck } from 'lucide-react';

const tools = [
  {
    id: 1,
    icon: Calculator,
    title: "Search Property",
    description: "Find rental and sale properties using smart filters by city, price, and type.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500"
  },
  {
    id: 2,
    icon: TrendingUp,
    title: "Verified Listings",
    description: "Access trusted, authentic property listings approved by the platform.",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-500"
  },
  {
    id: 3,
    icon: MapPin,
    title: "Add Property",
    description: "Owners and agents can easily post and manage their properties.",
    gradient: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-500"
  },
  {
    id: 4,
    icon: Building2,
    title: "Agent Connect",
    description: "Directly contact verified agents and property owners.",
    gradient: "from-orange-500/20 to-red-500/20",
    iconColor: "text-orange-500"
  },
  {
    id: 5,
    icon: FileText,
    title: "Property Visits",
    description: "Schedule visits and inspections for listed properties.",
    gradient: "from-indigo-500/20 to-blue-500/20",
    iconColor: "text-indigo-500"
  },
  {
    id: 6,
    icon: ShieldCheck,
    title: "Trusted Platform",
    description: "100% secure and transparent platform trusted by thousands across Pakistan.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-500"
  }
];

const ExploreTools = () => {
  return (
    <section className="py-12 sm:py-20 bg-background relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3 sm:mb-4">
            Make Informed Property Decisions
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
            The smarter way to find your perfect home.
          </p>
        </div>

        {/* Tools Grid — 2 cols on mobile, 2 on md, 3 on lg */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 max-w-6xl mx-auto">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="group relative bg-card border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 overflow-hidden"
                style={{ animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both` }}
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                {/* Shimmer Effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Border Glow */}
                <div className="absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/20 to-transparent blur-xl" />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon Container */}
                  <div className="mb-3 sm:mb-6 relative">
                    <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-500 relative overflow-hidden`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      <Icon className={`w-5 h-5 sm:w-8 sm:h-8 ${tool.iconColor} relative z-10 transition-all duration-500 group-hover:rotate-12`} />
                    </div>
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-xl font-bold text-foreground mb-1.5 sm:mb-3 group-hover:text-primary transition-colors duration-300 leading-snug">
                    {tool.title}
                  </h3>

                  {/* Description — hidden on mobile to keep cards compact */}
                  <p className="hidden sm:block text-muted-foreground text-sm leading-relaxed group-hover:text-foreground transition-colors duration-300">
                    {tool.description}
                  </p>
                  <p className="sm:hidden text-muted-foreground text-[11px] leading-relaxed line-clamp-2 group-hover:text-foreground transition-colors duration-300">
                    {tool.description}
                  </p>
                </div>

                {/* Corner Accent */}
                <div className="absolute bottom-0 right-0 w-16 h-16 sm:w-24 sm:h-24 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                  <div className={`absolute inset-0 bg-gradient-to-tl ${tool.gradient} rounded-tl-full`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </section>
  );
};

export default ExploreTools;