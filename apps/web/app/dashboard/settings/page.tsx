"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard";
import {
  Field,
  SaveButton,
  SettingsCard,
  SliderField,
  TextField,
  ToggleRow,
  useSettingsForm,
} from "@/components/dashboard/settings-form";
import { ImageField } from "@/components/dashboard/settings-form";
import { useAuth } from "@/context/auth-context";
import {
  DEFAULT_EMAIL,
  DEFAULT_FOOTER_ABOUT,
  DEFAULT_GA_ID,
  DEFAULT_PHONE,
  DEFAULT_SITE_NAME,
  type SiteSettings,
} from "@/lib/site-settings";

/**
 * Settings → General.
 *
 * Everything that used to be typed into the code: the site's name, phone,
 * WhatsApp, email and address (footer, structured data, the WhatsApp
 * fallback on listings), social links, footer text, the default page title
 * and description, the share image, Google Analytics and Search Console,
 * an announcement bar, and which homepage sections show. Empty fields keep
 * the built-in value shown as the placeholder.
 */

const KEYS: (keyof SiteSettings)[] = [
  "siteName", "tagline", "contactPhone", "contactWhatsapp", "contactEmail", "address", "officeHours",
  "socialFacebook", "socialInstagram", "socialYoutube", "socialLinkedin", "socialTiktok", "socialX",
  "footerAbout", "copyrightText",
  "seoTitle", "seoDescription", "ogImageUrl", "gaMeasurementId", "googleVerification",
  "announcementEnabled", "announcementText", "announcementLink",
  "homeShowCities", "homeShowLatest", "homeLatestCount", "homeShowAgentBand", "homeShowExplore", "homeShowBlog", "homeShowFaq",
  "defaultCity",
];

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  const { settings, set, loading, saving, dirty, save } = useSettingsForm();

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change site settings.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="General settings"
        description="Contact details, social links, footer, SEO defaults, tracking and homepage sections."
        actions={<SaveButton saving={saving} disabled={loading || !dirty} onClick={() => void save(KEYS)} />}
      />

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SettingsCard title="Site identity">
              <TextField id="siteName" label="Site name" value={settings.siteName} placeholder={DEFAULT_SITE_NAME} maxLength={60} onChange={(v) => set("siteName", v)} hint="Used in the footer, share previews and structured data." />
              <TextField id="tagline" label="Tagline" value={settings.tagline} placeholder="Serving buyers, renters and dealers across Pakistan since 2007." maxLength={140} onChange={(v) => set("tagline", v)} hint="The line on the right of the footer's bottom bar." />
            </SettingsCard>

            <SettingsCard title="Contact details" description="Shown in the footer and used by search engines. The WhatsApp number is also the fallback on listings that have none.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="contactPhone" label="Phone" value={settings.contactPhone} placeholder={DEFAULT_PHONE} maxLength={30} onChange={(v) => set("contactPhone", v)} />
                <TextField id="contactWhatsapp" label="WhatsApp" value={settings.contactWhatsapp} placeholder="Same as phone" maxLength={30} onChange={(v) => set("contactWhatsapp", v)} />
              </div>
              <TextField id="contactEmail" type="email" label="Email" value={settings.contactEmail} placeholder={DEFAULT_EMAIL} onChange={(v) => set("contactEmail", v)} />
              <TextField id="address" label="Office address" value={settings.address} placeholder="e.g. Office 12, Gulgasht Colony, Multan" maxLength={200} onChange={(v) => set("address", v)} />
              <TextField id="officeHours" label="Office hours" value={settings.officeHours} placeholder="e.g. Mon–Sat, 10am–7pm" maxLength={100} onChange={(v) => set("officeHours", v)} />
            </SettingsCard>

            <SettingsCard title="Social links" description="Full links, starting with https://. Empty ones are hidden.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="socialFacebook" label="Facebook" value={settings.socialFacebook} placeholder="https://facebook.com/…" onChange={(v) => set("socialFacebook", v)} />
                <TextField id="socialInstagram" label="Instagram" value={settings.socialInstagram} placeholder="https://instagram.com/…" onChange={(v) => set("socialInstagram", v)} />
                <TextField id="socialYoutube" label="YouTube" value={settings.socialYoutube} placeholder="https://youtube.com/@…" onChange={(v) => set("socialYoutube", v)} />
                <TextField id="socialLinkedin" label="LinkedIn" value={settings.socialLinkedin} placeholder="https://linkedin.com/company/…" onChange={(v) => set("socialLinkedin", v)} />
                <TextField id="socialTiktok" label="TikTok" value={settings.socialTiktok} placeholder="https://tiktok.com/@…" onChange={(v) => set("socialTiktok", v)} />
                <TextField id="socialX" label="X (Twitter)" value={settings.socialX} placeholder="https://x.com/…" onChange={(v) => set("socialX", v)} />
              </div>
            </SettingsCard>

            <SettingsCard title="Footer">
              <Field label="About text" htmlFor="footerAbout" hint="The short paragraph under the footer logo.">
                <Textarea id="footerAbout" rows={3} maxLength={400} value={settings.footerAbout} placeholder={DEFAULT_FOOTER_ABOUT} onChange={(e) => set("footerAbout", e.target.value)} />
              </Field>
              <TextField id="copyrightText" label="Copyright line" value={settings.copyrightText} placeholder="© {year} PropertyDealer. All rights reserved." maxLength={150} onChange={(v) => set("copyrightText", v)} hint="{year} becomes the current year." />
            </SettingsCard>
          </div>

          <div className="space-y-6">
            <SettingsCard title="SEO defaults" description="Only for pages without their own title and description (most pages have their own). Empty keeps the current ones — change with care, the site is ranked.">
              <TextField id="seoTitle" label="Default page title" value={settings.seoTitle} placeholder="Property Dealer | Buy, Sell & Rent Property" maxLength={70} onChange={(v) => set("seoTitle", v)} hint={`${settings.seoTitle.length}/70 characters`} />
              <Field label="Default meta description" htmlFor="seoDescription" hint={`${settings.seoDescription.length}/200 characters`}>
                <Textarea id="seoDescription" rows={3} maxLength={200} value={settings.seoDescription} placeholder="Property Dealer is a property buying and selling marketplace across Pakistan…" onChange={(e) => set("seoDescription", e.target.value)} />
              </Field>
              <ImageField label="Share image" hint="Shown when a page is shared on WhatsApp or Facebook. 1200×630 works best." value={settings.ogImageUrl} onChange={(v) => set("ogImageUrl", v)} previewClassName="w-40" />
            </SettingsCard>

            <SettingsCard title="Tracking & verification">
              <TextField id="gaMeasurementId" label="Google Analytics ID" value={settings.gaMeasurementId} placeholder={DEFAULT_GA_ID} onChange={(v) => set("gaMeasurementId", v.toUpperCase())} hint="Looks like G-XXXXXXXXXX. Empty keeps the current one." />
              <TextField id="googleVerification" label="Google Search Console code" value={settings.googleVerification} placeholder="The content value from the HTML tag method" maxLength={100} onChange={(v) => set("googleVerification", v)} />
            </SettingsCard>

            <SettingsCard title="Announcement bar" description="A one-line message above the header on every page — an offer, a holiday notice, a new feature.">
              <ToggleRow label="Show announcement" checked={settings.announcementEnabled} onChange={(v) => set("announcementEnabled", v)} />
              <TextField id="announcementText" label="Message" value={settings.announcementText} placeholder="e.g. Post your first property free this month" maxLength={160} onChange={(v) => set("announcementText", v)} />
              <TextField id="announcementLink" label="Link (optional)" value={settings.announcementLink} placeholder="/packages or https://…" onChange={(v) => set("announcementLink", v)} />
            </SettingsCard>

            <SettingsCard title="Homepage" description="Turn sections on or off.">
              <TextField id="defaultCity" label="Default city in the search" value={settings.defaultCity} placeholder="lahore" maxLength={60} onChange={(v) => set("defaultCity", v)} hint="Pre-selected in the homepage search." />
              <div className="grid gap-2">
                <ToggleRow label="Popular cities" checked={settings.homeShowCities} onChange={(v) => set("homeShowCities", v)} />
                <ToggleRow label="Latest properties" checked={settings.homeShowLatest} onChange={(v) => set("homeShowLatest", v)} />
                {settings.homeShowLatest && (
                  <SliderField id="homeLatestCount" label="Latest properties shown" unit="" value={settings.homeLatestCount} min={4} max={16} onChange={(v) => set("homeLatestCount", v)} />
                )}
                <ToggleRow label="“Selling or renting out?” band" checked={settings.homeShowAgentBand} onChange={(v) => set("homeShowAgentBand", v)} />
                <ToggleRow label="Explore more" checked={settings.homeShowExplore} onChange={(v) => set("homeShowExplore", v)} />
                <ToggleRow label="Blog articles" checked={settings.homeShowBlog} onChange={(v) => set("homeShowBlog", v)} />
                <ToggleRow label="FAQ" checked={settings.homeShowFaq} onChange={(v) => set("homeShowFaq", v)} />
              </div>
            </SettingsCard>
          </div>
        </div>
      )}
    </div>
  );
}
