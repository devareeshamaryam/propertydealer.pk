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

const mediaApi = {
  upload: uploadMedia,

  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    folder?: string;
    uploadedBy?: string;
  }): Promise<MediaPage> => {
    const query = new URLSearchParams();
    if (params.page) query.append("page", String(params.page));
    if (params.limit) query.append("limit", String(params.limit));
    if (params.search?.trim()) query.append("search", params.search.trim());
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
