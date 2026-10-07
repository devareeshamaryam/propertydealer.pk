"use client";

import { useRef, useState } from "react";
import { Film, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import mediaApi, { VIDEO_LIMITS, formatBytes } from "@/lib/api/media/media.api";
import { cn } from "@/lib/utils";

interface VideoFieldProps {
  /** The stored video URL, or "" for none. */
  value?: string | null;
  /** Poster frame URL, captured from the video when it was uploaded. */
  posterValue?: string | null;
  onChange: (video: { url: string; posterUrl: string }) => void;
  label?: string;
  /** What the video is of — names the stored file. */
  context?: string;
  folder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * One short walkthrough video per listing.
 *
 * A clip walking through the house does more than twenty photos, and it is the
 * one thing a serious buyer watches before calling. Kept deliberately narrow:
 * one video, hard limits, and the same media library underneath as the photos,
 * so there is no second storage path to maintain.
 *
 * The length check and the poster frame both happen here in the browser — the
 * server has no ffmpeg, and this way the refusal is instant instead of after a
 * 30 MB upload.
 */
export function VideoField({
  value,
  posterValue,
  onChange,
  label = "Walkthrough video (optional)",
  context,
  folder = "properties",
  disabled,
  className,
}: VideoFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [size, setSize] = useState<number | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;

    setProgress(0);
    try {
      const item = await mediaApi.uploadVideo(file, {
        folder,
        context,
        onProgress: setProgress,
      });

      setSize(item.sizeBytes ?? file.size);
      onChange({ url: item.url, posterUrl: item.thumbUrl ?? "" });
      toast.success("Video added", {
        description: item.durationSec
          ? `${Math.round(item.durationSec)} seconds · shown at the end of the photo gallery`
          : "Shown at the end of the photo gallery",
      });
    } catch (error) {
      toast.error("Could not add the video", {
        description: apiErrorMessage(error, "Please try a shorter clip."),
      });
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clear = () => {
    setSize(null);
    onChange({ url: "", posterUrl: "" });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="block text-sm font-semibold text-gray-700">
          {label}
        </Label>
        <span className="text-xs text-gray-500">{VIDEO_LIMITS.label}</span>
      </div>

      {value ? (
        <div className="overflow-hidden rounded-lg border bg-black">
          <video
            key={value}
            src={value}
            poster={posterValue || undefined}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black"
          />
          <div className="flex flex-wrap items-center gap-2 bg-background px-3 py-2">
            <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {size ? formatBytes(size) : "Video attached"} — plays at the end
              of the gallery
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || progress !== null}
              className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={disabled || progress !== null}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || progress !== null}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-center transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60"
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="text-sm font-medium">
                Uploading {Math.round(progress * 100)}%
              </span>
              <span className="text-xs text-gray-500">
                Keep this page open until it finishes
              </span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-gray-400" />
              <span className="text-sm font-medium">Add a walkthrough video</span>
              <span className="text-xs text-gray-500">
                Walk through the property once, phone held upright or sideways —
                buyers watch this before they call
              </span>
            </>
          )}
        </button>
      )}

      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gray-900 transition-[width]"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={VIDEO_LIMITS.accept}
        hidden
        onChange={(event) => void upload(event.target.files?.[0])}
      />
    </div>
  );
}
