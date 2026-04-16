'use client'

import { useEffect, useState } from 'react';
import { packageApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Package
          </h1>
          <p className="text-xl text-gray-600">
            List your properties with our flexible subscription plans
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading packages...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {packages.map((pkg) => (
              <div
                key={pkg._id}
                className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:border-primary transition-all hover:scale-105"
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {pkg.name}
                </h3>
                <p className="text-gray-600 mb-6 min-h-[48px]">
                  {pkg.description}
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-primary">
                    Rs. {pkg.price.toLocaleString('en-PK')}
                  </span>
                  <span className="text-gray-600"> / {pkg.duration} days</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                    <span>{pkg.propertyLimit} property listings</span>
                  </li>
                  {pkg.featuredListings > 0 && (
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                      <span>{pkg.featuredListings} featured listings</span>
                    </li>
                  )}
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  onClick={() => router.push(`/dashboard/purchase-package?packageId=${pkg._id}`)}
                >
                  Get Started
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
