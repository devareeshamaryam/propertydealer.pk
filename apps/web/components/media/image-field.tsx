"use client";

import { useRef, useState } from "react";
import { Images, ImageOff, Link2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import mediaApi, { type MediaItem } from "@/lib/api/media/media.api";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { MediaPicker } from "./media-picker";

interface ImageFieldProps {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  /** Media folder new uploads land in. */
  folder?: string;
  /**
   * What the image is of — the property title, the post title. Names the
   * stored file (so the URL reads well) and gives the AI its context.
   */
  context?: string;
  aspect?: "wide" | "square" | "logo" | "banner";
  hint?: string;
  /** Offer the "paste a link" escape hatch. On by default. */
  allowUrl?: boolean;
  className?: string;
}

const ASPECT_CLASS: Record<NonNullable<ImageFieldProps["aspect"]>, string> = {
  wide: "aspect-[16/9]",
  square: "aspect-square w-44",
  logo: "h-28",
  banner: "aspect-[3/1]",
};

/**
 * One image on a form.
 *
 * Replaces the old pattern where a field was a bare "Image URL" input and you
 * had to go to the gallery, upload there, copy the link and come back. Here you
 * can upload straight from the device, drop a file on the box, or pick from the
 * media library — and the link box is still there if you want it.
 */
export function ImageField({
  value,
  onChange,
  label,
  folder = "general",
  context,
  aspect = "wide",
  hint,
  allowUrl = true,
  className,
}: ImageFieldProps) {
  const [picker, setPicker] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setProgress(0);
    try {
      const { items } = await mediaApi.upload([file], {
        folder,
        context: context ?? label,
        onProgress: setProgress,
        noShrink: folder === "branding",
      });
      if (items[0]) {
        setFailed(false);
        onChange(items[0].url);
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

  const pick = (items: MediaItem[]) => {
    if (items[0]) {
      setFailed(false);
      onChange(items[0].url);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <Label>{label}</Label>}

      <div
        className={cn(
          "relative grid max-w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 transition-colors",
          ASPECT_CLASS[aspect],
          !value && "hover:border-primary",
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files?.[0]);
        }}
      >
        {value && !failed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              onError={() => setFailed(true)}
              className={cn(
                "h-full w-full",
                aspect === "logo" ? "object-contain p-3" : "object-cover",
              )}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => onChange("")}
              aria-label="Remove image"
              className="absolute right-2 top-2 h-7 w-7 bg-black/60 text-white hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-1.5 p-4 text-center"
          >
            {progress !== null ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : value && failed ? (
              <ImageOff className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {progress !== null
                ? `Uploading ${Math.round(progress * 100)}%`
                : value && failed
                  ? "That image could not be loaded — upload another"
                  : "Click to upload, or drop an image here"}
            </span>
          </button>
        )}

        {progress !== null && value && !failed && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={progress !== null}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {value ? "Replace" : "Upload"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicker(true)}
        >
          <Images className="mr-1.5 h-3.5 w-3.5" />
          Media library
        </Button>

        {allowUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setUrlMode((previous) => !previous)}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            {urlMode ? "Hide link" : "Use a link"}
          </Button>
        )}
      </div>

      {urlMode && (
        <Input
          value={value ?? ""}
          onChange={(event) => {
            setFailed(false);
            onChange(event.target.value.trim());
          }}
          placeholder="https://…"
        />
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      <MediaPicker
        open={picker}
        onOpenChange={setPicker}
        folder={folder}
        context={context ?? label}
        onSelect={pick}
      />
    </div>
  );
}
