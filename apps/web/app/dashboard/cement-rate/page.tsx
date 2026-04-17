'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Edit, Trash2, PlusCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import cementRateApi, { CementRateData } from '@/lib/api/cement-rate/cement-rate.api';

export default function AllCementRatesPage() {
  const router = useRouter();
  const [rates, setRates] = useState<CementRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchRates(); }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const data = await cementRateApi.getAllRates();
      setRates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Error', { description: err?.response?.data?.message || 'Failed to load cement rates.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cement rate?')) return;
    try {
      setDeletingId(id);
      await cementRateApi.deleteRate(id);
      toast.success('Cement rate deleted successfully!');
      fetchRates();
    } catch (err: any) {
      toast.error('Error', { description: err?.response?.data?.message || 'Failed to delete.' });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  const ChangeIndicator = ({ change }: { change?: number }) => {
    if (!change || change === 0) return <span className="flex items-center gap-1 text-gray-500 text-sm"><Minus className="w-3 h-3" /> 0</span>;
    if (change > 0) return <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><TrendingUp className="w-3 h-3" />+{change}</span>;
    return <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><TrendingDown className="w-3 h-3" />{change}</span>;
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cement Rates</h1>
            <p className="text-gray-500 text-sm mt-1">Manage all cement brand prices shown on the public page</p>
          </div>
          <Button onClick={() => router.push('/dashboard/cement-rate/add')} className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" /> Add Cement Rate
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-500">Loading rates…</span>
          </div>
        ) : rates.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No cement rates found.</p>
            <Button onClick={() => router.push('/dashboard/cement-rate/add')}>Add First Rate</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price (Rs)</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate._id}>
                  <TableCell className="font-semibold text-gray-800">{rate.brand}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{rate.category ?? 'OPC Cement'}</Badge>
                  </TableCell>
                  <TableCell className="font-bold text-gray-900">Rs {rate.price.toLocaleString()}</TableCell>
                  <TableCell><ChangeIndicator change={rate.change} /></TableCell>
                  <TableCell className="text-gray-600">{rate.weightKg ?? 50} Kg</TableCell>
                  <TableCell>
                    {rate.isActive !== false
                      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Active</Badge>
                      : <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">Inactive</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(rate.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/cement-rate/edit/${rate._id}`)} title="Edit">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rate._id!)} disabled={deletingId === rate._id} title="Delete">
                        {deletingId === rate._id
                          ? <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                          : <Trash2 className="w-4 h-4 text-destructive" />
                        }
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
