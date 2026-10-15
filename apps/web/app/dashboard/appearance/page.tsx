"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataCard, DataCardTitle, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useAuth } from "@/context/auth-context";
import { siteSettingsApi } from "@/lib/api";
import {
  DEFAULT_DARK,
  DEFAULT_HERO_SUBTITLE,
  DEFAULT_HERO_TITLE,
  DEFAULT_PRIMARY,
  DEFAULT_SITE_SETTINGS,
  SITE_FONTS,
  type SiteSettings,
} from "@/lib/site-settings";
import { cn } from "@/lib/utils";

/**
 * Settings → Appearance.
 *
 * The brand colour, the dark colour, corner radius, font, logos, favicon and
 * the homepage headline. Saved values become CSS variables on every page of
 * the site (public and dashboard), so nothing here needs a code change or a
 * deploy. Empty colour fields fall back to the built-in blue and navy.
 */

const PRIMARY_PRESETS = ["#1a56db", "#0e7c66", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0f172a"];
const DARK_PRESETS = ["#0f2c5c", "#0b3b33", "#1e293b", "#111827", "#3b0764", "#422006"];
const RADII = [
  { value: 0, label: "Square" },
  { value: 4, label: "Small" },
  { value: 8, label: "Medium" },
  { value: 12, label: "Large" },
];

type ImageField = "logoUrl" | "footerLogoUrl" | "faviconUrl";

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

function ColorField({
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
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-input bg-white p-1"
          aria-label={`${label} picker`}
        />
        <Input
          value={value}
          placeholder={fallback}
          onChange={(e) => onChange(e.target.value.trim())}
          className="w-32 font-mono"
          maxLength={7}
        />
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

export default function AppearancePage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [saved, setSaved] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<ImageField | null>(null);

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

  const primary = isHex(settings.primaryColor) ? settings.primaryColor : DEFAULT_PRIMARY;
  const dark = isHex(settings.darkColor) ? settings.darkColor : DEFAULT_DARK;

  const save = async () => {
    for (const [key, label] of [["primaryColor", "Brand colour"], ["darkColor", "Dark colour"]] as const) {
      const v = settings[key];
      if (v && !isHex(v)) {
        toast.error(`${label} must look like #1a56db`);
        return;
      }
    }
    setSaving(true);
    try {
      const data = await siteSettingsApi.save(settings);
      const merged = { ...DEFAULT_SITE_SETTINGS, ...(data ?? {}) };
      setSettings(merged);
      setSaved(merged);
      toast.success("Saved. The whole site uses the new look now — refresh any open page to see it.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change the site&apos;s appearance.</p>;
  }

  const ImageSlot = ({ field, label, hint, dark: onDark = false }: { field: ImageField; label: string; hint: string; dark?: boolean }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-16 w-32 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed",
            onDark ? "border-white/20" : "border-slate-300 bg-slate-50",
          )}
          style={onDark ? { background: dark } : undefined}
        >
          {settings[field] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings[field]} alt="" className="max-h-12 max-w-[7rem] object-contain" />
          ) : (
            <ImageIcon className={cn("h-5 w-5", onDark ? "text-white/40" : "text-slate-300")} />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(field)}>
            {settings[field] ? "Change" : "Choose image"}
          </Button>
          {settings[field] && (
            <Button type="button" variant="ghost" size="sm" onClick={() => set(field, "")}>
              <X className="mr-1 h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appearance"
        description="Brand colours, corners, font, logo and homepage text for the whole site."
        actions={
          <Button onClick={() => void save()} disabled={saving || loading || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <DataCard className="space-y-6 p-5">
              <DataCardTitle>Colours</DataCardTitle>
              <ColorField
                label="Brand colour"
                hint="Buttons, links, prices on hover, active tabs and badges across the site and the dashboard."
                value={settings.primaryColor}
                fallback={DEFAULT_PRIMARY}
                presets={PRIMARY_PRESETS}
                onChange={(v) => set("primaryColor", v)}
              />
              <ColorField
                label="Dark colour"
                hint="The homepage search band and the footer. Keep it dark — white text sits on it."
                value={settings.darkColor}
                fallback={DEFAULT_DARK}
                presets={DARK_PRESETS}
                onChange={(v) => set("darkColor", v)}
              />
            </DataCard>

            <DataCard className="space-y-6 p-5">
              <DataCardTitle>Shape &amp; type</DataCardTitle>
              <div className="space-y-2">
                <Label>Corners</Label>
                <div className="flex flex-wrap gap-2">
                  {RADII.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("radius", value)}
                      className={cn(
                        "flex items-center gap-2 border px-3 py-2 text-sm transition-colors",
                        settings.radius === value ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-400",
                      )}
                      style={{ borderRadius: value }}
                    >
                      <span className="h-4 w-4 border-2 border-current" style={{ borderRadius: value / 2 }} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Cards, buttons, inputs and images.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font">Font</Label>
                <select
                  id="font"
                  value={settings.font}
                  onChange={(e) => set("font", e.target.value as SiteSettings["font"])}
                  className="h-10 w-full max-w-xs rounded-md border border-input bg-white px-3 text-sm"
                >
                  {SITE_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </DataCard>

            <DataCard className="space-y-6 p-5">
              <DataCardTitle>Logo &amp; icon</DataCardTitle>
              <ImageSlot
                field="logoUrl"
                label="Header logo"
                hint="A wide PNG or SVG with a transparent background. Empty shows the built-in PropertyDealer mark."
              />
              <div className="space-y-2">
                <Label htmlFor="logoHeight">Header logo height: {settings.logoHeight}px</Label>
                <input
                  id="logoHeight"
                  type="range"
                  min={20}
                  max={56}
                  value={settings.logoHeight}
                  onChange={(e) => set("logoHeight", Number(e.target.value))}
                  className="w-full max-w-xs accent-[var(--primary)]"
                />
              </div>
              <ImageSlot
                field="footerLogoUrl"
                label="Footer logo"
                hint="Shown on the dark footer — use a white or light version. Empty uses the header logo."
                dark
              />
              <ImageSlot field="faviconUrl" label="Favicon" hint="The browser tab icon. A square PNG, 512×512 is ideal." />
            </DataCard>

            <DataCard className="space-y-4 p-5">
              <DataCardTitle>Homepage</DataCardTitle>
              <div className="space-y-2">
                <Label htmlFor="heroTitle">Headline</Label>
                <Input
                  id="heroTitle"
                  value={settings.heroTitle}
                  placeholder={DEFAULT_HERO_TITLE}
                  maxLength={120}
                  onChange={(e) => set("heroTitle", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The homepage&apos;s main heading (its H1), so search engines read it too. Empty keeps the default.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="heroSubtitle">Sub-heading</Label>
                <Input
                  id="heroSubtitle"
                  value={settings.heroSubtitle}
                  placeholder={DEFAULT_HERO_SUBTITLE}
                  maxLength={200}
                  onChange={(e) => set("heroSubtitle", e.target.value)}
                />
              </div>
            </DataCard>
          </div>

          {/* Live preview */}
          <div className="xl:sticky xl:top-20 xl:self-start">
            <DataCard className="overflow-hidden p-0">
              <div className="border-b px-4 py-3 text-sm font-semibold">Preview</div>
              <div
                className="space-y-0 text-slate-900"
                style={{ fontFamily: settings.font === "geist" ? undefined : `var(--font-${settings.font})` }}
              >
                <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logoUrl} alt="" style={{ height: Math.min(settings.logoHeight, 40) }} />
                  ) : (
                    <span className="text-[15px] font-bold">
                      Property<span style={{ color: primary }}>Dealer</span>
                    </span>
                  )}
                  <span
                    className="px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ background: primary, borderRadius: settings.radius }}
                  >
                    + Add Property
                  </span>
                </div>
                <div className="px-4 py-5 text-center text-white" style={{ background: dark }}>
                  <p className="text-[15px] font-bold">{settings.heroTitle || DEFAULT_HERO_TITLE}</p>
                  <p className="mt-1 text-[11px] text-white/70">{settings.heroSubtitle || DEFAULT_HERO_SUBTITLE}</p>
                  <div className="mt-3 flex gap-2 bg-white p-2" style={{ borderRadius: settings.radius }}>
                    <span className="h-7 flex-1 border border-slate-200" style={{ borderRadius: Math.max(0, settings.radius - 2) }} />
                    <span
                      className="grid h-7 place-items-center px-3 text-[11px] font-semibold text-white"
                      style={{ background: primary, borderRadius: Math.max(0, settings.radius - 2) }}
                    >
                      Find
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4">
                  <div className="flex gap-3 border border-slate-200 bg-white p-2.5" style={{ borderRadius: settings.radius }}>
                    <span className="h-14 w-16 shrink-0 bg-slate-200" style={{ borderRadius: Math.max(0, settings.radius - 2) }} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold">PKR 1.1 Crore</span>
                      <span className="block truncate text-[11px] text-slate-600">5 Marla House for Sale, DHA</span>
                      <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `color-mix(in srgb, ${primary} 10%, white)`, color: primary, borderRadius: 4 }}>
                        For Sale
                      </span>
                    </span>
                  </div>
                  <p className="mt-3 text-[12px]">
                    A <span className="font-semibold underline" style={{ color: primary }}>link</span> in the text.
                  </p>
                </div>
                <div className="px-4 py-3 text-[11px] text-white/80" style={{ background: dark }}>
                  © PropertyDealer · Footer
                </div>
              </div>
            </DataCard>
          </div>
        </div>
      )}

      <ImagePickerDialog
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        title="Choose an image"
        onSelect={(image) => {
          if (picker) set(picker, image.url);
          setPicker(null);
        }}
      />
    </div>
  );
}
