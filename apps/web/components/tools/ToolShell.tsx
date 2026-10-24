import Link from 'next/link';
import { BookOpen, ChevronDown } from 'lucide-react';
import { AdZone } from '@/components/ads/AdSlot';
import { TOOLS, type ToolInfo } from '@/lib/tools';
import ToolArt from './ToolArt';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export interface Faq {
  q: string;
  a: string;
}

/** A tool's own picture — the same on the tools screen and on the tool. */
export function ToolIcon({ tool, size = 'md' }: { tool: ToolInfo; size?: 'sm' | 'md' | 'lg' }) {
  return <ToolArt tool={tool} size={size} />;
}

/**
 * The frame every tool shares, laid out like an app screen: a bar with back,
 * the tool's icon and name, and share; the tool itself; then — folded away
 * until wanted — how it works and the questions people ask; and the other
 * tools as icons.
 */
export default function ToolShell({
  tool,
  heading,
  intro,
  children,
  guide,
  faqs = [],
  page,
}: {
  tool: ToolInfo;
  heading?: string;
  intro: string;
  children: React.ReactNode;
  guide?: React.ReactNode;
  faqs?: Faq[];
  /** A page under the tool (a ready-made estimate): its title and path. */
  page?: { title: string; path: string };
}) {
  const toolUrl = `${BASE_URL}/tools/${tool.slug}`;
  const url = page ? `${BASE_URL}${page.path}` : toolUrl;
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page?.title ?? heading ?? tool.title,
      url,
      description: tool.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'PKR' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: `${BASE_URL}/tools` },
        { '@type': 'ListItem', position: 3, name: tool.title, item: toolUrl },
        ...(page ? [{ '@type': 'ListItem', position: 4, name: page.title, item: url }] : []),
      ],
    },
    ...(faqs.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]
      : []),
  ];
  const others = TOOLS.filter((t) => t.slug !== tool.slug);

  return (
    <main className="min-h-screen bg-slate-100 pb-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />

      {/* Title: the tool's picture, its name and one line on what it does. */}
      <div className="border-b border-slate-300 bg-white print:border-0">
        <div className="container mx-auto px-[var(--gutter)] py-4 sm:px-4 sm:py-6">
          <nav aria-label="Breadcrumb" className="mb-2 hidden text-[13px] font-medium text-slate-600 sm:block print:hidden">
            <Link href="/" className="hover:text-primary">Home</Link> ›{' '}
            <Link href="/tools" className="hover:text-primary">Tools</Link>
            {page && (
              <>
                {' '}›{' '}
                <Link href={`/tools/${tool.slug}`} className="hover:text-primary">
                  {tool.title}
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <span className="hidden sm:block">
              <ToolArt tool={tool} size="lg" />
            </span>
            <span className="sm:hidden">
              <ToolArt tool={tool} size="sm" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[21px] font-extrabold leading-tight text-slate-900 sm:text-[28px]">{heading ?? tool.title}</h1>
              <p className="mt-1 max-w-3xl text-[14.5px] leading-relaxed text-slate-700 sm:text-[15.5px]">{intro}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-[var(--gutter)] pt-4 sm:px-4 sm:pt-6">{children}</div>

      <AdZone page="tools" at="after:tool" className="my-6" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />

      <div className="container mx-auto mt-8 space-y-3 px-[var(--gutter)] sm:px-4 print:hidden">
        {guide && (
          <details className="group rounded-xl bg-white border border-slate-300 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white">
                <BookOpen className="h-4.5 w-4.5 text-slate-600" />
              </span>
              <span className="flex-1 text-[15.5px] font-bold text-slate-900">How it works</span>
              <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" />
            </summary>
            <div className="tool-guide space-y-3 px-4 pb-5 text-[15px] leading-relaxed text-slate-700 sm:px-5">{guide}</div>
          </details>
        )}

        {faqs.length > 0 && (
          <section className="overflow-hidden rounded-xl bg-white border border-slate-300">
            <h2 className="px-4 pb-1 pt-4 text-[17px] font-bold text-slate-900 sm:px-5">Questions people ask</h2>
            <div className="divide-y divide-slate-100">
              {faqs.map((f) => (
                <details key={f.q} className="group px-4 py-3.5 sm:px-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-semibold text-slate-800">
                    {f.q}
                    <ChevronDown className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-600 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="pt-4">
          <h2 className="mb-3 text-[17px] font-bold text-slate-900">More tools</h2>
          <div className="hide-scrollbar -mx-[var(--gutter)] flex gap-3 overflow-x-auto px-[var(--gutter)] pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
            {others.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="group flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-xl bg-white p-3 text-center border border-slate-300 transition-colors hover:border-primary sm:w-auto">
                <ToolIcon tool={t} />
                <span className="text-[12.5px] font-semibold leading-tight text-slate-800 group-hover:text-primary">{t.title}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
