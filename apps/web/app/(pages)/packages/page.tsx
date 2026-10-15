'use client'

import { useEffect, useState } from 'react';
import { packageApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { loginUrl } from '@/lib/auth-intent';

interface Package {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings: number;
  features: string[];
}

export default function PackagesPublicPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const data = await packageApi.getAll();
      setPackages(data);
    } catch (err) {
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cheapest first, the way a price list reads.
  const sorted = [...packages].sort((a, b) => a.price - b.price);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Packages for agents
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          Every account starts on the free plan. Pick a monthly package when you have more to list.
        </p>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((pkg) => {
            // The seeded plans spell their limits out in `features`; older
            // ones only have the numbers, so fall back to those.
            const lines =
              pkg.features.length > 0
                ? pkg.features
                : [
                    `${pkg.propertyLimit} property listings`,
                    ...(pkg.featuredListings > 0 ? [`${pkg.featuredListings} featured listings`] : []),
                  ];
            return (
              <div
                key={pkg._id}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-primary/50"
              >
                <h2 className="text-lg font-bold text-slate-900">{pkg.name}</h2>
                {pkg.description && (
                  <p className="mt-1 text-[14px] text-slate-500">{pkg.description}</p>
                )}
                <p className="mt-4 flex items-baseline gap-1 text-slate-900">
                  <span className="text-[13px] font-semibold text-slate-500">Rs</span>
                  <span className="text-[28px] font-bold leading-none">
                    {pkg.price.toLocaleString('en-PK')}
                  </span>
                  <span className="text-[13px] text-slate-500">/ {pkg.duration} days</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 border-t border-slate-100 pt-4">
                  {lines.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[14px] text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {line}
                    </li>
                  ))}
                </ul>
                {/*
                  Signed out, this used to push straight at a dashboard route
                  and let the layout bounce it to /login — which worked, but
                  dropped the plan on the way: you signed in and landed on the
                  dashboard with no idea what you had clicked. The destination
                  now rides along in ?next=, so signing in finishes the job.
                */}
                <Button
                  className="mt-5 h-10 w-full font-semibold"
                  variant={pkg.price > 0 ? 'default' : 'outline'}
                  disabled={authLoading}
                  onClick={() => {
                    const target = `/dashboard/purchase-package?packageId=${pkg._id}`;
                    router.push(isAuthenticated ? target : loginUrl(target));
                  }}
                >
                  {pkg.price > 0 ? `Choose ${pkg.name}` : 'Get started'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
