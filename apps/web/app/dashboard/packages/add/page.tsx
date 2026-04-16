'use client'

import { useState } from 'react';
import { packageApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function AddPackagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    propertyLimit: '',
    featuredListings: '0',
    photosPerProperty: '5',
    features: '',
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dto = {
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        propertyLimit: parseInt(formData.propertyLimit),
        featuredListings: parseInt(formData.featuredListings),
        photosPerProperty: parseInt(formData.photosPerProperty),
        features: formData.features.split(',').map(f => f.trim()).filter(Boolean),
      };

      await packageApi.create(dto);
      router.push('/dashboard/packages');
    } catch (err) {
      console.error('Error creating package:', err);
      alert('Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Create New Package
        </h2>
        <p className="text-gray-600">
          Define a subscription package for users to list properties
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Package Name *</label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Basic, Premium, Enterprise"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Price (PKR) *</label>
            <Input
              required
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="e.g., 5000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Duration (Days) *</label>
            <Input
              required
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="e.g., 30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Property Limit *</label>
            <Input
              required
              type="number"
              value={formData.propertyLimit}
              onChange={(e) => setFormData({ ...formData, propertyLimit: e.target.value })}
              placeholder="e.g., 5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Featured Listings</label>
            <Input
              type="number"
              value={formData.featuredListings}
              onChange={(e) => setFormData({ ...formData, featuredListings: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Photos Per Property</label>
            <Input
              type="number"
              value={formData.photosPerProperty}
              onChange={(e) => setFormData({ ...formData, photosPerProperty: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Package description"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Features (comma-separated)</label>
          <Textarea
            value={formData.features}
            onChange={(e) => setFormData({ ...formData, features: e.target.value })}
            placeholder="e.g., Priority support, Featured badge, Premium placement"
            rows={3}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
          />
          <label htmlFor="isActive" className="text-sm font-medium">
            Active (users can purchase this package)
          </label>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Package'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
