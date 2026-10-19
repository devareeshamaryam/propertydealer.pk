"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import mediaApi from "@/lib/api/media/media.api";
import { userApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/components/dashboard/api-error";

/*
 * My Account's header: the real profile photo (and cover, on plans with
 * one), changed right where it is shown. Picking a file uploads it and saves
 * it to the profile at once — no scrolling to a form field, no Save button —
 * and the public profile is refreshed by the API on the same save.
 */

type Field = "avatarUrl" | "coverUrl";

function useImageSave(field: Field, context: string, onSaved: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const save = async (url: string) => {
    await userApi.updateMe({ [field]: url } as Record<string, string>);
    onSaved(url);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPG, PNG or WebP)");
      return;
    }
    setBusy(true);
    try {
      const { items } = await mediaApi.upload([file], { folder: "general", context });
      const url = items[0]?.url;
      if (!url) throw new Error("The upload returned no image");
      await save(url);
      toast.success(field === "avatarUrl" ? "Profile photo updated" : "Cover photo updated", {
        description: "Your public profile shows it now.",
      });
    } catch (err) {
      toast.error("Could not change the photo", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await save("");
      toast.success(field === "avatarUrl" ? "Profile photo removed" : "Cover photo removed");
    } catch (err) {
      toast.error("Could not remove the photo", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setBusy(false);
    }
  };

  const picker = (
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
  );
  return { busy, open: () => input.current?.click(), remove, picker };
}

export function ProfilePhoto({
  url,
  initials,
  context,
  onSaved,
}: {
  url: string;
  initials: string;
  context: string;
  onSaved: (url: string) => void;
}) {
  const { busy, open, remove, picker } = useImageSave("avatarUrl", context, onSaved);
  const [broken, setBroken] = useState(false);
  const show = url && !broken;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="group relative block h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-primary/10 shadow-sm ring-1 ring-slate-200"
        aria-label={url ? "Change profile photo" : "Add a profile photo"}
      >
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="grid h-full w-full place-items-center text-2xl font-semibold text-primary">{initials}</span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
        </span>
      </button>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-primary text-white shadow ring-2 ring-white"
        aria-label="Change profile photo"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </button>
      {url && !busy && (
        <button
          type="button"
          onClick={() => void remove()}
          className="absolute -left-1 bottom-0 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600"
          aria-label="Remove profile photo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {picker}
    </div>
  );
}

export function CoverPhoto({ url, context, onSaved }: { url: string; context: string; onSaved: (url: string) => void }) {
  const { busy, open, remove, picker } = useImageSave("coverUrl", context, onSaved);
  return (
    <div className={cn("relative h-28 w-full overflow-hidden rounded-t-xl sm:h-36", url ? "bg-slate-200" : "bg-gradient-to-r from-primary/15 to-primary/5")}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow hover:bg-white"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {url ? "Change cover" : "Add cover"}
        </button>
        {url && !busy && (
          <button
            type="button"
            onClick={() => void remove()}
            className="grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-slate-600 shadow hover:text-red-600"
            aria-label="Remove cover photo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {picker}
    </div>
  );
}
