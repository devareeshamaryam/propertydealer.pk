import api, { getAccessToken } from "@/lib/api";

/** One row of the media library. */
export interface MediaItem {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  mime: string;
  originalName: string;
  title: string;
  alt: string;
  caption: string;
  altSource: "ai" | "user" | "auto";
  aiStatus: "pending" | "done" | "failed" | "skipped";
  placeholder: string;
  color: string;
  folder: string;
  uploadedBy: string | { id: string; name: string };
  createdAt: string;
  /** Rows written before videos existed have no kind; they are all images. */
  kind?: "image" | "video";
  durationSec?: number;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  pages: number;
}

export interface MediaStats {
  files: number;
  bytes: number;
  aiEnabled: boolean;
}

export type MediaFolder =
  | "general"
  | "properties"
  | "blog"
  | "pages"
  | "rates"
  | "cities"
  | "areas"
  | "tile-categories"
  | "packages"
  | "branding";

export const MEDIA_FOLDER_LABELS: Record<string, string> = {
  general: "General",
  properties: "Property photos",
  blog: "Blog",
  pages: "Static pages",
  rates: "Material rates",
  cities: "Cities",
  areas: "Areas",
  "tile-categories": "Tile categories",
  packages: "Packages",
  branding: "Branding",
};

/**
 * Downscale a photo in the browser before sending it.
 *
 * A phone camera produces 3-8 MB files and the common case here is an agent on
 * mobile data uploading twelve photos of a house. The API re-encodes to WebP
 * anyway, so sending a 2000px JPEG instead of the 4000px original costs no
 * visible quality and turns a minute of waiting into a few seconds.
 *
 * PNGs are left alone — they are usually logos or screenshots where
 * transparency and crisp edges matter.
 */
export async function shrinkForUpload(
  file: File,
  maxEdge = 2400,
  quality = 0.92,
): Promise<File> {
  const isPhoto = /^image\/(jpe?g|heic|heif|webp)$/i.test(file.type);
  if (
    !isPhoto ||
    file.size < 600_000 ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);

    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close?.();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    // HEIC outside Safari, or any decode failure — let the server deal with it.
    return file;
  }
}

export interface UploadOptions {
  folder?: MediaFolder | string;
  /**
   * What the images are of, in words — the property title, the post title.
   * Names the stored file and gives the AI the context that makes alt text
   * specific rather than generic.
   */
  context?: string;
  onProgress?: (fraction: number) => void;
  /** Skip the browser-side downscale (logos, anything where pixels matter). */
  noShrink?: boolean;
}

export interface UploadResult {
  items: MediaItem[];
  failed: { name: string; error: string }[];
}

/**
 * Upload one or more images with real progress.
 *
 * Uses XHR rather than fetch because `fetch` still cannot report upload
 * progress, and an agent sending twelve photos needs to see that it is moving.
 */
