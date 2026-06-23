"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Image as ImageIcon, Loader2, Check, Link as LinkIcon, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api, { propertyApi } from "@/lib/api";

// ─── Image Compression Utility ──────────────────────────────────────────────
async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.src = objectUrl;
  });
}

export interface GalleryImageItem {
  key: string;
  url: string;
  size?: number;
  modified?: string;
}

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: GalleryImageItem | { url: string; key: string }) => void;
  title?: string;
  description?: string;
  allowUrlInput?: boolean;
}

export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Choose Image from Gallery",
  description = "Select an existing image, upload a new one, or enter a custom URL.",
  allowUrlInput = true,
}: ImagePickerDialogProps) {
  const [images, setImages] = useState<GalleryImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState<"gallery" | "upload" | "url">("gallery");

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/properties/images/list");
      setImages(response.data.images || []);
    } catch (error) {
      console.error("Error fetching images for picker:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchImages();
      setActiveTab("gallery"); // Reset to gallery tab on open
    }
  }, [open, fetchImages]);

  const filteredImages = images.filter((image) =>
    image.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    image.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFullImageUrl = (url: string): string => {
    if (url.startsWith("http")) return url;
    if (typeof window !== "undefined" && url.startsWith("/uploads/")) {
      return `${window.location.origin}${url}`;
    }
    return url;
  };

  const handleConfirm = () => {
    if (activeTab === "gallery") {
      if (!selectedKey) return;
      const image = images.find((img) => img.key === selectedKey);
      if (!image) return;
      onSelect(image);
    } else if (activeTab === "url") {
      if (!urlInput.trim()) return;
      onSelect({ url: urlInput.trim(), key: urlInput.trim() });
    }
    onOpenChange(false);
  };

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url.trim());
      return true;
    } catch {
      return url.trim().startsWith("/") || url.trim().startsWith("./");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "gallery" | "upload" | "url")}>
            <TabsList className={`grid w-full ${allowUrlInput ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="gallery">
                <ImageIcon className="w-4 h-4 mr-2" />
                Gallery
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload New
              </TabsTrigger>
              {allowUrlInput && (
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Enter URL
                </TabsTrigger>
              )}
            </TabsList>

            {/* GALLERY TAB */}
            <TabsContent value="gallery" className="space-y-4 mt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search images..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchImages}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing
                    </>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium mb-1">No images found</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Upload new images using the "Upload New" tab or manage them in the Images Gallery page.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {filteredImages.map((image) => {
                    const isSelected = selectedKey === image.key;
                    return (
                      <Card
                        key={image.key}
                        className={`group cursor-pointer transition-shadow hover:shadow-md ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedKey(image.key)}
                      >
                        <CardContent className="p-0">
                          <div className="relative aspect-square overflow-hidden rounded-t-md bg-muted">
                            <img
                              src={getFullImageUrl(image.url)}
                              alt={image.key}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Check className="h-8 w-8 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="p-2 space-y-1">
                            <p className="text-xs font-medium truncate" title={image.key}>
                              {image.key.split("/").pop()}
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              {image.key.split("/")[0] || "root"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* UPLOAD TAB */}
            <TabsContent value="upload" className="space-y-4 mt-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg p-10 hover:bg-muted/10 transition-colors cursor-pointer relative group min-h-[250px]">
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      toast.error("Invalid file type. Please upload an image.");
                      return;
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("File too large. Max 10MB allowed.");
                      return;
                    }

                    try {
                      setUploading(true);
                      toast.info("Compressing image...");
                      const compressed = await compressImage(file);
                      
                      toast.info("Uploading image to gallery...");
                      const result = await propertyApi.uploadImage(compressed);
                      
                      if (result?.data?.url) {
                        const url = result.data.url;
                        const key = result.data.key || `uploads/properties/${file.name}`;
                        
                        toast.success("Image uploaded and selected successfully!");
                        
                        // Select the image and close dialog
                        onSelect({ url, key });
                        onOpenChange(false);
                        
                        // Reset picker state
                        setUrlInput("");
                        setSelectedKey(null);
                      } else {
                        throw new Error("Failed to receive image URL");
                      }
                    } catch (err: any) {
                      console.error("Upload error:", err);
                      toast.error("Upload failed: " + (err.response?.data?.message || err.message));
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium">Uploading and processing image...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                    <p className="text-sm font-medium">Click to choose or drag an image here</p>
                    <p className="text-xs text-muted-foreground">JPEG, PNG, WEBP, GIF up to 10MB (automatically compressed)</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* URL INPUT TAB */}
            {allowUrlInput && (
              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Image URL
                    </label>
                    <Input
                      placeholder="https://example.com/image.jpg or /uploads/image.jpg"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a full URL (http:// or https://) or a relative path (/uploads/...)
                    </p>
                  </div>
                  {urlInput && isValidUrl(urlInput) && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Preview:</p>
                      <div className="relative w-full h-64 rounded-lg overflow-hidden bg-muted border">
                        <img
                          src={urlInput.trim().startsWith("http") ? urlInput.trim() : 
                               urlInput.trim().startsWith("/") ? `${typeof window !== "undefined" ? window.location.origin : ""}${urlInput.trim()}` : 
                               urlInput.trim()}
                          alt="URL preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="flex items-center justify-center h-full text-muted-foreground">Failed to load image</div>';
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUrlInput("");
                setSelectedKey(null);
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            {activeTab !== "upload" && (
              <Button
                type="button"
                size="sm"
                disabled={
                  activeTab === "gallery" ? !selectedKey : !urlInput.trim() || !isValidUrl(urlInput)
                }
                onClick={handleConfirm}
              >
                {activeTab === "gallery" ? "Use Selected Image" : "Use URL"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}