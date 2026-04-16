'use client'
import { useEffect, useState } from 'react';
import { propertyApi } from '@/lib/api';
import { BackendProperty } from '@/lib/types/property-utils';
import { Loader2, Eye, Edit, Trash2, RefreshCcw, Check, X } from 'lucide-react';
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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';
const PropertyMap = dynamic(() => import('@/components/PropertyMap'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Map...</div>
})
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DashboardHome() {
  const [properties, setProperties] = useState<BackendProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<BackendProperty | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const router = useRouter();
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await propertyApi.getAllProperties();
        setProperties(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching properties:', err);
        setError('Failed to load properties. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const handleView = async (propertyId: string) => {
    try {
      const property = await propertyApi.getPropertyById({ id: propertyId });
      setSelectedProperty(property);
      setViewDialogOpen(true);
    } catch (error: any) {
      console.error('Error fetching property:', error);
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to load property details.',
      });
    }
  };

  const updateStatus = async (propertyId: string) => {
    try {
      const response = await propertyApi.updateStatus(propertyId);
      console.log(response);
      if (response.success) {
        toast.success('Status updated successfully');
        // Refresh the list
        const data = await propertyApi.getAllProperties();
        setProperties(Array.isArray(data) ? data : []);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

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
              {isAdmin ? 'Properties Dashboard' : 'My Listings'}
            </h2>
            <p className="text-gray-600">
              {isAdmin ? 'Manage all property listings' : 'Manage your property listings'}
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/property/add-property')}>
            Add New Property
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
            <Button onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No properties found.</p>
            <Button onClick={() => router.push('/dashboard/property/add-property')}>
              Add Your First Property
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[200px]">
                      <p className="truncate">{property.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {property.bedrooms} Beds • {property.bathrooms} Baths • {property.areaSize || 0} sq ft
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {property.propertyType.charAt(0).toUpperCase() + property.propertyType.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px]">
                      <p className="truncate text-sm">{property.location}</p>
                      <p className="text-xs text-gray-500">{property.city}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">
                        Rs. {property.price.toLocaleString('en-PK')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {property.listingType === 'rent' ? 'Monthly' : 'Total'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(property.status)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(property.createdAt)}
                  </TableCell>



                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn btn-sm rounded-md hover:bg-green-50"
                          onClick={() => updateStatus(property._id)}
                          title={property.status === 'approved' ? 'Unapprove' : 'Approve'}
                        >
                          {property.status === 'approved' ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-600" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(property._id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Link
                            href={`/dashboard/property/edit/${property._id}`}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                            title="Edit Property"
                          >
                            <Edit className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
                                try {
                                  await propertyApi.delete(property._id);
                                  toast.success('Property deleted successfully!');
                                  // Refresh the list
                                  const data = await propertyApi.getAllProperties();
                                  setProperties(Array.isArray(data) ? data : []);
                                } catch (error: any) {
                                  console.error('Error deleting property:', error);
                                  toast.error('Error', {
                                    description: error?.response?.data?.message || 'Failed to delete property. Please try again.',
                                  });
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* View Property Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Property Details</DialogTitle>
            <DialogDescription>
              View detailed information about this property
            </DialogDescription>
          </DialogHeader>
          {selectedProperty && (
            <div className="space-y-6">
              {/* Main Image */}
              {selectedProperty.mainPhotoUrl && (
                <div>
                  <img
                    src={selectedProperty.mainPhotoUrl}
                    alt={selectedProperty.title}
                    className="w-full h-64 object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/800x400?text=No+Image';
                    }}
                  />
                </div>
              )}

              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Title</label>
                  <p className="text-lg font-semibold mt-1">{selectedProperty.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Property Type</label>
                  <p className="text-lg font-semibold mt-1">
                    {selectedProperty.propertyType.charAt(0).toUpperCase() + selectedProperty.propertyType.slice(1)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Listing Type</label>
                  <p className="text-lg font-semibold mt-1">
                    {selectedProperty.listingType === 'rent' ? 'For Rent' : 'For Sale'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedProperty.status)}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-gray-500">Location</label>
                <p className="text-lg font-semibold mt-1">{selectedProperty.location}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {(() => {
                    const cityName = selectedProperty.area && typeof selectedProperty.area === 'object' && selectedProperty.area.city
                      ? selectedProperty.area.city.name
                      : selectedProperty.city || 'N/A';
                    const areaName = selectedProperty.area && typeof selectedProperty.area === 'object'
                      ? selectedProperty.area.name
                      : '';
                    return `${cityName}${areaName ? `, ${areaName}` : ''}`;
                  })()}
                </p>
              </div>

              {/* Map View */}
              {(selectedProperty as any).latitude && (selectedProperty as any).longitude && (
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Map Location</label>
                  <PropertyMap
                    latitude={(selectedProperty as any).latitude}
                    longitude={(selectedProperty as any).longitude}
                    title={selectedProperty.title}
                  />
                </div>
              )}

              {/* Property Details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Bedrooms</label>
                  <p className="text-lg font-semibold mt-1">{selectedProperty.bedrooms}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Bathrooms</label>
                  <p className="text-lg font-semibold mt-1">{selectedProperty.bathrooms}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Area Size</label>
                  <p className="text-lg font-semibold mt-1">{selectedProperty.areaSize || 0} sq ft</p>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-sm font-medium text-gray-500">
                  {selectedProperty.listingType === 'rent' ? 'Monthly Rent' : 'Total Price'}
                </label>
                <p className="text-2xl font-bold text-primary mt-1">
                  Rs. {selectedProperty.price.toLocaleString('en-PK')}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                  {selectedProperty.description || 'No description provided.'}
                </p>
              </div>

              {/* Features */}
              {selectedProperty.features && selectedProperty.features.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Features & Amenities</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedProperty.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">• {feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Photos */}
              {selectedProperty.additionalPhotosUrls && selectedProperty.additionalPhotosUrls.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Additional Photos</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {selectedProperty.additionalPhotosUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Additional ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div>
                <label className="text-sm font-medium text-gray-500">Contact Number</label>
                <p className="text-lg font-semibold mt-1">{selectedProperty.contactNumber}</p>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm text-gray-600 mt-1">{formatDate(selectedProperty.createdAt)}</p>
                </div>
                {selectedProperty.updatedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="text-sm text-gray-600 mt-1">{formatDate(selectedProperty.updatedAt)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  );
}