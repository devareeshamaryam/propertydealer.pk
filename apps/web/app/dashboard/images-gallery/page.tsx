"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Upload, 
  Trash2, 
  Search, 
  Image as ImageIcon, 
  Loader2,
  X,
  Download,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { propertyApi } from '@/lib/api';
import api from '@/lib/api';

interface ImageItem {
  key: string;
  url: string;
  size?: number;
  modified?: string;
}

export default function ImagesGalleryPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ImageItem | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Fetch images
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/properties/images/list');
      setImages(response.data.images || []);
    } catch (error: any) {
      console.error('Error fetching images:', error);
      toast.error('Error', {
        description: 'Failed to load images. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Handle image upload
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', {
        description: 'Please upload an image file.',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', {
        description: 'Please upload an image smaller than 10MB.',
      });
      return;
    }

    try {
      setUploading(true);
      const result = await propertyApi.uploadImage(file);
      toast.success('Success', {
        description: 'Image uploaded successfully!',
      });
      // Refresh images list
      await fetchImages();
      // Reset file input
      event.target.value = '';
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error('Error', {
        description: error.response?.data?.message || 'Failed to upload image. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle image delete
  const handleDelete = async () => {
    if (!imageToDelete) return;

    try {
      // Encode the key for the URL
      const encodedKey = encodeURIComponent(imageToDelete.key);
      await api.delete(`/properties/images/${encodedKey}`);
      toast.success('Success', {
        description: 'Image deleted successfully!',
      });
      // Refresh images list
      await fetchImages();
      setDeleteDialogOpen(false);
      setImageToDelete(null);
    } catch (error: any) {
      console.error('Error deleting image:', error);
      toast.error('Error', {
        description: error.response?.data?.message || 'Failed to delete image. Please try again.',
      });
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  // Filter images based on search query
  const filteredImages = images.filter((image) =>
    image.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    image.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get full image URL
  const getFullImageUrl = (url: string): string => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads/')) {
      return `${window.location.origin}${url}`;
    }
    return url;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Images Gallery</h1>
          <p className="text-muted-foreground mt-1">
            Manage and organize all uploaded images
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </>
                )}
              </span>
            </Button>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
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
          <CardContent>
            <div className="text-2xl font-bold">{images.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredImages.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(images.reduce((sum, img) => sum + (img.size || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Images Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredImages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              {searchQuery ? 'No images found' : 'No images uploaded yet'}
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Upload your first image to get started'}
            </p>
            {!searchQuery && (
              <label htmlFor="image-upload">
                <Button asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </span>
                </Button>
              </label>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map((image) => (
            <Card key={image.key} className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
                  <img
                    src={getFullImageUrl(image.url)}
                    alt={image.key}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Image+Not+Found';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedImage(image);
                        setPreviewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setImageToDelete(image);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium truncate" title={image.key}>
                    {image.key.split('/').pop()}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(image.size)}</span>
                    <span>{formatDate(image.modified)}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {image.key.split('/')[0] || 'root'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.key.split('/').pop()}</DialogTitle>
            <DialogDescription>
              {selectedImage && (
                <div className="space-y-2 mt-2">
                  <p><strong>Path:</strong> {selectedImage.key}</p>
                  <p><strong>Size:</strong> {formatFileSize(selectedImage.size)}</p>
                  <p><strong>Modified:</strong> {formatDate(selectedImage.modified)}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="mt-4">
              <img
                src={getFullImageUrl(selectedImage.url)}
                alt={selectedImage.key}
                className="w-full h-auto rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800?text=Image+Not+Found';
                }}
              />
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(getFullImageUrl(selectedImage.url), '_blank');
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Open in New Tab
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setImageToDelete(selectedImage);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Image
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {imageToDelete && (
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <img
                  src={getFullImageUrl(imageToDelete.url)}
                  alt={imageToDelete.key}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Path:</strong> {imageToDelete.key}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
