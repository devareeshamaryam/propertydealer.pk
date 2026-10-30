'use client';

/**
 * Call and WhatsApp for one dealer in the directory.
 *
 * The directory lists come without phone numbers, so the whole list can't be
 * copied in one go. The number is fetched for this one dealer when someone
 * taps a button (rate limited on the API), then the call or chat opens.
 */
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { dealerHref, waNumber, type DealerCard } from '@/lib/dealers';
import { cn } from '@/lib/utils';
import { PhoneGlyph, WhatsAppGlyph } from './DealerCards';

const known = new Map<string, { phone: string; whatsapp: string }>();

async function numbers(id: string) {
  const hit = known.get(id);
  if (hit) return hit;
  const res = await fetch(`/api/dealers/contact/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 429) throw new Error('busy');
  if (!res.ok) throw new Error('failed');
  const j = (await res.json()) as { phone?: string; whatsapp?: string };
  const v = { phone: String(j.phone || ''), whatsapp: String(j.whatsapp || '') };
  known.set(id, v);
  return v;
}

export function DealerContact({ d, small }: { d: DealerCard; small?: boolean }) {
  const [busy, setBusy] = useState<'' | 'call' | 'wa'>('');
  const h = small ? 'h-9 px-3 text-[13.5px]' : 'h-10 px-3.5 text-[14px]';
  const hasPhone = d.hasPhone ?? !!d.phone;
  const hasWa = d.hasWhatsapp ?? !!(d.whatsapp || d.phone);

  const open = async (kind: 'call' | 'wa') => {
    if (busy) return;
    // A tab opened now, while the tap still counts, so the browser doesn't block it.
    const tab = kind === 'wa' ? window.open('about:blank', '_blank') : null;
    setBusy(kind);
    try {
      const n = await numbers(d._id);
      if (kind === 'call') {
        const tel = String(n.phone || n.whatsapp).replace(/[^\d+]/g, '');
        if (!tel) throw new Error('none');
        window.location.href = `tel:${tel}`;
        toast.message(`${d.name}`, { description: n.phone || n.whatsapp });
      } else {
        const wa = waNumber(n.whatsapp || n.phone);
        if (!wa) throw new Error('none');
        const url = `https://wa.me/${wa}`;
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      tab?.close();
      toast.error(e?.message === 'busy' ? 'Too many requests — please wait a minute and try again.' : "Couldn't get this dealer's number. Please try from their profile.");
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="relative z-20 flex gap-2">
      {hasPhone && (
        <button
          type="button"
          onClick={() => void open('call')}
          disabled={!!busy}
          className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-400 bg-white font-semibold text-slate-900 hover:border-slate-900 disabled:opacity-70', h)}
          aria-label={`Call ${d.name}`}
        >
          <PhoneGlyph className="h-4 w-4" /> {busy === 'call' ? 'Calling…' : 'Call'}
        </button>
      )}
      {hasWa && (
        <button
          type="button"
          onClick={() => void open('wa')}
          disabled={!!busy}
          className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1a9e52] font-semibold text-white hover:bg-[#15843f] disabled:opacity-70', h)}
          aria-label={`WhatsApp ${d.name}`}
        >
          <WhatsAppGlyph className="h-4 w-4" /> WhatsApp
        </button>
      )}
      {!hasPhone && !hasWa && (
        <Link href={dealerHref(d)} className={cn('inline-flex flex-1 items-center justify-center rounded-md border border-slate-400 bg-white font-semibold text-slate-900', h)}>
          View profile
        </Link>
      )}
    </div>
  );
}
