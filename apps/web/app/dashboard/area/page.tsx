'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { areaApi } from '@/lib/api/area/area.api';
import { cityApi } from '@/lib/api/city/city.api';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';

import { Loader2, Eye, Edit, Trash2, Plus } from 'lucide-react';
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

interface Area {
  _id: string;
  name: string;
  city: string | {
    _id: string;
    name: string;
    state?: string;
    country?: string;
  };
}

interface City {
  _id: string;
  name: string;
  state?: string;
  country?: string;
}

export default function DashboardAreaPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch all areas
        const areasData = await areaApi.getAll();
        setAreas(Array.isArray(areasData) ? areasData : []);

        // Fetch all cities for display
        const citiesData = await cityApi.getAll();
        setCities(Array.isArray(citiesData) ? citiesData : []);
      } catch (err) {
        console.error('Error fetching areas:', err);
        setError('Failed to load areas. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleView = async (areaId: string) => {
    try {
      const area = await areaApi.getById(areaId);
      setSelectedArea(area);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to load area details.',
      });
    }
  };

  const handleEdit = (areaId: string) => {
    router.push(`/dashboard/area/edit/${areaId}`);
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('Are you sure you want to delete this area? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(areaId);
      await areaApi.delete(areaId);
      toast.success('Area deleted successfully!');
      // Refresh the list
      const data = await areaApi.getAll();
      setAreas(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error deleting area:', error);
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to delete area. Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getCityName = (area: Area): string => {
    if (typeof area.city === 'string') {
      const city = cities.find(c => c._id === area.city);
      return city?.name || 'Unknown City';
    }
    return area.city?.name || 'Unknown City';
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
              Areas Dashboard
            </h2>
            <p className="text-gray-600">
              Manage all areas for property listings
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/area/add-area')}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Area
          </Button>
        </div>
      </div>

      {/* Areas Table */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">Loading areas...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : areas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No areas found.</p>
            <Button onClick={() => router.push('/dashboard/area/add-area')}>
              Add Your First Area
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={area._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[200px]">
                      <p className="truncate">{area.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getCityName(area)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate((area as any).createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(area._id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(area._id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(area._id)}
                            disabled={deletingId === area._id}
                          >
                            {deletingId === area._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
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

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Area Details</DialogTitle>
            <DialogDescription>
              View detailed information about this area
            </DialogDescription>
          </DialogHeader>
          {selectedArea && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Area Name</label>
                <p className="text-lg font-semibold mt-1">{selectedArea.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">City</label>
                <p className="text-lg font-semibold mt-1">{getCityName(selectedArea)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-lg font-semibold mt-1">
                  {formatDate((selectedArea as any).createdAt)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
