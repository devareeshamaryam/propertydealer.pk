 'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

interface Subcategory {
  name: string;
  slug: string;
}

function generateSlug(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function EditTileCategoryPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    order: 0,
    isActive: true,
  });

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [newSub, setNewSub] = useState({ name: '', slug: '' });

  useEffect(() => {
    fetchCategory();
  }, [id]);

  const fetchCategory = async () => {
    try {
      const response = await api.get(`/tile-category/${id}`);
      const cat = response.data;
      setForm({
        name: cat.name,
        slug: cat.slug,
        order: cat.order ?? 0,
        isActive: cat.isActive,
      });
      setSubcategories(cat.subcategories ?? []);
      if (cat.image) setImagePreview(cat.image);
    } catch (error) {
      toast.error('Failed to fetch category');
      router.push('/dashboard/tile-category');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addSubcategory = () => {
    if (!newSub.name.trim()) return;
    setSubcategories((prev) => [
      ...prev,
      { name: newSub.name.trim(), slug: newSub.slug || generateSlug(newSub.name) },
    ]);
    setNewSub({ name: '', slug: '' });
  };

  const removeSubcategory = (index: number) => {
    setSubcategories((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSubcategoryName = (i: number, value: string) => {
    setSubcategories((prev) => {
      const updated = [...prev];
      const current = updated[i];
      if (!current) return prev;
      updated[i] = { name: value, slug: current.slug };
      return updated;
    });
  };

  const updateSubcategorySlug = (i: number, value: string) => {
    setSubcategories((prev) => {
      const updated = [...prev];
      const current = updated[i];
      if (!current) return prev;
      updated[i] = { name: current.name, slug: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      setSaving(true);

      if (imageFile) {
        const formData = new FormData();
        formData.append('name', form.name.trim());
        formData.append('slug', form.slug.trim());
        formData.append('order', String(form.order));
        formData.append('isActive', String(form.isActive));
        formData.append('subcategories', JSON.stringify(subcategories));
        formData.append('image', imageFile);
        await api.put(`/tile-category/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.put(`/tile-category/${id}`, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          order: form.order,
          isActive: form.isActive,
          subcategories,
        });
      }

      toast.success('Category updated successfully!');
      router.push('/dashboard/tile-category');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update category');
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Tile Category</h1>
          <p className="text-gray-500 mt-1">Update category details and subcategories</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-5">

        {/* Name */}
        <div className="space-y-1.5">
          <Label>Category Name *</Label>
          <Input
            placeholder="e.g. Floor Tiles"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            placeholder="floor-tiles"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <p className="text-xs text-gray-400">URL-friendly identifier</p>
        </div>

        {/* Image */}
        <div className="space-y-1.5">
          <Label>Category Image</Label>
          {imagePreview && (
            <img src={imagePreview} alt="Current" className="w-32 h-24 object-cover rounded-lg border mb-2" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="text-xs text-gray-400">Upload new image to replace current one</p>
        </div>

        {/* Order */}
        <div className="space-y-1.5">
          <Label>Display Order</Label>
          <Input
            type="number"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
            className="w-32"
          />
          <p className="text-xs text-gray-400">Lower number = shown first</p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isActive"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="accent-black w-4 h-4"
          />
          <Label htmlFor="isActive" className="cursor-pointer">Active (visible on website)</Label>
        </div>

        {/* Subcategories */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Subcategories</Label>

          {subcategories.length > 0 && (
            <div className="space-y-2">
              {subcategories.map((sub, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex-1 flex gap-3">
                    <Input
                      value={sub.name}
                      onChange={(e) => updateSubcategoryName(i, e.target.value)}
                      className="text-sm"
                      placeholder="Name"
                    />
                    <Input
                      value={sub.slug}
                      onChange={(e) => updateSubcategorySlug(i, e.target.value)}
                      className="text-sm font-mono"
                      placeholder="slug"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeSubcategory(i)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">Name</Label>
              <Input
                placeholder="e.g. Ceramic Floor Tiles"
                value={newSub.name}
                onChange={(e) => setNewSub((s) => ({
                  ...s,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                }))}
                onKeyDown={(e) => e.key === 'Enter' && addSubcategory()}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">Slug</Label>
              <Input
                placeholder="ceramic-floor-tiles"
                value={newSub.slug}
                onChange={(e) => setNewSub((s) => ({ ...s, slug: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addSubcategory()}
              />
            </div>
            <Button variant="outline" onClick={addSubcategory} className="mb-0.5">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-400">Press Enter or click + to add subcategory</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}