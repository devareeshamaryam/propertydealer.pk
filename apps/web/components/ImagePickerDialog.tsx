"use client";

import { useState } from "react";
import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaLibrary } from "@/components/media/media-library";

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
  /** Folder new uploads land in. */
  folder?: string;
}

/**
 * Choose an image for a field — the logo, the favicon, a blog cover…
 *
 * It used to list the files already on the server with no way to add one,
 * so a new logo meant a trip to another page first. It is now the media
 * library itself: upload (button or drag and drop), then pick — or paste a
 * link. Same props as before, so every field that uses it gets uploads.
 */
export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Choose an image",
  description = "Upload from your device, or pick one you have already uploaded.",
  allowUrlInput = true,
  folder = "general",
}: ImagePickerDialogProps) {
  const [tab, setTab] = useState<"library" | "url">("library");
  const [url, setUrl] = useState("");

  const validUrl = /^(https?:\/\/|\/)/.test(url.trim());

  const close = () => {
    setUrl("");
    setTab("library");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="flex h-[88vh] w-[min(96vw,1100px)] flex-col gap-0 p-0 sm:max-w-[1100px]">
        <DialogHeader className="border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "library" | "url")} className="flex min-h-0 flex-1 flex-col">
          {allowUrlInput && (
            <TabsList className="mx-4 mt-3 grid grid-cols-2 sm:mx-6 sm:w-[340px] sm:self-start">
              <TabsTrigger value="library" className="text-[13px]">
                <ImageIcon className="mr-1.5 hidden h-4 w-4 sm:inline" /> Upload / choose
              </TabsTrigger>
              <TabsTrigger value="url" className="text-[13px]">
                <LinkIcon className="mr-1.5 hidden h-4 w-4 sm:inline" /> Paste a link
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="library" className="mt-0 min-h-0 flex-1 p-4 sm:p-5">
            {open && (
              <MediaLibrary
                mode="select"
                folder={folder}
                onCancel={close}
                onSelect={(items) => {
                  const item = items[0];
                  if (!item) return;
                  onSelect({ url: item.url, key: item.id });
                  close();
                }}
              />
            )}
          </TabsContent>

          {allowUrlInput && (
            <TabsContent value="url" className="mt-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
              <label className="block text-sm font-medium" htmlFor="image-url">
                Image link
              </label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg or /uploads/image.webp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {validUrl && (
                <div className="grid h-56 place-items-center overflow-hidden rounded-lg border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url.trim()} alt="Preview" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!validUrl}
                  onClick={() => {
                    onSelect({ url: url.trim(), key: url.trim() });
                    close();
                  }}
                >
                  Use this link
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
