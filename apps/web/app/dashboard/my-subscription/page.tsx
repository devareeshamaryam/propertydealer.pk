'use client'

import { useEffect, useState } from 'react';
import { subscriptionApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, Calendar, Package, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Subscription {
  _id: string;
  status: string;
  startDate?: string;
  endDate?: string;
  propertiesUsed: number;
  packageId: {
    name: string;
    price: number;
    propertyLimit: number;
    duration: number;
  };
}

import { useAuth } from '@/context/auth-context';

export default function MySubscriptionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchSubscriptions();
    } else if (!authLoading && !isAuthenticated) {
      // Layout handles redirect, but we stop loading here
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const fetchSubscriptions = async () => {
    try {
      const [active, all] = await Promise.all([
        subscriptionApi.getActiveSubscription(),
        subscriptionApi.getMySubscriptions(),
      ]);
      setActiveSubscription(active);
      setAllSubscriptions(all);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const handleCancel = async () => {
    if (!activeSubscription) return;

    if (!window.confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    try {
      setLoading(true);
      await subscriptionApi.cancel(activeSubscription._id);
      await fetchSubscriptions();
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      alert('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          My Subscription
        </h2>
        <p className="text-gray-600">
          Manage your subscription and view usage details
        </p>
      </div>

      {activeSubscription ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg p-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  {activeSubscription.packageId.name} Package
                </h3>
                <p className="text-white/90">Active Subscription</p>
              </div>
              <Badge className="bg-white text-primary">Active</Badge>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5" />
                  <p className="text-sm text-white/80">Days Remaining</p>
                </div>
                <p className="text-3xl font-bold">
                  {getDaysRemaining(activeSubscription.endDate)}
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5" />
                  <p className="text-sm text-white/80">Properties Used</p>
                </div>
                <p className="text-3xl font-bold">
                  {activeSubscription.propertiesUsed} / {activeSubscription.packageId.propertyLimit}
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-sm text-white/80">Expires On</p>
                </div>
                <p className="text-lg font-semibold">
                  {formatDate(activeSubscription.endDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="flex gap-4">
              <Button onClick={() => router.push('/dashboard/property/add-property')}>
                List New Property
              </Button>
              <Button variant="outline" onClick={() => router.push('/packages')}>
                Upgrade Package
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-semibold mb-4">
              No Active Subscription
            </h3>
            <p className="text-gray-600 mb-6">
              Purchase a package to start listing your properties
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/packages')}
            >
              View Packages
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Subscription History</h3>
        {allSubscriptions.length === 0 ? (
          <p className="text-gray-500">No subscription history</p>
        ) : (
          <div className="space-y-3">
            {allSubscriptions.map((sub) => (
              <div
                key={sub._id}
                className="flex justify-between items-center p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{sub.packageId.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(sub.startDate)} - {formatDate(sub.endDate)}
                  </p>
                </div>
                <Badge
                  variant={sub.status === 'active' ? 'default' : 'secondary'}
                >
                  {sub.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
