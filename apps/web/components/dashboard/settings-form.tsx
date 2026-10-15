"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ImageIcon, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { DataCard, DataCardTitle } from "@/components/dashboard/data-card";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { getAccessToken, siteSettingsApi } from "@/lib/api";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import { refreshSiteSettings } from "@/app/actions/refresh-cache";
import { cn } from "@/lib/utils";

/*
 * Shared plumbing for the settings pages (General, Appearance, Shop).
 *
 * They all edit the same settings document, so they share one loader and
 * one save — and the save does the step that used to be missing: once the API
 * has stored the values, the web server is told to drop its cached copy
 * (refreshSiteSettings), so the change is live on the next page view instead
 * of whenever the hourly cache happened to expire.
 */

export function useSettingsForm() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [saved, setSaved] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    siteSettingsApi
      .get()
      .then((data) => {
        const merged = { ...DEFAULT_SITE_SETTINGS, ...(data ?? {}) };
        setSettings(merged);
        setSaved(merged);
      })
      .catch((error) => toast.error(apiErrorMessage(error, "Could not load settings")))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  /** Saves only the keys this page owns, so two open tabs cannot undo each other. */
  const save = async (keys: (keyof SiteSettings)[]) => {
    setSaving(true);
    try {
      const patch = Object.fromEntries(keys.map((k) => [k, settings[k]])) as Partial<SiteSettings>;
      const data = await siteSettingsApi.save(patch);
      const merged = { ...DEFAULT_SITE_SETTINGS, ...(data ?? {}) };
      setSettings(merged);
      setSaved(merged);
      const refreshed = await refreshSiteSettings(getAccessToken()).catch(() => false);
      toast.success("Saved", {
        description: refreshed
          ? "Live on the site now — refresh any open page to see it."
          : "Saved. The site picks it up within a few minutes.",
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  return { settings, set, loading, saving, dirty, save };
}

export function SaveButton({ onClick, saving, disabled }: { onClick: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <Button onClick={onClick} disabled={saving || disabled}>
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save changes
    </Button>
  );
}

export function SettingsCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <DataCard className="space-y-5 p-5">
      <div>
        <DataCardTitle>{title}</DataCardTitle>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </DataCard>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

export function ColorField({
  label,
  hint,
  value,
  fallback,
  presets,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  presets: string[];
  onChange: (value: string) => void;
}) {
  const shown = isHex(value) ? value : fallback;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-input bg-white p-1"
          aria-label={`${label} picker`}
        />
        <Input value={value} placeholder={fallback} onChange={(e) => onChange(e.target.value.trim())} className="w-32 font-mono" maxLength={7} />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Default
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            title={p}
            className={cn(
              "h-7 w-7 rounded-md border-2 transition-transform hover:scale-110",
              shown.toLowerCase() === p ? "border-slate-900" : "border-white shadow-[0_0_0_1px_#e2e8f0]",
            )}
            style={{ background: p }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ImageField({
  label,
  hint,
  value,
  onChange,
  dark,
  previewClassName,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  dark?: string;
  previewClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-16 w-32 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed",
            dark ? "border-white/20" : "border-slate-300 bg-slate-50",
            previewClassName,
          )}
          style={dark ? { background: dark } : undefined}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className={cn("h-5 w-5", dark ? "text-white/40" : "text-slate-300")} />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {value ? "Change" : "Choose image"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="mr-1 h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <ImagePickerDialog
        open={open}
        onOpenChange={setOpen}
        title={`Choose ${label.toLowerCase()}`}
        onSelect={(image) => {
          onChange(image.url);
          setOpen(false);
        }}
      />
    </div>
  );
}

export function SliderField({
  id,
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <Field label={`${label}: ${value}${unit}`} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full max-w-xs accent-[var(--primary)]"
      />
    </Field>
  );
}
