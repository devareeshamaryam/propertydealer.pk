'use client'

import { useEffect, useState } from 'react';
import { subscriptionApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Subscription {
  _id: string;
  userId: any;
  packageId: any;
  status: string;
  paymentStatus: string;
  propertiesUsed: number;
  createdAt: string;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const data = await subscriptionApi.getAll();
      setSubscriptions(data);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await subscriptionApi.activate(id);
      fetchSubscriptions();
    } catch (err) {
      alert('Failed to activate subscription');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Subscription Requests
            </h2>
            <p className="text-gray-600">
              Approve or manage user subscription requests
            </p>
          </div>
          <Button onClick={() => window.location.href = '/dashboard/packages'}>
            + Subscribe New
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No subscription requests found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Properties Used</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub._id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.userId?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{sub.userId?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{sub.packageId?.name}</TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell>
                    {sub.propertiesUsed} / {sub.packageId?.propertyLimit}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {sub.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleActivate(sub._id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div >
  );
}
