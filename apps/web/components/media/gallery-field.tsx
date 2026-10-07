"use client";

import { useRef, useState } from "react";
import {
  GripVertical,
  Images,
  ImageOff,
  Loader2,
  Star,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import mediaApi from "@/lib/api/media/media.api";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { MediaPicker } from "./media-picker";

interface GalleryFieldProps {
  /** Ordered image URLs. The first is the cover. */
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  folder?: string;
  /** Words describing the set — the property title. Names files, feeds the AI. */
  context?: string;
  max?: number;
  hint?: string;
  className?: string;
}

/**
 * A set of images on a form, with bulk upload.
 *
 * Built for the case this site actually has: an agent photographing a house on
 * their phone and adding a dozen pictures at once. Select many, drop many,
 * drag to reorder, and the first image is the cover — which is how everyone
 * already expects a listing gallery to behave.
 */
export function GalleryField({
  value,
  onChange,
  label,
  folder = "properties",
  context,
  max = 20,
  hint,
  className,
}: GalleryFieldProps) {
  const [picker, setPicker] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, max - value.length);

  const add = (urls: string[]) => {
    // De-duplicate: picking the same image twice should not add it twice.
    const next = [...value];
    for (const url of urls) {
      if (next.length >= max) break;
      if (!next.includes(url)) next.push(url);
    }
    onChange(next);
  };

  const upload = async (files: File[]) => {
    const images = files.filter(
      (file) =>
        file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name),
    );
    if (!images.length) return;

    if (remaining === 0) {
      toast.error(`You can add up to ${max} images`);
      return;
    }

    const batch = images.slice(0, remaining);
    if (batch.length < images.length) {
      toast.warning(
        `Only ${batch.length} of ${images.length} added — the limit is ${max}`,
      );
    }

    setProgress(0);
    try {
      const { items, failed } = await mediaApi.upload(batch, {
        folder,
        context,
        onProgress: setProgress,
      });
      add(items.map((item) => item.url));

      if (failed.length) {
        toast.error(`${failed.length} could not be uploaded`, {
          description: failed[0]?.error,
        });
      } else if (items.length) {
        toast.success(
          items.length > 1 ? `${items.length} images added` : "Image added",
        );
      }
    } catch (err) {
      toast.error("Upload failed", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const makeCover = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.unshift(moved);
    onChange(next);
  };

  /** Reorder by dragging one tile onto another. */
  const dropOn = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...value];
    const [moved] = next.splice(dragIndex, 1);
    if (moved === undefined) return;
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <span className="text-xs text-muted-foreground">
            {value.length} of {max}
          </span>
        </div>
      )}

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-3 transition-colors",
          dragging ? "border-primary bg-primary/5" : "bg-muted/30",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          // Only highlight for files coming in from outside, not tile reordering.
          if (dragIndex === null) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (dragIndex === null)
            void upload(Array.from(event.dataTransfer.files));
        }}
      >
        {value.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid min-h-[150px] w-full place-items-center text-center"
          >
            <span className="flex flex-col items-center gap-2">
              {progress !== null ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <Upload className="h-7 w-7 text-muted-foreground" />
              )}
              <span className="font-medium">
                {progress !== null
                  ? `Uploading ${Math.round(progress * 100)}%`
                  : "Click to add photos, or drop them here"}
              </span>
              <span className="text-sm text-muted-foreground">
                Choose several at once — up to {max}. The first photo is the
                cover.
              </span>
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {value.map((url, index) => (
              <div
                key={`${url}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dropOn(index);
                }}
                className={cn(
                  "group relative aspect-square cursor-grab overflow-hidden rounded-lg border bg-muted active:cursor-grabbing",
                  dragIndex === index && "opacity-40",
                  index === 0 && "ring-2 ring-primary ring-offset-1",
                )}
              >
                {broken[url] ? (
                  <div className="grid h-full w-full place-items-center">
                    <ImageOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    onError={() =>
                      setBroken((previous) => ({ ...previous, [url]: true }))
                    }
                    className="h-full w-full object-cover"
                  />
                )}

                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </span>
                )}

                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-3.5 w-3.5 text-white/80" />
                  <span className="flex items-center gap-1">
                    {index !== 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => makeCover(index)}
                            aria-label="Make cover photo"
                            className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-amber-600 hover:bg-white"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Make cover</TooltipContent>
                      </Tooltip>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      aria-label="Remove photo"
                      className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-destructive hover:bg-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </span>
              </div>
            ))}

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={progress !== null}
                className="grid aspect-square place-items-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {progress !== null ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5" />
                    <span className="text-[11px] font-medium">Add more</span>
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {progress !== null && (
        <Progress value={Math.max(4, progress * 100)} className="h-1.5" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={progress !== null || remaining === 0}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Upload photos
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicker(true)}
          disabled={remaining === 0}
        >
          <Images className="mr-1.5 h-3.5 w-3.5" />
          Media library
        </Button>
        {value.length > 1 && (
          <span className="text-xs text-muted-foreground">
            Drag a photo to reorder
          </span>
        )}
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(event) => void upload(Array.from(event.target.files ?? []))}
      />

      <MediaPicker
        open={picker}
        onOpenChange={setPicker}
        multiple
        max={remaining}
        folder={folder}
        context={context}
        onSelect={(items) => add(items.map((item) => item.url))}
        title="Add photos from your library"
      />
    </div>
  );
}
