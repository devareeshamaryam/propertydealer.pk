'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, TrendingUp, Minus } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import cementOrderApi, { CementOrderData } from '@/lib/api/cement-order/cement-order.api';

export default function AllCementOrdersPage() {
  const [orders, setOrders] = useState<CementOrderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await cementOrderApi.getAllOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Error', { description: err?.response?.data?.message || 'Failed to load cement orders.' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cement Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage incoming cement orders from customers</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-500">Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No cement orders found yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone / Address</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total (Rs)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="font-semibold text-gray-800">{order.customerName}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="text-gray-900 font-medium">{order.customerPhone}</div>
                      <div className="text-blue-600 text-xs mb-1">{order.customerEmail}</div>
                      <div className="text-gray-500 text-xs truncate max-w-50" title={order.address}>{order.address}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {order.items.length} Product(s)
                      <div className="text-xs text-gray-400">
                        {order.items.map(i => `${i.quantity}x ${i.brand}`).join(', ')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-gray-900">Rs {order.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={
                      order.status === 'COMPLETED' ? 'default' : 
                      order.status === 'PENDING' ? 'secondary' : 
                      order.status === 'CANCELLED' ? 'destructive' : 'outline'
                    } className="text-xs">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(order.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
