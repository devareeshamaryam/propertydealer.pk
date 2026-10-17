import Link from 'next/link';
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { serverApi } from '@/lib/server-api';
import { getSiteSettings } from '@/lib/site-settings.server';
import { resolved, waDigits } from '@/lib/site-settings';

/*
 * About, Contact, Privacy Policy and Terms: the text comes from Dashboard →
 * Static Pages (the page with this slug), so it is edited there; the contact
 * card beside it comes from Settings → General, so phone and email are only
 * ever typed once. Without a published page, `fallback` is shown.
 */

const LINKS = [
  { href: '/properties/sale', label: 'Property for sale' },
  { href: '/properties/rent', label: 'Property for rent' },
  { href: '/emap', label: 'Search on the map' },
  { href: '/today-cement-rate-in-pakistan', label: 'Today’s construction rates' },
  { href: '/packages', label: 'Packages for agents' },
  { href: '/blog', label: 'Property guides' },
];

async function getPage(slug: string): Promise<{ title?: string; content?: string; updatedAt?: string } | null> {
  try {
    const page = await serverApi.getPageBySlug(slug);
    return page?.content ? page : null;
  } catch {
    return null;
  }
}

export default async function StaticPageView({
  slug,
  title,
  fallback,
  contactFirst = false,
}: {
  slug: string;
  title: string;
  fallback?: React.ReactNode;
  /** Contact page: the contact card leads, full width on phones. */
  contactFirst?: boolean;
}) {
  const [page, settings] = await Promise.all([getPage(slug), getSiteSettings()]);
  const r = resolved(settings);

  const contact = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-[15px] font-semibold text-slate-900">Contact us</h2>
      <ul className="mt-3 space-y-2.5 text-[14px]">
        <li>
          <a href={r.phoneHref} className="inline-flex items-center gap-2 text-slate-700 hover:text-primary">
            <Phone className="h-4 w-4 text-slate-400" /> {r.phone}
          </a>
        </li>
        <li>
          <a href={`https://wa.me/${waDigits(r.whatsapp)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-slate-700 hover:text-primary">
            <MessageCircle className="h-4 w-4 text-slate-400" /> WhatsApp {r.whatsapp}
          </a>
        </li>
        <li>
          <a href={`mailto:${r.email}`} className="inline-flex items-center gap-2 break-all text-slate-700 hover:text-primary">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" /> {r.email}
          </a>
        </li>
        {settings.address && (
          <li className="flex items-start gap-2 text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {settings.address}
          </li>
        )}
        {settings.officeHours && (
          <li className="flex items-start gap-2 text-slate-700">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {settings.officeHours}
          </li>
        )}
      </ul>
      {contactFirst && (
        <a
          href={`https://wa.me/${waDigits(r.whatsapp)}`}
          target="_blank"
          rel="noopener"
          className="btn-shape mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[15px] font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" /> Message us on WhatsApp
        </a>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <article className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{page?.title || title}</h1>
          {contactFirst && <div className="mt-5 lg:hidden">{contact}</div>}
          {page?.content ? (
            <div
              className="prose prose-slate mt-4 max-w-none text-[15.5px] leading-relaxed prose-headings:text-slate-900 prose-h2:mt-8 prose-h2:text-lg prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          ) : (
            fallback
          )}
          {page?.updatedAt && slug !== 'about' && slug !== 'contact' && (
            <p className="mt-8 text-[12.5px] text-slate-500">
              Last updated {new Date(page.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </article>
        <aside className="space-y-4 lg:pt-1">
          <div className={contactFirst ? 'hidden lg:block' : ''}>{contact}</div>
          <nav aria-label="Explore" className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 text-[15px] font-semibold text-slate-900">Explore</h2>
            <ul className="divide-y divide-slate-100">
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center justify-between px-4 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50 hover:text-primary">
                    {label}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
