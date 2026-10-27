"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * The benefits a package switches on — enforced by the site, not just text on
 * the card: the verified badge, instant publishing, spotlight, branded
 * profile, social links, agent accounts, and the "Most popular" ribbon.
 */

export interface PlanBenefits {
  verifiedBadge: boolean;
  autoPublish: boolean;
  spotlight: boolean;
  brandedProfile: boolean;
  socialLinks: boolean;
  highlight: boolean;
  profilePage: boolean;
  teamMembers: string;
}

export const EMPTY_BENEFITS: PlanBenefits = {
  verifiedBadge: false,
  autoPublish: false,
  spotlight: false,
  brandedProfile: false,
  socialLinks: false,
  highlight: false,
  profilePage: true,
  teamMembers: "0",
};

export function benefitsFrom(pkg: Partial<Record<keyof PlanBenefits, unknown>>): PlanBenefits {
  return {
    verifiedBadge: Boolean(pkg.verifiedBadge),
    autoPublish: Boolean(pkg.autoPublish),
    spotlight: Boolean(pkg.spotlight),
    brandedProfile: Boolean(pkg.brandedProfile),
    socialLinks: Boolean(pkg.socialLinks),
    highlight: Boolean(pkg.highlight),
    // Older packages have no value: the profile page was always there.
    profilePage: pkg.profilePage !== false,
    teamMembers: String(Number(pkg.teamMembers) || 0),
  };
}

export function benefitsDto(b: PlanBenefits) {
  return { ...b, teamMembers: Math.max(0, Math.min(100, parseInt(b.teamMembers) || 0)) };
}

const TOGGLES: { key: Exclude<keyof PlanBenefits, "teamMembers">; label: string; hint: string }[] = [
  { key: "verifiedBadge", label: "Verified badge", hint: "On the profile, every listing and every listing card." },
  { key: "autoPublish", label: "Instant publishing", hint: "New listings go live without waiting for review." },
  { key: "spotlight", label: "Spotlight", hint: "Shown in “Verified agencies” on the homepage and at the top of /property-dealers." },
  // Profile page and cover photo are not here: every account has both, whatever the plan.
  { key: "socialLinks", label: "Social links", hint: "Facebook, Instagram, YouTube, TikTok, LinkedIn and website on the profile." },
  { key: "highlight", label: "“Most popular” ribbon", hint: "Highlights this card on the pricing pages." },
];

export function PlanBenefitsFields({ value, onChange }: { value: PlanBenefits; onChange: (v: PlanBenefits) => void }) {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm font-semibold">Benefits</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLES.map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 hover:bg-slate-50">
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <Switch checked={value[key]} onCheckedChange={(v) => onChange({ ...value, [key]: v })} />
          </label>
        ))}
        <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Agent accounts</span>
            <span className="block text-xs text-muted-foreground">How many agents the owner can add (0 = none).</span>
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-20"
            value={value.teamMembers}
            onChange={(e) => onChange({ ...value, teamMembers: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
