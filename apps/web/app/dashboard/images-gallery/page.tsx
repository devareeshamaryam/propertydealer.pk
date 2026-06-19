 "use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { Upload, Trash2, Search, Image as ImageIcon, Loader2, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { propertyApi } from '@/lib/api';
import api from '@/lib/api';
import { useDebounce } from "@/hooks/useDebounce"

interface ImageItem {
  key: string;
  url: string;
  thumbnailUrl?: string;
  size?: number;
  modified?: string;
}

// ─── Compression ────────────────────────────────────────────────────────────
async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality
      );
    };
    img.src = objectUrl;
  });
}

// ─── Single shared IntersectionObserver ─────────────────────────────────────
const imageObserver =
  typeof window !== 'undefined'
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              const img = e.target as HTMLImageElement;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
              }
              imageObserver!.unobserve(img);
            }
          });
        },
        { rootMargin: '300px' }
      )
    : null;

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !imageObserver) return;
    el.dataset.src = src;
    imageObserver.observe(el);
    return () => imageObserver.unobserve(el);
  }, [src]);
  return (
    <img
      ref={ref}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Not+Found'; }}
    />
  );
}

// ─── Memoized card ───────────────────────────────────────────────────────────
const ImageCard = ({
  image, onPreview, onDelete, formatFileSize, formatDate, getFullImageUrl,
}: {
  image: ImageItem;
  onPreview: (img: ImageItem) => void;
  onDelete: (img: ImageItem) => void;
  formatFileSize: (b?: number) => string;
  formatDate: (d?: string) => string;
  getFullImageUrl: (url: string) => string;
}) => (
  <Card className="group hover:shadow-lg transition-shadow h-full">
    <CardContent className="p-0 h-full flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted flex-shrink-0">
        {/* Thumbnail use karo gallery mein, full image preview mein */}
        <LazyImage
          src={image.thumbnailUrl
            ? getFullImageUrl(image.thumbnailUrl)
            : getFullImageUrl(image.url)}
          alt={image.key}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button size="sm" variant="secondary" onClick={() => onPreview(image)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(image)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <p className="text-sm font-medium truncate" title={image.key}>
          {image.key.split('/').pop()}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatFileSize(image.size)}</span>
          <span>{formatDate(image.modified)}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {image.key.split('/')[0] || 'root'}
        </Badge>
      </div>
    </CardContent>
  </Card>
);

