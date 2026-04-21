'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Image as ImageIcon, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import materialRateApi from '@/lib/api/material-rate/material-rate.api';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('@/components/RichEditor'), {
  ssr: false,
  loading: () => <div className="h-96 w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Editor...</div>,
});

const MATERIAL_TYPES = ['Door', 'Wood', 'Sand', 'Tile', 'Bajri', 'Steel', 'Bricks'];
const UNITS = ['Per Unit', 'Per Sq Ft', 'Per Cubic Foot', 'Per Kg', 'Per Ton', 'Per Piece', 'Per Bag'];

interface ExtraImage {
  file: File;
  preview: string;
}

export default function AddMaterialRatePage() {
  const router = useRouter();
  const mainFileRef  = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    materialType: 'Door', brand: '', price: '', change: '0',
    city: '', category: '', unit: 'Per Unit', description: '', isActive: 'true',
  });

  // Main image
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Extra images
  const [extraImages, setExtraImages] = useState<ExtraImage[]>([]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  // ── Main image handlers ──────────────────────────────────────────────────
  const handleMainSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeMain = () => {
    setImageFile(null);
    setImagePreview(null);
    if (mainFileRef.current) mainFileRef.current.value = '';
  };

  // ── Extra images handlers ────────────────────────────────────────────────
  const handleExtraSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExtraImages(prev => [...prev, { file, preview: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });

    if (extraFileRef.current) extraFileRef.current.value = '';
  };

  const removeExtra = (index: number) => {
    setExtraImages(prev => prev.filter((_, i) => i !== index));
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) return toast.error('Brand name is required');
    if (!form.price || isNaN(Number(form.price))) return toast.error('Valid price is required');
    if (!form.city.trim()) return toast.error('City is required');

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('brand',       form.brand.trim());
      fd.append('price',       form.price);
      fd.append('change',      form.change);
      fd.append('city',        form.city.trim());
      fd.append('materialType', form.materialType.toLowerCase());
      fd.append('unit',        form.unit);
      fd.append('isActive',    form.isActive);
      if (form.category.trim()) fd.append('category', form.category.trim());
      fd.append('description', form.description);

      if (imageFile) fd.append('image', imageFile);

      // Append all extra images
      extraImages.forEach(({ file }) => fd.append('images', file));

      await materialRateApi.createRate(fd);
      toast.success('Material rate added successfully!');
      router.push('/dashboard/material-rate');
    } catch (err: any) {
      toast.error('Error', { description: err?.response?.data?.message || 'Failed to create material rate.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Add Material Rate</h1>
        <p className="text-gray-500 text-sm mb-8">This will appear as a card on the public Material Rate pages.</p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Material Type ──────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Material Type *</Label>
            <Select value={form.materialType} onValueChange={v => set('materialType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* ── Main Image ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Main Product Image</Label>
            <input type="file" accept="image/*" onChange={handleMainSelect}
              className="hidden" ref={mainFileRef} />
            <div
              onClick={() => !imagePreview && mainFileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl transition-colors ${
                imagePreview ? 'border-gray-300' : 'border-gray-300 hover:border-gray-500 cursor-pointer'
              } overflow-hidden`}
              style={{ aspectRatio: '1/1', maxWidth: 220 }}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeMain(); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <ImageIcon className="w-10 h-10 text-gray-300" />
                  <span className="text-sm font-medium text-gray-500">Upload Main Image</span>
                  <span className="text-xs text-gray-400">Click to select</span>
                </div>
              )}
            </div>
            {imagePreview && (
              <button type="button" onClick={() => mainFileRef.current?.click()}
                className="text-xs text-blue-600 hover:underline">Change image</button>
            )}
          </div>

          {/* ── Extra Images (carousel) ─────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Additional Images <span className="text-gray-400 font-normal">(optional — shown in carousel)</span></Label>
            <input type="file" accept="image/*" multiple onChange={handleExtraSelect}
              className="hidden" ref={extraFileRef} />

            <div className="flex flex-wrap gap-3">
              {extraImages.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeExtra(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Add more button */}
              <button type="button" onClick={() => extraFileRef.current?.click()}
                className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-500 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <Plus className="w-5 h-5" />
                <span className="text-xs">Add</span>
              </button>
            </div>
            <p className="text-xs text-gray-400">You can select multiple images at once</p>
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand Name *</Label>
            <Input id="brand" placeholder="e.g. Ch. Steel"
              value={form.brand} onChange={e => set('brand', e.target.value)} required />
          </div>

          {/* Price + Change */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (Rs) *</Label>
              <Input id="price" type="number" min={0} placeholder="e.g. 180000"
                value={form.price} onChange={e => set('price', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="change">Daily Price Change</Label>
              <Input id="change" type="number" placeholder="e.g. +500 or -200"
                value={form.change} onChange={e => set('change', e.target.value)} />
              <p className="text-xs text-gray-400">Positive = up, Negative = down</p>
            </div>
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" placeholder="e.g. Lahore"
              value={form.city} onChange={e => set('city', e.target.value)} required />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input id="category" placeholder="e.g. Structural Steel"
                value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={v => set('unit', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichEditor value={form.description} onChange={v => set('description', v)} />
          </div>

          {/* isActive toggle */}
          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive === 'true'}
              onChange={e => set('isActive', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isActive" className="cursor-pointer">Active (visible on public pages)</Label>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex items-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Material Rate'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/material-rate')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
