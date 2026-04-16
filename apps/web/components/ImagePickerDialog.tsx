"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Image as ImageIcon, Loader2, Check, Link as LinkIcon } from "lucide-react";
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
import api from "@/lib/api";

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
  description = "Select an existing image or upload a new one from the gallery page.",
  allowUrlInput = true,
}: ImagePickerDialogProps) {
  const [images, setImages] = useState<GalleryImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState<"gallery" | "url">("gallery");

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
    } else {
      // URL input mode
      if (!urlInput.trim()) return;
      // Validate URL
      try {
        new URL(urlInput.trim());
        onSelect({ url: urlInput.trim(), key: urlInput.trim() });
      } catch {
        // Invalid URL, but we'll still allow it (could be relative path)
        onSelect({ url: urlInput.trim(), key: urlInput.trim() });
      }
    }
    onOpenChange(false);
  };

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url.trim());
      return true;
    } catch {
      // Check if it's a relative path
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
          {allowUrlInput ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "gallery" | "url")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gallery">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Gallery
                </TabsTrigger>
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Enter URL
                </TabsTrigger>
              </TabsList>

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
                      Go to the Images Gallery in the dashboard to upload images. Once
                      uploaded, you can select them here.
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
            </Tabs>
          ) : (
            // Fallback to gallery-only mode if allowUrlInput is false
            <>
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
                    Go to the Images Gallery in the dashboard to upload images. Once
                    uploaded, you can select them here.
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
            </>
          )}

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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

 
