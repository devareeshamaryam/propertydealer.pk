"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DataCard, PageHeader } from "@/components/dashboard";
import {
  ColorField,
  Field,
  ImageField,
  SaveButton,
  SettingsCard,
  SliderField,
  TextField,
  ToggleRow,
  useSettingsForm,
} from "@/components/dashboard/settings-form";
import { useAuth } from "@/context/auth-context";
import {
  DEFAULT_DARK,
  DEFAULT_HERO_IMAGE,
  DEFAULT_HERO_SUBTITLE,
  DEFAULT_HERO_TITLE,
  DEFAULT_PRICE_TAG,
  DEFAULT_PRIMARY,
  SITE_FONTS,
  type SiteSettings,
} from "@/lib/site-settings";
import { cn } from "@/lib/utils";

/**
 * Settings → Appearance: colours, corners, font, logos, favicon and the
 * homepage hero. Saved values become CSS variables on every page (public site
 * and dashboard), and the save refreshes the site straight away.
 */

const PRIMARY_PRESETS = ["#1a56db", "#0e7c66", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0f172a"];
const DARK_PRESETS = ["#0f2c5c", "#0b3b33", "#1e293b", "#111827", "#3b0764", "#422006"];
const TAG_PRESETS = ["#dc2626", "#e11d48", "#ea580c", "#16a34a", "#1a56db", "#0f172a"];
const RADII = [
  { value: 0, label: "Square" },
  { value: 4, label: "Small" },
  { value: 8, label: "Medium" },
  { value: 12, label: "Large" },
  { value: 16, label: "Extra large" },
  { value: 22, label: "Round" },
];

const SHAPES: { value: SiteSettings["buttonShape"]; label: string }[] = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Fully round" },
];

const KEYS: (keyof SiteSettings)[] = [
  "primaryColor", "darkColor", "priceTagColor", "radius", "buttonShape", "tabBarShape", "font",
  "logoUrl", "logoHeight", "logoHeightMobile", "footerLogoUrl", "faviconUrl",
  "heroTitle", "heroSubtitle", "heroImageEnabled", "heroImageUrl", "heroOverlay",
];

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

