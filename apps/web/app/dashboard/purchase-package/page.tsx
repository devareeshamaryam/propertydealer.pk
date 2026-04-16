'use client'

import { useEffect, useState, Suspense } from 'react';
import { packageApi, subscriptionApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

function PurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams?.get('packageId');
  const [packageData, setPackageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (packageId) {
      fetchPackage();
    }
  }, [packageId]);

  const fetchPackage = async () => {
    try {
      const data = await packageApi.getById(packageId!);
      setPackageData(data);
    } catch (err) {
      console.error('Error fetching package:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await subscriptionApi.purchase(packageId!);
      alert('Subscription request submitted! Waiting for admin approval.');
      router.push('/dashboard/my-subscription');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to purchase package');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!packageData) {
    return <div>Package not found</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-bold mb-2">{packageData.name}</h2>
        <p className="text-gray-600 mb-6">{packageData.description}</p>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">Price:</span>
            <span className="text-2xl font-bold text-primary">
              Rs. {packageData.price.toLocaleString('en-PK')}
            </span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">Duration:</span>
            <span className="font-semibold">{packageData.duration} days</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Property Limit:</span>
            <span className="font-semibold">{packageData.propertyLimit} properties</span>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handlePurchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Confirm Purchase'
          )}
        </Button>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Your request will be sent to admin for approval
        </p>
      </div>
    </div>
  );
}

export default function PurchasePackagePage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <PurchaseContent />
    </Suspense>
  );
}