// ─── Constants ───────────────────────────────────────────────────────────────
const COLUMNS = 5;
const CARD_HEIGHT = 260;
const ROW_GAP = 16;
const PAGE_LIMIT = 50;

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ImagesGalleryPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ImageItem | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Fetch with pagination ──────────────────────────────────────────────────
  const fetchImages = useCallback(async (pageNum: number, reset: boolean) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await api.get('/properties/images/list', {
        params: { page: pageNum, limit: PAGE_LIMIT, search: debouncedSearch },
      });

      const { images: newImages, total, totalPages } = res.data;
      setTotalImages(total);
      setImages((prev) => reset ? newImages : [...prev, ...newImages]);
      setHasMore(pageNum < totalPages);
      setPage(pageNum);
    } catch {
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch]);

  // Reset on search change
  useEffect(() => { fetchImages(1, true); }, [fetchImages]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 400;
    if (nearBottom && hasMore && !loadingMore) {
      fetchImages(page + 1, false);
    }
  }, [hasMore, loadingMore, page, fetchImages]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Invalid file type'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB allowed'); return; }

    try {
      setUploading(true);
      const compressed = await compressImage(file);
      const result = await propertyApi.uploadImage(compressed);
      const newImage: ImageItem = {
        key: result.data?.key || `uploads/${Date.now()}-${file.name}`,
        url: result.data?.url || URL.createObjectURL(compressed),
        thumbnailUrl: result.data?.key
          ? `/properties/images/thumbnail/${encodeURIComponent(result.data.key)}`
          : undefined,
        size: compressed.size,
        modified: new Date().toISOString(),
      };
      setImages((prev) => [newImage, ...prev]);
      setTotalImages((t) => t + 1);
      toast.success('Uploaded!');
      e.target.value = '';
    } catch (err: any) {
      toast.error('Upload failed', { description: err.response?.data?.message });
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!imageToDelete) return;
    try {
      await api.delete(`/properties/images/${encodeURIComponent(imageToDelete.key)}`);
      setImages((prev) => prev.filter((img) => img.key !== imageToDelete.key));
      setTotalImages((t) => t - 1);
      toast.success('Deleted!');
      setDeleteDialogOpen(false);
      setImageToDelete(null);
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatFileSize = useCallback((bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }, []);

  const formatDate = useCallback((d?: string) => {
    if (!d) return 'Unknown';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return 'Unknown'; }
  }, []);

  const getFullImageUrl = useCallback((url: string) => {
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    if (url.startsWith('/')) return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
    return url;
  }, []);

  // ── Virtualizer rows ───────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const result: ImageItem[][] = [];
    for (let i = 0; i < images.length; i += COLUMNS) {
      result.push(images.slice(i, i + COLUMNS));
    }
    return result;
  }, [images]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + ROW_GAP,
    overscan: 2,
  });

  const onPreview = useCallback((img: ImageItem) => { setSelectedImage(img); setPreviewDialogOpen(true); }, []);
  const onDelete  = useCallback((img: ImageItem) => { setImageToDelete(img); setDeleteDialogOpen(true); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Images Gallery</h1>
          <p className="text-muted-foreground mt-1">Manage and organize all uploaded images</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <label htmlFor="image-upload">
            <Button asChild disabled={uploading}>
              <span>
                {uploading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                  : <><Upload className="mr-2 h-4 w-4" />Upload Image</>}
              </span>
            </Button>
            <input id="image-upload" type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalImages}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loaded</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{images.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(images.reduce((s, i) => s + (i.size || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">
              {searchQuery ? 'No images found' : 'No images yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          ref={parentRef}
          className="overflow-auto rounded-lg"
          style={{ height: '70vh' }}
          onScroll={handleScroll}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  height: CARD_HEIGHT,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
                  gap: ROW_GAP,
                  paddingBottom: 16,
                }}
              >
 {(rows[virtualRow.index] ?? []).map((image) => (                  <ImageCard
                    key={image.key}
                    image={image}
                    onPreview={onPreview}
                    onDelete={onDelete}
                    formatFileSize={formatFileSize}
                    formatDate={formatDate}
                    getFullImageUrl={getFullImageUrl}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Infinite scroll loader */}
          {loadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.key.split('/').pop()}</DialogTitle>
            <DialogDescription>
              {selectedImage && (
                <div className="space-y-1 mt-2">
                  <p><strong>Path:</strong> {selectedImage.key}</p>
                  <p><strong>Size:</strong> {formatFileSize(selectedImage.size)}</p>
                  <p><strong>Modified:</strong> {formatDate(selectedImage.modified)}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="mt-4">
              {/* Preview mein full quality image */}
              <img
                src={getFullImageUrl(selectedImage.url)}
                alt={selectedImage.key}
                className="w-full h-auto rounded-lg"
              />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => window.open(getFullImageUrl(selectedImage.url), '_blank')}>
                  <Download className="mr-2 h-4 w-4" />Open in New Tab
                </Button>
                <Button variant="destructive" onClick={() => {
                  setPreviewDialogOpen(false);
                  setImageToDelete(selectedImage);
                  setDeleteDialogOpen(true);
                }}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete Image
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          {imageToDelete && (
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <img src={getFullImageUrl(imageToDelete.url)} alt={imageToDelete.key} className="w-full h-full object-cover" />
              </div>
              <p className="text-sm text-muted-foreground"><strong>Path:</strong> {imageToDelete.key}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}