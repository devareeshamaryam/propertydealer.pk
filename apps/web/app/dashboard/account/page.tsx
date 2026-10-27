"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  ExternalLink,
  Save,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cityApi, propertyApi, subscriptionApi, userApi, type MyPlan } from "@/lib/api";
import { BadgeCheck, Copy, Lock } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { DataCard, DataCardTitle, PageHeader } from "@/components/dashboard";
import { Textarea } from "@/components/ui/textarea";
import { agentProfilePath } from "@/lib/agent";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { LoginPasswordCard } from "@/components/dashboard/login-password-card";
import { CoverPhoto, ProfilePhoto } from "@/components/dashboard/profile-media";
import { cn } from "@/lib/utils";
import { CityPicker } from "@/components/ui/city-picker";
import { Checkbox } from "@/components/ui/checkbox";

/** "0300-1234567", "+92 300 1234567" and "923001234567" are the same number. */
const sameNumber = (a: string, b: string) => {
  const norm = (s: string) => s.replace(/\D/g, "").replace(/^92/, "0").replace(/^(?=3)/, "0");
  return norm(a) !== "" && norm(a) === norm(b);
};

/** The public fields /auth/profile returns alongside the sign-in details. */
interface PublicProfileFields {
  phone?: string;
  whatsappNumber?: string;
  companyName?: string;
  bio?: string;
  experienceYears?: number | null;
  address?: string;
  /** The city they work in (its id) — they are listed on that city's pages. */
  city?: string | null;
  avatarUrl?: string;
  coverUrl?: string;
  socialLinks?: SocialLinks;
  /** Set on an agency's agent: the agency's name is theirs and is not edited here. */
  agencyId?: string;
}

type SocialLinks = { facebook?: string; instagram?: string; youtube?: string; tiktok?: string; linkedin?: string; website?: string };
const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/your-page" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/your-account" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@your-channel" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@your-account" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/…" },
  { key: "website", label: "Website", placeholder: "https://your-agency.pk" },
];

interface PropertyStats {
  total: number;
  published: number;
  pending: number;
}

