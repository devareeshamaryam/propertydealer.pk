import type { Metadata } from 'next';
import { BadgeCheck, ClipboardList, PhoneCall, Search } from 'lucide-react';
import FindPropertyForm from '@/components/find-property/FindPropertyForm';
import { getSiteName } from '@/lib/site-settings.server';

/*
 * /find-property-for-me — for people who would rather not search themselves:
 * they say what they want, and the team finds it and calls them. Requests
 * arrive in Dashboard → Property requests and on Discord.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
    title: `Find a Property for Me — Tell Us What You Need | ${site}`,
    description:
      'Tell us the area, budget and size you want — house, plot, flat or shop, to buy or rent — and our team will find matching properties and call you. Free.',
    alternates: { canonical: `${BASE_URL}/find-property-for-me` },
  };
}

const STEPS = [
  { icon: ClipboardList, title: 'Tell us what you need', text: 'Area, budget, size and type — a minute is enough.' },
  { icon: Search, title: 'We search for you', text: 'Our team checks live listings and trusted dealers.' },
  { icon: PhoneCall, title: 'We call you with options', text: 'Shortlisted properties on call or WhatsApp.' },
];

export default async function FindPropertyForMePage() {
  const site = await getSiteName();
  return (
    <main className="min-h-screen bg-slate-100 pb-14">
      <div className="border-b border-slate-300 bg-white">
        <div className="container mx-auto px-[var(--gutter)] py-6 sm:px-4 sm:py-9">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">Free service</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[34px]">Find a property for me</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-slate-600 sm:text-[16px]">
            Don&apos;t have time to search? Tell us what you&apos;re looking for and the {site} team will find it and call you.
          </p>
        </div>
      </div>

      <div className="container mx-auto grid gap-6 px-[var(--gutter)] pt-5 sm:px-4 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <FindPropertyForm />

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-slate-300 bg-white p-5">
            <h2 className="text-[16px] font-bold text-slate-900">How it works</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <s.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-semibold text-slate-900">
                      {i + 1}. {s.title}
                    </span>
                    <span className="block text-[13.5px] text-slate-500">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-slate-300 bg-white p-5 text-[13.5px] text-slate-600">
            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
              <BadgeCheck className="h-4 w-4 text-emerald-600" /> Your number stays private
            </p>
            <p className="mt-1">We use it only to contact you about this request — no promotions, no spam.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
