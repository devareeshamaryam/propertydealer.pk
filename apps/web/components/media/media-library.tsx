"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, FolderInput, ImageOff, Info, Loader2, Play, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import mediaApi, {
  formatBytes,
  MEDIA_FOLDER_LABELS,
  type MediaItem,
  type MediaStats,
} from "@/lib/api/media/media.api";
import { ConfirmDialog, useConfirm } from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface MediaLibraryProps {
  /** "select" is the picker inside a form; "manage" is the Media Library page. */
  mode: "select" | "manage";
  multiple?: boolean;
  /** Folder new uploads land in, and the initial filter. */
  folder?: string;
  /** Cap on how many can be selected at once. */
  max?: number;
  /** Words describing what the images are of — names the file, feeds the AI. */
  context?: string;
  onSelect?: (items: MediaItem[]) => void;
  onCancel?: () => void;
}

/**
 * WordPress-style media library: upload (button or drag and drop anywhere in
 * the panel), browse, search, filter by folder, select, edit title/alt/caption,
 * have the AI rewrite them, copy the link, delete.
 *
 * The API scopes every read to the caller, so an agent only ever sees their own
 * uploads here while an admin sees the whole library.
 */
export function MediaLibrary({
  mode,
  multiple = false,
  folder = "general",
  max,
  context,
  onSelect,
  onCancel,
}: MediaLibraryProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("");
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      setLoading(true);
      try {
        const result = await mediaApi.list({
          page: nextPage,
          limit: 40,
          search,
          folder: folderFilter || undefined,
          // A photo field must not offer a video to pick; the Media Library
          // page itself shows everything.
          kind: mode === "select" ? "image" : undefined,
        });
        setItems((previous) =>
          append ? [...previous, ...result.items] : result.items,
        );
        setPage(result.page);
        setPages(result.pages);
        setTotal(result.total);
      } catch (err) {
        toast.error("Could not load the media library", {
          description: apiErrorMessage(err, "Please try again."),
        });
      } finally {
        setLoading(false);
      }
    },
    [search, folderFilter, mode],
  );

  // Debounced on search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(1, false), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    mediaApi
      .stats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  /**
   * Alt text is written in the background, so a freshly uploaded tile shows
   * "AI is writing…" for a moment. Poll just those rows until they settle.
   */
  useEffect(() => {
    const pendingIds = items
      .filter((item) => item.aiStatus === "pending")
      .map((i) => i.id);
    if (pendingIds.length === 0) return;

    const timer = setTimeout(async () => {
      const refreshed = await Promise.all(
        pendingIds.slice(0, 12).map((id) =>
          mediaApi
            .list({ page: 1, limit: 1, search: id })
            .then(() => null)
            .catch(() => null),
        ),
      );
      void refreshed;
      // Simplest correct refresh: re-read the current page.
      void load(1, false);
    }, 4000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.id}:${i.aiStatus}`).join(",")]);

  /** Admin-only: index what is already in storage. */
  const runImport = async () => {
    try {
      setImporting(true);
      const result = await mediaApi.importExisting();

      if (result.imported === 0) {
        toast.info("Nothing new to import", {
          description: `${result.scanned} files checked — all of them are already listed.`,
        });
      } else {
        toast.success(`Imported ${result.imported} images`, {
          description: "Their files were not changed — only listed here.",
        });
      }

      await load(1, false);
    } catch (error) {
      toast.error("Could not import", {
        description: apiErrorMessage(error, "Please try again."),
      });
    } finally {
      setImporting(false);
    }
  };

  const doUpload = async (files: File[]) => {
    const images = files.filter(
      (file) =>
        file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name),
    );
    if (!images.length) {
      toast.error("Choose image files");
      return;
    }

    setProgress(0);
    try {
      const { items: uploaded, failed } = await mediaApi.upload(
        images.slice(0, 20),
        {
          folder: folderFilter || folder,
          context,
          onProgress: setProgress,
        },
      );

      setItems((previous) => [...uploaded, ...previous]);
      setTotal((previous) => previous + uploaded.length);

      if (failed.length) {
        toast.error(`${failed.length} could not be uploaded`, {
          description: failed[0]?.error,
        });
      } else {
        toast.success(
          uploaded.length > 1
            ? `${uploaded.length} images uploaded`
            : "Image uploaded",
        );
      }

      // What someone just uploaded is almost always what they want to use.
      if (mode === "select" && uploaded.length) {
        setSelected((previous) =>
          multiple
            ? [...uploaded, ...previous].slice(0, max ?? 99)
            : uploaded.slice(0, 1),
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

  const toggle = (item: MediaItem) => {
    if (mode === "manage") {
      setDetail(item);
      return;
    }
    setSelected((previous) => {
      const isOn = previous.some((x) => x.id === item.id);
      if (!multiple) return isOn ? [] : [item];
      if (isOn) return previous.filter((x) => x.id !== item.id);
      if (max && previous.length >= max) {
        toast.error(`You can choose up to ${max} images`);
        return previous;
      }
      return [...previous, item];
    });
  };

  const requestDelete = (item: MediaItem) =>
    confirm({
      title: "Delete this image?",
      description:
        "It will be removed from the library and from storage. Anywhere it is already used will show a missing image.",
      confirmLabel: "Delete image",
      onConfirm: async () => {
        try {
          await mediaApi.remove(item.id);
          setItems((previous) => previous.filter((x) => x.id !== item.id));
          setSelected((previous) => previous.filter((x) => x.id !== item.id));
          setTotal((previous) => Math.max(0, previous - 1));
          setDetail(null);
          toast.success("Image deleted");
        } catch (err) {
          toast.error("Could not delete", {
            description: apiErrorMessage(err, "Please try again."),
          });
        }
      },
    });

  const applyUpdate = (updated: MediaItem) => {
    setItems((previous) =>
      previous.map((x) => (x.id === updated.id ? updated : x)),
    );
    setDetail(updated);
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void doUpload(Array.from(event.dataTransfer.files));
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={progress !== null}
        >
          {progress !== null ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {progress !== null
            ? `Uploading ${Math.round(progress * 100)}%`
            : "Upload images"}
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(event) =>
            void doUpload(Array.from(event.target.files ?? []))
          }
        />

        <div className="relative w-full flex-1 sm:min-w-[180px] sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file name or alt text…"
            className="pl-9"
          />
        </div>

        {isAdmin && (
          <Select
            value={folderFilter || "all"}
            onValueChange={(value) =>
              setFolderFilter(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by folder">
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {Object.entries(MEDIA_FOLDER_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {progress !== null && (
        <Progress value={Math.max(4, progress * 100)} className="mb-3 h-1.5" />
      )}

      <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
        <span>
          {total} image{total === 1 ? "" : "s"}
          {stats ? ` · ${formatBytes(stats.bytes)} used` : ""}
          {!isAdmin && " · your uploads"}
        </span>
        <span className="hidden sm:inline">
          Tip: drop images anywhere in this panel
        </span>
      </div>

      {/* Grid */}
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto rounded-xl",
          dragging && "ring-2 ring-primary ring-offset-2",
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-primary/10">
            <span className="text-sm font-semibold text-primary">
              Drop to upload
            </span>
          </div>
        )}

        {!loading && items.length === 0 ? (
          <div className="grid min-h-[220px] w-full place-items-center rounded-xl border-2 border-dashed p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="font-medium">
                {search ? "No images match your search" : "No images here yet"}
              </span>
              <span className="text-sm text-muted-foreground">
                Click Upload above, or drag images in from your computer
              </span>

              {/*
                The library lists its own records, and everything uploaded
                before it existed has none — so on a site that is already full
                of pictures this grid starts empty. This pulls them in: it adds
                a record per file and touches nothing on disk, so no URL
                changes and nothing that is indexed moves.
              */}
              {isAdmin && !search && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 max-w-sm text-sm text-muted-foreground">
                    Images uploaded before the library existed are not listed
                    yet. Bring them in — files are not renamed or moved.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runImport()}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderInput className="mr-2 h-4 w-4" />
                    )}
                    {importing ? "Importing…" : "Import existing images"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => {
              const index = selected.findIndex((x) => x.id === item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggle(item)}
                  title={item.title || item.originalName}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all",
                    index >= 0
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {item.kind === "video" && (
                    <>
                      <span className="absolute inset-0 z-10 grid place-items-center">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                          <Play className="h-3.5 w-3.5 fill-white" />
                        </span>
                      </span>
                      {item.durationSec ? (
                        <span className="absolute bottom-1 right-1 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                          {Math.floor(item.durationSec / 60)}:
                          {String(Math.round(item.durationSec % 60)).padStart(2, "0")}
                        </span>
                      ) : null}
                    </>
                  )}
                  <ImageOff className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbUrl}
                    alt={item.alt || item.title}
                    loading="lazy"
                    style={
                      item.color ? { backgroundColor: item.color } : undefined
                    }
                    className="relative h-full w-full object-cover"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.opacity = "0";
                    }}
                  />

                  {item.altSource === "ai" && (
                    <span
                      title="Alt text written by AI"
                      className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-primary"
                    >
                      <Sparkles className="h-3 w-3" />
                    </span>
                  )}
                  {item.aiStatus === "pending" && (
                    <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    </span>
                  )}

                  {index >= 0 && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
                      {multiple ? index + 1 : <Check className="h-3.5 w-3.5" />}
                    </span>
                  )}

                  {mode === "select" && (
                    <span
                      role="button"
                      aria-label="Details"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetail(item);
                      }}
                      className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}

            {loading &&
              Array.from({ length: items.length ? 6 : 12 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="aspect-square animate-pulse rounded-lg bg-muted"
                />
              ))}
          </div>
        )}

        {!loading && page < pages && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(page + 1, true)}
            >
              Load more
            </Button>
          </div>
        )}
      </div>

      {/* Select footer */}
      {mode === "select" && (
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <span className="flex-1 text-sm text-muted-foreground">
            {selected.length
              ? `${selected.length} selected`
              : multiple
                ? "Choose one or more images"
                : "Choose an image"}
          </span>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected.length}
            onClick={() => onSelect?.(selected)}
          >
            {multiple && selected.length > 1
              ? `Use ${selected.length} images`
              : "Use image"}
          </Button>
        </div>
      )}

      {detail && (
        <MediaDetail
          key={detail.id}
          item={detail}
          showUploader={isAdmin}
          context={context}
          onClose={() => setDetail(null)}
          onDelete={() => requestDelete(detail)}
          onUpdated={applyUpdate}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

/** Details panel — the WordPress "attachment details" sidebar. */
function MediaDetail({
  item,
  showUploader,
  context,
  onClose,
  onDelete,
  onUpdated,
}: {
  item: MediaItem;
  showUploader: boolean;
  context?: string;
  onClose: () => void;
  onDelete: () => void;
  onUpdated: (item: MediaItem) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const absoluteUrl =
    typeof window !== "undefined" && item.url.startsWith("/")
      ? window.location.origin + item.url
      : item.url;

  const uploader =
    typeof item.uploadedBy === "object" ? item.uploadedBy.name : "";

  const save = async () => {
    try {
      setSaving(true);
      onUpdated(await mediaApi.updateMeta(item.id, { title, alt, caption }));
      toast.success("Saved");
    } catch (err) {
      toast.error("Could not save", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const rewrite = async () => {
    try {
      setAiBusy(true);
      const updated = await mediaApi.regenerate(item.id, context);
      setTitle(updated.title);
      setAlt(updated.alt);
      setCaption(updated.caption);
      onUpdated(updated);
      toast.success("AI wrote a new description");
    } catch (err) {
      toast.error("The AI couldn't describe this image", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl border bg-card sm:max-w-3xl sm:flex-row sm:rounded-2xl">
        <div className="grid min-h-[220px] place-items-center bg-muted p-3 sm:w-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.alt || item.title}
            className="max-h-[50vh] w-auto rounded-lg object-contain"
          />
        </div>

        <div className="flex flex-col gap-3 p-4 sm:w-1/2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="break-all text-sm font-semibold">
              {item.originalName || item.title || "Image"}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Dimensions</dt>
            <dd>
              {item.width} × {item.height}
            </dd>
            <dt className="text-muted-foreground">File size</dt>
            <dd>{formatBytes(item.sizeBytes)}</dd>
            <dt className="text-muted-foreground">Format</dt>
            <dd>WebP</dd>
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd>{new Date(item.createdAt).toLocaleDateString("en-PK")}</dd>
            {showUploader && uploader && (
              <>
                <dt className="text-muted-foreground">By</dt>
                <dd className="truncate">{uploader}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Folder</dt>
            <dd>{MEDIA_FOLDER_LABELS[item.folder] ?? item.folder}</dd>
          </dl>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={absoluteUrl}
              className="h-9 flex-1 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(absoluteUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`title-${item.id}`}>Title</Label>
            <Input
              id={`title-${item.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`alt-${item.id}`}>
                Alt text{" "}
                <span className="font-normal text-muted-foreground">
                  (for Google and screen readers)
                </span>
              </Label>
              {item.altSource === "ai" && alt === item.alt && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> AI
                </span>
              )}
              {item.aiStatus === "pending" && (
                <span className="text-[10px] text-muted-foreground">
                  AI is writing…
                </span>
              )}
            </div>
            <Textarea
              id={`alt-${item.id}`}
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`caption-${item.id}`}>Caption</Label>
            <Input
              id={`caption-${item.id}`}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void rewrite()}
            disabled={aiBusy}
          >
            {aiBusy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {item.altSource === "ai" ? "Rewrite with AI" : "Write with AI"}
          </Button>

          <div className="mt-auto flex items-center gap-2 pt-1">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
