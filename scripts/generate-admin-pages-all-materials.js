const fs = require('fs');
const path = require('path');

const materials = [
  { name: 'Door', slug: 'door', plural: 'Doors', apiSlug: 'door-rate' },
  { name: 'Wood', slug: 'wood', plural: 'Wood', apiSlug: 'wood-rate' },
  { name: 'Sand', slug: 'sand', plural: 'Sand', apiSlug: 'sand-rate' },
  { name: 'Tile', slug: 'tile', plural: 'Tiles', apiSlug: 'tile-rate' },
  { name: 'Bajri', slug: 'bajri', plural: 'Bajri', apiSlug: 'bajri-rate' },
  { name: 'Steel', slug: 'steel', plural: 'Steel', apiSlug: 'steel-rate' },
  { name: 'Bricks', slug: 'bricks', plural: 'Bricks', apiSlug: 'bricks-rate' },
];

const dashboardDir = path.join(__dirname, '../apps/web/app/dashboard');

materials.forEach(material => {
  const moduleDir = path.join(dashboardDir, `${material.slug}-rate`);
  const addDir = path.join(moduleDir, 'add');
  const editDir = path.join(moduleDir, 'edit/[id]');

  // Create directories
  if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir, { recursive: true });
  if (!fs.existsSync(addDir)) fs.mkdirSync(addDir, { recursive: true });
  if (!fs.existsSync(editDir)) fs.mkdirSync(editDir, { recursive: true });

  // ========== LIST PAGE (page.tsx) ==========
  const listPageContent = `'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface ${material.name}Rate {
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

export default function ${material.name}RateListPage() {
  const router = useRouter();
  const [rates, setRates] = useState<${material.name}Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await api.get('/${material.apiSlug}/admin/all');
      setRates(response.data);
    } catch (error) {
      toast.error('Failed to fetch ${material.name.toLowerCase()} rates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ${material.name.toLowerCase()} rate?')) return;
    
    try {
      setDeleting(id);
      await api.delete(\`/${material.apiSlug}/\${id}\`);
      toast.success('${material.name} rate deleted successfully');
      fetchRates();
    } catch (error) {
      toast.error('Failed to delete ${material.name.toLowerCase()} rate');
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
          <h1 className="text-3xl font-bold text-gray-900">All ${material.name} Rates</h1>
          <p className="text-gray-500 mt-1">Manage ${material.name.toLowerCase()} rates for your website</p>
        </div>
        <Button onClick={() => router.push('/dashboard/${material.slug}-rate/add')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add ${material.name} Rate
        </Button>
      </div>

      {rates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No ${material.name.toLowerCase()} rates found. Add your first one!</p>
          <Button onClick={() => router.push('/dashboard/${material.slug}-rate/add')} className="mt-4">
            Add ${material.name} Rate
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
                    <span className={\`font-medium \${rate.change > 0 ? 'text-green-600' : rate.change < 0 ? 'text-red-600' : 'text-gray-600'}\`}>
                      {rate.change > 0 ? '+' : ''}{rate.change}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{rate.city}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{rate.category || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={\`px-2 py-1 rounded-full text-xs font-medium \${rate.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}\`}>
                      {rate.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(\`/dashboard/${material.slug}-rate/edit/\${rate._id}\`)}
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
`;

  fs.writeFileSync(path.join(moduleDir, 'page.tsx'), listPageContent);

  // ========== ADD PAGE ==========
  const addPageContent = `'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Image as ImageIcon, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('@/components/RichEditor'), {
  ssr: false,
  loading: () => <div className="h-96 w-full bg-gray-100 animate-pulse rounded-lg" />,
});

export default function Add${material.name}RatePage() {
  const router = useRouter();
  const mainFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    brand: '', price: '', change: '0', city: '', category: '', 
    unit: '', description: '', isActive: 'true',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extraImages, setExtraImages] = useState<Array<{ file: File; preview: string }>>([]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

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

  const handleExtraSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) return toast.error('Brand name is required');
    if (!form.price || isNaN(Number(form.price))) return toast.error('Valid price is required');
    if (!form.city.trim()) return toast.error('City is required');

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('brand', form.brand.trim());
      fd.append('price', form.price);
      fd.append('change', form.change);
      fd.append('city', form.city.trim());
      fd.append('unit', form.unit || 'Per Unit');
      fd.append('isActive', form.isActive);
      if (form.category.trim()) fd.append('category', form.category.trim());
      fd.append('description', form.description);

      if (imageFile) fd.append('image', imageFile);
      extraImages.forEach(({ file }) => fd.append('images', file));

      await api.post('/${material.apiSlug}', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success('${material.name} rate added successfully!');
      router.push('/dashboard/${material.slug}-rate');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create ${material.name.toLowerCase()} rate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div className="bg-white rounded-xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Add ${material.name} Rate</h1>
        <p className="text-gray-500 text-sm mb-8">This will appear on the public ${material.name} Rate page.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Image */}
          <div className="space-y-2">
            <Label>Main Product Image</Label>
            <input type="file" accept="image/*" onChange={handleMainSelect} className="hidden" ref={mainFileRef} />
            <div
              onClick={() => !imagePreview && mainFileRef.current?.click()}
              className={\`relative border-2 border-dashed rounded-xl transition-colors \${
                imagePreview ? 'border-gray-300' : 'border-gray-300 hover:border-gray-500 cursor-pointer'
              } overflow-hidden\`}
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
                  <span className="text-sm font-medium text-gray-500">Upload Image</span>
                </div>
              )}
            </div>
          </div>

          {/* Extra Images */}
          <div className="space-y-2">
            <Label>Additional Images</Label>
            <input type="file" accept="image/*" multiple onChange={handleExtraSelect} className="hidden" ref={extraFileRef} />
            <div className="flex flex-wrap gap-3">
              {extraImages.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeExtra(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => extraFileRef.current?.click()}
                className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600">
                <Plus className="w-5 h-5" />
                <span className="text-xs">Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand Name *</Label>
            <Input id="brand" value={form.brand} onChange={e => set('brand', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (Rs) *</Label>
              <Input id="price" type="number" min={0} value={form.price} onChange={e => set('price', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="change">Daily Change</Label>
              <Input id="change" type="number" value={form.change} onChange={e => set('change', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" value={form.city} onChange={e => set('city', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="e.g. Per Sq Ft" value={form.unit} onChange={e => set('unit', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichEditor value={form.description} onChange={v => set('description', v)} />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive === 'true'}
              onChange={e => set('isActive', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="isActive" className="cursor-pointer">Active (visible on public pages)</Label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> : 'Save ${material.name} Rate'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/${material.slug}-rate')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
`;

  fs.writeFileSync(path.join(addDir, 'page.tsx'), addPageContent);

  // ========== EDIT PAGE (simplified - just copy add page structure) ==========
  fs.writeFileSync(path.join(editDir, 'page.tsx'), addPageContent.replace(/Add/g, 'Edit'));

  console.log(`✅ Created admin pages for ${material.slug}-rate`);
});

console.log('\n🎉 All admin pages created successfully!');
console.log('\n📝 Next: Update sidebar navigation to include all materials');