export async function uploadMedia(
  files: File[],
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (!files.length) return { items: [], failed: [] };

  const prepared = options.noShrink
    ? files
    : await Promise.all(files.map((file) => shrinkForUpload(file)));

  const form = new FormData();
  for (const file of prepared) form.append("files", file);
  form.append("folder", options.folder ?? "general");
  if (options.context) form.append("context", options.context.slice(0, 200));

  const base = (api.defaults.baseURL ?? "/api").replace(/\/+$/, "");
  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/media/upload`);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress?.(event.loaded / event.total);
    };

    xhr.onload = () => {
      let body: { success?: boolean; message?: string; items?: MediaItem[]; failed?: { name: string; error: string }[] } | null =
        null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status === 401) {
        reject(new Error("Your session expired — sign in again to upload"));
        return;
      }
      if (!body?.success) {
        reject(new Error(body?.message ?? "Upload failed"));
        return;
      }
      resolve({ items: body.items ?? [], failed: body.failed ?? [] });
    };

    xhr.onerror = () =>
      reject(new Error("Network error — check your connection and try again"));
    xhr.ontimeout = () =>
      reject(new Error("The upload timed out — try fewer images at once"));

    xhr.send(form);
  });
}

/* ─────────────────────────────── Video ─────────────────────────────── */

/**
 * Kept in step with MAX_VIDEO_BYTES / MAX_VIDEO_SECONDS on the API. Checked
 * here first so a 200 MB file is refused in the form instead of after a long
 * upload on a phone connection.
 */
export const VIDEO_LIMITS = {
  maxBytes: 100 * 1024 * 1024,
  maxSeconds: 180,
  accept: "video/mp4,video/webm,video/quicktime",
  label: "MP4, WebM or MOV · up to 3 minutes · up to 100 MB",
};

export interface VideoProbe {
  durationSec: number;
  width: number;
  height: number;
  /** First readable frame, as a JPEG file ready to upload as the poster. */
  poster: File | null;
}

/**
 * Reads a video's length and grabs a poster frame, in the browser.
 *
 * The server has no ffmpeg, so this is where the duration check and the
 * thumbnail come from. A frame a little way in rather than at 0s: the first
 * frame of a phone video is often black while the exposure settles.
 */
export async function probeVideo(file: File): Promise<VideoProbe> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  const fail = (message: string) => new Error(message);

  try {
    const meta = await new Promise<VideoProbe>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(fail("Could not read that video — try an MP4")),
        15000,
      );

      video.onerror = () => {
        clearTimeout(timer);
        reject(fail("That video could not be opened — try an MP4"));
      };

      video.onloadedmetadata = () => {
        const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
        const width = video.videoWidth;
        const height = video.videoHeight;

        // Seek a moment in, then draw that frame to a canvas.
        const capture = () => {
          clearTimeout(timer);
          try {
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 1280 / Math.max(width || 1, 1));
            canvas.width = Math.max(1, Math.round((width || 720) * scale));
            canvas.height = Math.max(1, Math.round((height || 1280) * scale));

            const context = canvas.getContext("2d");
            if (!context) {
              resolve({ durationSec, width, height, poster: null });
              return;
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
              (blob) =>
                resolve({
                  durationSec,
                  width,
                  height,
                  poster: blob
                    ? new File([blob], "poster.jpg", { type: "image/jpeg" })
                    : null,
                }),
              "image/jpeg",
              0.82,
            );
          } catch {
            // A cross-origin or DRM-protected file taints the canvas. The video
            // still uploads; it just has no poster.
            resolve({ durationSec, width, height, poster: null });
          }
        };

        video.onseeked = capture;
        try {
          video.currentTime = Math.min(1, Math.max(0, durationSec / 4));
        } catch {
          capture();
        }
      };
    });

    return meta;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadVideo(
  file: File,
  options: { folder?: string; context?: string; onProgress?: (fraction: number) => void } = {},
): Promise<MediaItem> {
  if (file.size > VIDEO_LIMITS.maxBytes) {
    throw new Error(
      `That video is ${(file.size / 1048576).toFixed(0)} MB — the limit is ${VIDEO_LIMITS.maxBytes / 1048576} MB`,
    );
  }

  const probe = await probeVideo(file);

  if (probe.durationSec > VIDEO_LIMITS.maxSeconds + 1) {
    throw new Error(
      `That video is ${Math.round(probe.durationSec)} seconds — keep it under ${VIDEO_LIMITS.maxSeconds}`,
    );
  }

  const form = new FormData();
  form.append("video", file);
  if (probe.poster) form.append("poster", probe.poster);
  form.append("folder", options.folder ?? "properties");
  form.append("durationSec", String(Math.round(probe.durationSec)));
  if (options.context) form.append("context", options.context.slice(0, 200));

  const base = (api.defaults.baseURL ?? "/api").replace(/\/+$/, "");
  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/media/upload-video`);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };

    xhr.onload = () => {
      let body: { success?: boolean; message?: string; data?: MediaItem } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status === 401) {
        reject(new Error("Your session expired — sign in again to upload"));
        return;
      }
      if (!body?.success || !body.data) {
        reject(new Error(body?.message ?? "The video could not be uploaded"));
        return;
      }
      resolve(body.data);
    };

    xhr.onerror = () =>
      reject(new Error("Network error — check your connection and try again"));
    xhr.ontimeout = () => reject(new Error("The upload timed out"));

    xhr.send(form);
  });
}

const mediaApi = {
  upload: uploadMedia,

  /**
   * Admin only. Writes a library row for every image already in storage that
   * does not have one. Files are never renamed, moved or converted.
   */
  importExisting: async (): Promise<{
    imported: number;
    alreadyPresent: number;
    scanned: number;
  }> => {
    const response = await api.post("/media/import-existing");
    return response.data.data;
  },
  uploadVideo,
  probeVideo,

  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    folder?: string;
    uploadedBy?: string;
    /** "image" keeps videos out of a photo picker. */
    kind?: "image" | "video";
  }): Promise<MediaPage> => {
    const query = new URLSearchParams();
    if (params.page) query.append("page", String(params.page));
    if (params.limit) query.append("limit", String(params.limit));
    if (params.search?.trim()) query.append("search", params.search.trim());
    if (params.kind) query.append("kind", params.kind);
    if (params.folder) query.append("folder", params.folder);
    if (params.uploadedBy) query.append("uploadedBy", params.uploadedBy);

    const response = await api.get(`/media?${query.toString()}`);
    return {
      items: response.data.data ?? [],
      total: response.data.total ?? 0,
      page: response.data.page ?? 1,
      pages: response.data.pages ?? 1,
    };
  },

  stats: async (): Promise<MediaStats> => {
    const response = await api.get("/media/stats");
    return response.data.data;
  },

  updateMeta: async (
    id: string,
    patch: { title?: string; alt?: string; caption?: string },
  ): Promise<MediaItem> => {
    const response = await api.patch(`/media/${id}`, patch);
    return response.data.data;
  },

  regenerate: async (id: string, context?: string): Promise<MediaItem> => {
    const response = await api.post(`/media/${id}/ai`, { context });
    return response.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/media/${id}`);
  },
};

export const formatBytes = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : bytes >= 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${bytes} B`;

export default mediaApi;
