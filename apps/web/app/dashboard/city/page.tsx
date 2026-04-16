'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cityApi } from '@/lib/api/city/city.api';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';

import { Loader2, Eye, Edit, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DashboardCityPage() {
  const router = useRouter();
  const [cities, setCities] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await cityApi.getAll();
        setCities(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching cities:', err);
        setError('Failed to load cities. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, []);

  const handleView = async (cityId: string) => {
    try {
      const city = await cityApi.getById(cityId);
      setSelectedCity(city);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to load city details.',
      });
    }
  };

  const handleEdit = (cityId: string) => {
    router.push(`/dashboard/city/edit/${cityId}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this city? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await cityApi.delete(id);
      toast.success('City deleted successfully!');
      // Refresh the list
      const data = await cityApi.getAll();
      setCities(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error deleting city:', error);
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to delete city. Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      approved: 'default',
      pending: 'secondary',
      rejected: 'destructive',
    };

    const colors: Record<string, string> = {
      approved: 'bg-green-100 text-green-800 hover:bg-green-100',
      pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      rejected: 'bg-red-100 text-red-800 hover:bg-red-100',
    };

    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Cities Dashboard
            </h2>
            <p className="text-gray-600">
              Manage all cities for property listings
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/city/add-city')}>
            Add New City
          </Button>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">Loading properties...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : cities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No cities found.</p>
            <Button onClick={() => router.push('/dashboard/city/add-city')}>
              Add Your First City
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city: any) => (
                <TableRow key={city._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[200px]">
                      <p className="truncate">{city.name}</p>

                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {city.state ? city.state.charAt(0).toUpperCase() + city.state.slice(1) : 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px]">
                      <p className="truncate text-sm">{city.country || 'N/A'}</p>
                    </div>
                  </TableCell>
                  {/* <TableCell>
                    <div>
                      <p className="font-semibold">
                        {city.country}
                      </p>
                    </div>
                  </TableCell> */}

                  <TableCell className="text-sm text-gray-600">
                    {formatDate(city.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(city._id)}
                        title="View city details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(city._id)}
                            title="Edit city"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(city._id)}
                            disabled={deletingId === city._id}
                            title="Delete city"
                          >
                            {deletingId === city._id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-destructive" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* View City Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>City Details</DialogTitle>
            <DialogDescription>
              View detailed information about the city
            </DialogDescription>
          </DialogHeader>
          {selectedCity && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">City Name</label>
                <p className="text-lg font-semibold mt-1">{selectedCity.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">State / Province</label>
                <p className="text-lg font-semibold mt-1">{selectedCity.state || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Country</label>
                <p className="text-lg font-semibold mt-1">{selectedCity.country || 'N/A'}</p>
              </div>
              {selectedCity.thumbnail && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Thumbnail</label>
                  <div className="mt-1 w-full h-40 rounded-lg overflow-hidden border">
                    <img
                      src={selectedCity.thumbnail}
                      alt={selectedCity.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-sm text-gray-600 mt-1">{formatDate(selectedCity.createdAt)}</p>
              </div>
              {selectedCity.updatedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm text-gray-600 mt-1">{formatDate(selectedCity.updatedAt)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}