'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved } from '@/lib/site-settings';

/** Share an agent's profile: the phone's share sheet, or the link copied. */
export default function ShareProfile({ name }: { name: string }) {
  const { siteName } = resolved(useSiteSettings());
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split('#')[0]!;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} on ${siteName}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // dismissed
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className="btn-shape inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-800 hover:border-primary hover:text-primary"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
