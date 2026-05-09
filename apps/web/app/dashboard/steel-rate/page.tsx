'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface SteelRate {
  _id: string;
  brand: string;
  price: number;
  change: number;
  city: string;
  unit: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
}

export default function SteelRateListPage() {
  const router = useRouter();
  const [rates, setRates] = useState<SteelRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await api.get('/steel-rate/admin/all');
      setRates(response.data);
    } catch (error) {
      toast.error('Failed to fetch steel rates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this steel rate?')) return;
    
    try {
      setDeleting(id);
      await api.delete(`/steel-rate/${id}`);
      toast.success('Steel rate deleted successfully');
      fetchRates();
    } catch (error) {
      toast.error('Failed to delete steel rate');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Steel Rates</h1>
          <p className="text-gray-500 mt-1">Manage steel rates for your website</p>
        </div>
        <Button onClick={() => router.push('/dashboard/steel-rate/add')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Steel Rate
        </Button>
      </div>

      {rates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No steel rates found. Add your first one!</p>
          <Button onClick={() => router.push('/dashboard/steel-rate/add')} className="mt-4">
            Add Steel Rate
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rates.map((rate) => (
                <tr key={rate._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{rate.brand}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">Rs {rate.price.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${rate.change > 0 ? 'text-green-600' : rate.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {rate.change > 0 ? '+' : ''}{rate.change}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{rate.city}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{rate.category || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${rate.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {rate.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/steel-rate/edit/${rate._id}`)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rate._id)}
                      disabled={deleting === rate._id}
                    >
                      {deleting === rate._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-600" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
