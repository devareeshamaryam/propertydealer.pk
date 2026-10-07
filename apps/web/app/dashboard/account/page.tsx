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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { propertyApi, userApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { DataCard, DataCardTitle, PageHeader } from "@/components/dashboard";
import { ImageField } from "@/components/media";
import { Textarea } from "@/components/ui/textarea";
import { agentProfilePath } from "@/lib/agent";
import { apiErrorMessage } from "@/components/dashboard/api-error";

/** The public fields /auth/profile returns alongside the sign-in details. */
interface PublicProfileFields {
  phone?: string;
  whatsappNumber?: string;
  companyName?: string;
  bio?: string;
  experienceYears?: number | null;
  address?: string;
  avatarUrl?: string;
}

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
  const [companyName, setCompanyName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
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
    if (!record) return;
    const profile = record;
    setName(record.name ?? "");
    setPhone(profile.phone ?? "");
    setWhatsappNumber(profile.whatsappNumber ?? "");
    setCompanyName(profile.companyName ?? "");
    setBio(profile.bio ?? "");
    setExperienceYears(
      profile.experienceYears === undefined || profile.experienceYears === null
        ? ""
        : String(profile.experienceYears),
    );
    setAddress(profile.address ?? "");
    setAvatarUrl(profile.avatarUrl ?? "");
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
  const dirty = record
    ? name !== (record.name ?? "") ||
      phone !== (profile.phone ?? "") ||
      whatsappNumber !== (profile.whatsappNumber ?? "") ||
      companyName !== (profile.companyName ?? "") ||
      bio !== (profile.bio ?? "") ||
      experienceYears !==
        (profile.experienceYears === undefined || profile.experienceYears === null
          ? ""
          : String(profile.experienceYears)) ||
      address !== (profile.address ?? "") ||
      avatarUrl !== (profile.avatarUrl ?? "")
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
    try {
      setSaving(true);
      // PATCH /users/me — authenticated, not admin-only, and it accepts only
      // name and phone, so every role can maintain their own contact details.
      await userApi.updateMe({
        name: name.trim(),
        phone: phone.trim(),
        whatsappNumber: whatsappNumber.trim(),
        companyName: companyName.trim(),
        bio: bio.trim(),
        address: address.trim(),
        avatarUrl: avatarUrl.trim(),
        ...(experienceYears.trim() === ""
          ? {}
          : { experienceYears: Number(experienceYears) }),
      });
      const updated = await userApi.getMe();
      setRecord(updated);
      toast.success("Profile updated", {
        description: "Sign in again to see the new name everywhere.",
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

      {/* Identity */}
      <DataCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold">
              {record?.name || user.name || "No name set"}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={isAdmin ? "default" : "secondary"}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {user.role ?? "USER"}
              </Badge>
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
          </div>

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
            <Button variant="outline" size="sm" asChild>
              <Link href={publicPath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View as buyer
              </Link>
            </Button>
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
            />
            <p className="text-xs text-muted-foreground">
              Used as the heading of your profile when set.
            </p>
          </div>

          <div className="space-y-2">
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
              />
            </div>
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

          <div className="sm:col-span-2">
            <ImageField
              label="Profile photo / logo"
              value={avatarUrl}
              onChange={setAvatarUrl}
              folder="general"
              context={companyName || name || "Agent profile photo"}
              aspect="square"
              hint="Square works best. Shown on your profile and next to your listings."
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
