'use client'

import { useState, useEffect } from 'react';
import { Home, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cityApi, propertyApi } from '@/lib/api';
import { sortPropertyTypes } from '@/lib/types/property-utils';

interface AddPropertyModalProps {
  open: boolean;
  onClose: () => void;
}

const AddPropertyModal = ({ open, onClose }: AddPropertyModalProps) => {
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    city: '',
    location: '',
    price: '',
    bedrooms: '',
    bathrooms: '',
    area: '',
    description: '',
    videoUrl: '',
  });

  const [cities, setCities] = useState<any[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [citiesData, typesData] = await Promise.all([
          cityApi.getAll(),
          propertyApi.getTypes()
        ]);
        setCities(citiesData);
        // Capitalize and sort
        const mapped = typesData.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
        setPropertyTypes(sortPropertyTypes(mapped, t => t));
      } catch (error) {
        console.error('Error fetching data for modal:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Property Submitted', {
      description: 'Your property listing has been submitted for review.',
    });
    onClose();
    setFormData({
      title: '',
      type: '',
      city: '',
      location: '',
      price: '',
      bedrooms: '',
      bathrooms: '',
      area: '',
      description: '',
      videoUrl: '',
    });
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Home className="w-7 h-7 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold">
            Add Your Property
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prop-title">Property Title</Label>
              <Input
                id="prop-title"
                placeholder="e.g., Modern Villa with Garden"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Property Type</Label>
              <Select onValueChange={(value) => updateField('type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Select onValueChange={(value) => updateField('city', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="p-2 flex justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    cities.map((city) => (
                      <SelectItem key={city._id || city.name} value={city.name}>
                        {city.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-location">Location</Label>
              <Input
                id="prop-location"
                placeholder="e.g., DHA Phase 5"
                value={formData.location}
                onChange={(e) => updateField('location', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prop-price">Price (Rs.)</Label>
              <Input
                id="prop-price"
                type="number"
                placeholder="45000"
                value={formData.price}
                onChange={(e) => updateField('price', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-beds">Bedrooms</Label>
              <Input
                id="prop-beds"
                type="number"
                placeholder="3"
                value={formData.bedrooms}
                onChange={(e) => updateField('bedrooms', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-baths">Bathrooms</Label>
              <Input
                id="prop-baths"
                type="number"
                placeholder="2"
                value={formData.bathrooms}
                onChange={(e) => updateField('bathrooms', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-area">Area (sq ft)</Label>
              <Input
                id="prop-area"
                type="number"
                placeholder="1800"
                value={formData.area}
                onChange={(e) => updateField('area', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prop-desc">Description</Label>
            <Textarea
              id="prop-desc"
              placeholder="Describe your property..."
              rows={4}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prop-video">YouTube Video URL (Optional)</Label>
            <Input
              id="prop-video"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={formData.videoUrl}
              onChange={(e) => updateField('videoUrl', e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full">
            Submit Property
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPropertyModal;