export default function AppearancePage() {
  const { user } = useAuth();
  const { settings, set, loading, saving, dirty, save } = useSettingsForm();

  const primary = isHex(settings.primaryColor) ? settings.primaryColor : DEFAULT_PRIMARY;
  const dark = isHex(settings.darkColor) ? settings.darkColor : DEFAULT_DARK;
  const tag = isHex(settings.priceTagColor) ? settings.priceTagColor : DEFAULT_PRICE_TAG;
  const heroImage = settings.heroImageEnabled ? settings.heroImageUrl || DEFAULT_HERO_IMAGE : "";

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change the site&apos;s appearance.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appearance"
        description="Brand colours, corners, font, logo and the homepage hero — for the whole site."
        actions={<SaveButton saving={saving} disabled={loading || !dirty} onClick={() => void save(KEYS)} />}
      />

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <SettingsCard title="Colours">
              <ColorField
                label="Brand colour"
                hint="Buttons, links, active tabs and badges across the site and the dashboard."
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
              <ColorField
                label="Price tag colour"
                hint="The price strip across the bottom of a listing's photos, and the price card beside them."
                value={settings.priceTagColor}
                fallback={DEFAULT_PRICE_TAG}
                presets={TAG_PRESETS}
                onChange={(v) => set("priceTagColor", v)}
              />
            </SettingsCard>

            <SettingsCard title="Shape & type">
              <Field label="Corners" hint="Cards, inputs, images and panels.">
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
              </Field>
              {(
                [
                  ["buttonShape", "Buttons", "Add to cart, Call, WhatsApp, Find, Add Property and the other main buttons."],
                  ["tabBarShape", "Phone tab bar", "The floating bar at the bottom of the screen on phones."],
                ] as const
              ).map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint}>
                  <div className="flex flex-wrap gap-2">
                    {SHAPES.map((shape) => (
                      <button
                        key={shape.value}
                        type="button"
                        onClick={() => set(key, shape.value)}
                        className={cn(
                          "flex items-center gap-2 border px-3 py-2 text-sm transition-colors",
                          settings[key] === shape.value ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-400",
                        )}
                        style={{ borderRadius: shape.value === "pill" ? 9999 : settings.radius + 4 }}
                      >
                        <span className="h-4 w-7 border-2 border-current" style={{ borderRadius: shape.value === "pill" ? 9999 : 4 }} />
                        {shape.label}
                      </button>
                    ))}
                  </div>
                </Field>
              ))}

              <Field label="Font" htmlFor="font">
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
              </Field>
            </SettingsCard>

            <SettingsCard title="Logo & icon" description="Empty logo fields show the built-in PropertyDealer mark.">
              <ImageField
                label="Header logo"
                hint="A wide PNG or SVG with a transparent background."
                value={settings.logoUrl}
                onChange={(v) => set("logoUrl", v)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SliderField
                  id="logoHeightMobile"
                  label="Logo size on phones"
                  value={settings.logoHeightMobile}
                  min={16}
                  max={56}
                  onChange={(v) => set("logoHeightMobile", v)}
                />
                <SliderField
                  id="logoHeight"
                  label="Logo size on desktop"
                  value={settings.logoHeight}
                  min={16}
                  max={72}
                  onChange={(v) => set("logoHeight", v)}
                  hint="Header and footer both follow these sizes."
                />
              </div>
              <ImageField
                label="Footer logo"
                hint="Shown on the dark footer — use a white or light version. Empty uses the header logo."
                value={settings.footerLogoUrl}
                onChange={(v) => set("footerLogoUrl", v)}
                dark={dark}
              />
              <ImageField
                label="Favicon"
                hint="The browser tab icon. A square PNG, 512×512 is ideal."
                value={settings.faviconUrl}
                onChange={(v) => set("faviconUrl", v)}
                previewClassName="w-16"
              />
            </SettingsCard>

            <SettingsCard title="Homepage hero" description="The search band at the top of the homepage.">
              <TextField
                id="heroTitle"
                label="Headline"
                value={settings.heroTitle}
                placeholder={DEFAULT_HERO_TITLE}
                maxLength={120}
                onChange={(v) => set("heroTitle", v)}
                hint="The homepage's main heading (its H1), so search engines read it too. Empty keeps the default."
              />
              <TextField
                id="heroSubtitle"
                label="Sub-heading"
                value={settings.heroSubtitle}
                placeholder={DEFAULT_HERO_SUBTITLE}
                maxLength={200}
                onChange={(v) => set("heroSubtitle", v)}
              />
              <ToggleRow
                label="Background photo"
                hint="A photo behind the search, faded under the dark colour. Off shows the plain dark colour."
                checked={settings.heroImageEnabled}
                onChange={(v) => set("heroImageEnabled", v)}
              />
              {settings.heroImageEnabled && (
                <>
                  <ImageField
                    label="Background image"
                    hint="A wide landscape photo, at least 1920px across. Empty uses the built-in Hunza valley photo."
                    value={settings.heroImageUrl}
                    onChange={(v) => set("heroImageUrl", v)}
                    previewClassName="w-40"
                  />
                  <SliderField
                    id="heroOverlay"
                    label="Fade"
                    unit="%"
                    value={settings.heroOverlay}
                    min={0}
                    max={95}
                    onChange={(v) => set("heroOverlay", v)}
                    hint="How much of the dark colour covers the photo. 60–80% keeps the text easy to read."
                  />
                </>
              )}
            </SettingsCard>
          </div>

          {/* Live preview */}
          <div className="xl:sticky xl:top-20 xl:self-start">
            <DataCard flush className="overflow-hidden">
              <div className="border-b px-4 py-3 text-sm font-semibold">Preview</div>
              <div
                className="bg-slate-100 text-slate-900"
                style={{ fontFamily: settings.font === "geist" ? undefined : `var(--font-${settings.font})` }}
              >
                <div className="p-2">
                  <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 shadow-sm">
                    {settings.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={settings.logoUrl} alt="" style={{ height: Math.min(settings.logoHeight, 40) }} />
                    ) : (
                      <span className="text-[15px] font-bold">
                        Property<span style={{ color: primary }}>Dealer</span>
                      </span>
                    )}
                    <span className="px-2.5 py-1 text-xs font-semibold text-white" style={{ background: primary, borderRadius: settings.radius }}>
                      + Add Property
                    </span>
                  </div>
                </div>
                <div className="relative isolate overflow-hidden px-4 py-6 text-center text-white" style={{ background: dark }}>
                  {heroImage && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
                      <div className="absolute inset-0 -z-10" style={{ background: dark, opacity: settings.heroOverlay / 100 }} />
                    </>
                  )}
                  <p className="text-[15px] font-bold">{settings.heroTitle || DEFAULT_HERO_TITLE}</p>
                  <p className="mt-1 text-[11px] text-white/75">{settings.heroSubtitle || DEFAULT_HERO_SUBTITLE}</p>
                  <div className="mt-3 flex gap-2 bg-white p-2" style={{ borderRadius: settings.radius + 4 }}>
                    <span className="h-7 flex-1 border border-slate-200" style={{ borderRadius: Math.max(0, settings.radius - 2) }} />
                    <span className="grid h-7 place-items-center px-3 text-[11px] font-semibold text-white" style={{ background: primary, borderRadius: Math.max(0, settings.radius - 2) }}>
                      Find
                    </span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="relative h-28 overflow-hidden bg-slate-300" style={{ borderRadius: settings.radius + 4 }}>
                    <div className="absolute bottom-0 left-0 px-3 py-1.5 text-white" style={{ background: tag, borderTopRightRadius: 12 }}>
                      <span className="text-[10px] font-semibold opacity-80">PKR </span>
                      <span className="text-[15px] font-extrabold">1.1 Crore</span>
                    </div>
                  </div>
                  <p className="text-[12px]">
                    A <span className="font-semibold underline" style={{ color: primary }}>link</span> in the text.
                  </p>
                </div>
                <div className="px-4 py-3 text-[11px] text-white/80" style={{ background: dark, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
                  © PropertyDealer · Footer
                </div>
              </div>
            </DataCard>
          </div>
        </div>
      )}
    </div>
  );
}
