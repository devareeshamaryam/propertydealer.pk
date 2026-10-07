"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaItem } from "@/lib/api/media/media.api";
import { MediaLibrary } from "./media-library";

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (items: MediaItem[]) => void;
  multiple?: boolean;
  folder?: string;
  max?: number;
  /** Words describing what the images are of — names the file, feeds the AI. */
  context?: string;
  title?: string;
}

/** The media library in a modal, for choosing an image from inside a form. */
export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  folder = "general",
  max,
  context,
  title,
}: MediaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] w-[min(96vw,1100px)] flex-col gap-0 p-0 sm:max-w-[1100px]">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>
            {title ?? (multiple ? "Choose images" : "Choose an image")}
          </DialogTitle>
          <DialogDescription>
            Upload from your device or pick something you have already used.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 p-5">
          <MediaLibrary
            mode="select"
            multiple={multiple}
            folder={folder}
            max={max}
            context={context}
            onCancel={() => onOpenChange(false)}
            onSelect={(items) => {
              onSelect(items);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