export default function AccountPage() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // The public half of the account: what /agents/<slug> shows.
  const [whatsappNumber, setWhatsappNumber] = useState("");
  // Ticked: WhatsApp is the phone number. Unticked: a field for a separate one.
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [social, setSocial] = useState<SocialLinks>({});
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) subscriptionApi.getMyPlan().then(setPlan).catch(() => undefined);
  }, [user]);
  const [stats, setStats] = useState<PropertyStats | null>(null);

  /*
   * Seeded from GET /users/me, not from the auth context.
   *
   * The context user comes from /auth/profile, which answers straight out of
   * the JWT — email, role, isActive and nothing else. After a page reload it
   * therefore carries no name, phone or profile fields at all, so seeding this
   * form from it emptied every box and a save would have blanked the profile.
   */
  const [record, setRecord] = useState<PublicProfileFields & { _id?: string; name?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await userApi.getMe();
        if (!cancelled) setRecord(data);
      } catch (err) {
        console.error("Could not load your account record:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    cityApi
      .getNames()
      .then((list) => setCities([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    if (!record) return;
    const profile = record;
    setName(record.name ?? "");
    setPhone(profile.phone ?? "");
    setWhatsappNumber(profile.whatsappNumber ?? "");
    setSameWhatsapp(!profile.whatsappNumber?.trim() || sameNumber(profile.whatsappNumber, profile.phone ?? ""));
    setCompanyName(profile.companyName ?? "");
    setBio(profile.bio ?? "");
    setExperienceYears(
      profile.experienceYears === undefined || profile.experienceYears === null
        ? ""
        : String(profile.experienceYears),
    );
    setAddress(profile.address ?? "");
    setCityId(profile.city ? String(profile.city) : "");
    setAvatarUrl(profile.avatarUrl ?? "");
    setCoverUrl(profile.coverUrl ?? "");
    setSocial(profile.socialLinks ?? {});
  }, [record]);

  // Real listing counts, from the stats aggregation. This used to download
  // every property the user could see and count them in the browser.
  const loadStats = useCallback(async () => {
    try {
      const data = await propertyApi.getDashboardStats();
      setStats({
        total: data.total,
        published: data.byStatus.approved ?? 0,
        pending: data.byStatus.pending ?? 0,
      });
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    if (user) void loadStats();
  }, [user, loadStats]);

  const initials =
    (record?.name ?? user?.name ?? user?.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  const profile = (record ?? {}) as Partial<PublicProfileFields>;
  const whatsappToSave = sameWhatsapp ? phone.trim() : whatsappNumber.trim();
  const dirty = record
    ? name !== (record.name ?? "") ||
      phone !== (profile.phone ?? "") ||
      whatsappToSave !== ((profile.whatsappNumber || profile.phone) ?? "").trim() ||
      companyName !== (profile.companyName ?? "") ||
      bio !== (profile.bio ?? "") ||
      experienceYears !==
        (profile.experienceYears === undefined || profile.experienceYears === null
          ? ""
          : String(profile.experienceYears)) ||
      address !== (profile.address ?? "") ||
      cityId !== (profile.city ? String(profile.city) : "") ||
      avatarUrl !== (profile.avatarUrl ?? "") ||
      coverUrl !== (profile.coverUrl ?? "") ||
      JSON.stringify(SOCIAL_FIELDS.map(({ key }) => social[key] ?? "")) !==
        JSON.stringify(SOCIAL_FIELDS.map(({ key }) => profile.socialLinks?.[key] ?? ""))
    : false;

  // Where buyers see this account. Only meaningful once it has an id.
  const publicPath = agentProfilePath({
    _id: record?._id,
    name: record?.name,
    companyName,
  });

  const save = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    if (user.role === "AGENT" && !cityId) {
      toast.error("Choose your city", { description: "Agents and agencies are shown on their city's pages." });
      return;
    }
    try {
      setSaving(true);
      // PATCH /users/me — authenticated, not admin-only, and it accepts only
      // name and phone, so every role can maintain their own contact details.
      await userApi.updateMe({
        name: name.trim(),
        phone: phone.trim(),
        whatsappNumber: whatsappToSave,
        companyName: companyName.trim(),
        bio: bio.trim(),
        address: address.trim(),
        city: cityId,
        avatarUrl: avatarUrl.trim(),
        coverUrl: coverUrl.trim(),
        socialLinks: Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, (social[key] ?? "").trim()])),
        ...(experienceYears.trim() === ""
          ? {}
          : { experienceYears: Number(experienceYears) }),
      });
      const updated = await userApi.getMe();
      setRecord(updated);
      window.dispatchEvent(new Event("pd:profile-updated"));
      toast.success("Profile updated", {
        description: "Your public profile shows the changes now.",
      });
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Could not save profile", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <PageHeader
        title="My Account"
        description="Your sign-in details and role on the platform."
      />

      {/* Identity — the photo (and cover) are changed right here, saved at once. */}
      <DataCard flush className="overflow-hidden">
        {/* Every account may have a cover photo, whatever the plan. */}
        {!isAdmin && (
          <CoverPhoto
            url={coverUrl}
            context={`${companyName || name} cover`}
            onSaved={(url) => {
              setCoverUrl(url);
              setRecord((r) => (r ? { ...r, coverUrl: url } : r));
              window.dispatchEvent(new Event("pd:profile-updated"));
            }}
          />
        )}
        <div className={cn("relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:p-6", isAdmin ? "sm:items-center" : "-mt-10 sm:-mt-8 sm:items-start")}>
          <ProfilePhoto
            url={avatarUrl}
            initials={initials}
            context={companyName || name || "Agent profile photo"}
            onSaved={(url) => {
              setAvatarUrl(url);
              setRecord((r) => (r ? { ...r, avatarUrl: url } : r));
              window.dispatchEvent(new Event("pd:profile-updated"));
            }}
          />

          {/* Below the cover: only the photo overlaps its edge. */}
          <div className={cn("min-w-0 flex-1", !isAdmin && "sm:pt-10")}>
            <h2 className="truncate text-xl font-semibold">
              {record?.name || user.name || "No name set"}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Badge variant="default">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {user.role ?? "USER"}
                </Badge>
              )}
              {user.isActive === false ? (
                <Badge variant="destructive">Inactive</Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
          </div>

          {/* Real counts, not the placeholder "12 listings / 4.9 rating" the
              previous version showed to everybody. */}
          {stats && (
            <div className="grid shrink-0 grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-xl bg-muted/60 px-4 py-3 text-center">
                <p className="text-2xl font-semibold tabular-nums">
                  {stats.total}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Listings
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 px-4 py-3 text-center">
                <p className="text-2xl font-semibold tabular-nums text-emerald-700">
                  {stats.published}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Live
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 px-4 py-3 text-center">
                <p className="text-2xl font-semibold tabular-nums text-amber-700">
                  {stats.pending}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending
                </p>
              </div>
            </div>
          )}
        </div>
      </DataCard>

      {/* Editable details */}
      <DataCard>
        <DataCardTitle hint="Shown to customers who contact you about a listing">
          Contact details
        </DataCardTitle>

        <Separator className="my-5" />

        {/*
          PATCH /users/me accepts name and phone for any authenticated role,
          so every user can maintain their own contact details. Role and
          status are not editable here by design — the endpoint rejects them.
        */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Full name</Label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-phone">Phone number</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="account-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+92 300 1234567"
                className="pl-9"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
              <Checkbox
                checked={sameWhatsapp}
                onCheckedChange={(v) => {
                  const same = v === true;
                  setSameWhatsapp(same);
                  // A separate number starts empty, not as a copy of the phone.
                  if (!same && sameNumber(whatsappNumber, phone)) setWhatsappNumber("");
                }}
              />
              This number is on WhatsApp too
            </label>
          </div>

          {!sameWhatsapp && (
            <div className="space-y-2 sm:col-start-2">
              <Label htmlFor="account-whatsapp">WhatsApp number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="account-whatsapp"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(event) => setWhatsappNumber(event.target.value)}
                  placeholder="+92 300 1234567"
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Sign-in email and role: shown to admins only — an agent cannot change either. */}
          {isAdmin && (
          <>
          <div className="space-y-2">
            <Label htmlFor="account-email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="account-email"
                value={user.email}
                disabled
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Email is used to sign in and cannot be changed here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-role">Role</Label>
            <Input id="account-role" value={user.role ?? "USER"} disabled />
            <p className="text-xs text-muted-foreground">
              Roles are managed from{" "}
              <Link href="/dashboard/users" className="underline">
                Users
              </Link>
              .
            </p>
          </div>
          </>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
          {dirty && !saving && (
            <span className="text-sm text-muted-foreground">
              Unsaved changes
            </span>
          )}
        </div>
      </DataCard>

      {/* The page buyers land on from any of this account's listings. */}
      <DataCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <DataCardTitle hint="Shown on /agents — buyers reach it from your listings">
            Public profile
          </DataCardTitle>
          {publicPath && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${window.location.origin}${publicPath}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {copied ? "Link copied" : "Copy profile link"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={publicPath} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View as buyer
                </Link>
              </Button>
            </div>
          )}
        </div>

        <Separator className="my-5" />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-company">Agency / office name</Label>
            <Input
              id="account-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="e.g. Al-Hamd Estate & Builders"
              disabled={Boolean(record?.agencyId)}
            />
            <p className="text-xs text-muted-foreground">
              {record?.agencyId
                ? "Set by your agency — your profile shows you as its agent."
                : "Used as the heading of your profile when set."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-experience">Years in the market</Label>
            <Input
              id="account-experience"
              type="number"
              min="0"
              max="70"
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              placeholder="e.g. 8"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-city">
              City {user.role === "AGENT" && <span className="text-destructive">*</span>}
            </Label>
            <CityPicker
              id="account-city"
              options={cities.map((c) => ({ value: c._id, label: c.name.charAt(0).toUpperCase() + c.name.slice(1) }))}
              value={cityId}
              onChange={setCityId}
              placeholder="Type your city"
              inputClassName="h-10 w-full rounded-md border border-input bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Verified agencies are shown on their city&apos;s property pages.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-address">Office address</Label>
            <Input
              id="account-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Main Boulevard, DHA Phase 6, Lahore"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-bio">About you</Label>
            <Textarea
              id="account-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Which areas you deal in, what you specialise in, how long you have been doing it."
            />
          </div>

        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
          {dirty && !saving && (
            <span className="text-sm text-muted-foreground">
              Unsaved changes
            </span>
          )}
        </div>
      </DataCard>

      {/* What the plan adds to the profile */}
      {!isAdmin && (
        <DataCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <DataCardTitle hint="Cover photo and social links on your public profile">Branding &amp; social links</DataCardTitle>
            {plan?.perks.verifiedBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified on {plan.name}
              </span>
            )}
          </div>
          <Separator className="my-5" />

          <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
            Your cover photo is changed at the top of this page — tap <b>Change cover</b>.
          </p>

          <div className="mt-5">
            {plan?.perks.socialLinks ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`social-${key}`}>{label}</Label>
                    <Input
                      id={`social-${key}`}
                      value={social[key] ?? ""}
                      onChange={(e) => setSocial((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0" /> Social links on your profile come with every paid plan.{" "}
                <Link href="/dashboard/purchase-package" className="font-semibold text-primary underline">See plans</Link>
              </p>
            )}
          </div>

          {plan?.perks.socialLinks && (
            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          )}
        </DataCard>
      )}

      <LoginPasswordCard />

      {/* Where to go next */}
      <DataCard>
        <DataCardTitle>Related</DataCardTitle>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/property">
              <Building2 className="mr-2 h-4 w-4" />
              My Listings
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/my-subscription">My Subscription</Link>
          </Button>
        </div>
      </DataCard>
    </div>
  );
}
