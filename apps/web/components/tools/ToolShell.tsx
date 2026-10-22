import Link from 'next/link';
import { Calendar, ChevronRight, Hammer, Landmark, Ruler, TrendingUp } from 'lucide-react';
import { TOOLS, type ToolInfo } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export const TOOL_ICONS = { ruler: Ruler, hammer: Hammer, landmark: Landmark, calendar: Calendar, trending: TrendingUp } as const;

export interface Faq {
  q: string;
  a: string;
}

/**
 * The frame every tool page shares: breadcrumb, heading, the tool, a short
 * guide, questions people ask (with FAQ schema) and the other tools.
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
  /** A page under the tool (a ready-made estimate): its title and path. */
  page?: { title: string; path: string };
  tool: ToolInfo;
  heading?: string;
  intro: string;
  children: React.ReactNode;
  guide?: React.ReactNode;
  faqs?: Faq[];
}) {
  const toolUrl = `${BASE_URL}/tools/${tool.slug}`;
  const url = page ? `${BASE_URL}${page.path}` : toolUrl;
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page?.title ?? tool.title,
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
    <main className="bg-slate-50 pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <section className="border-b border-slate-200 bg-white print:border-0">
        <div className="container mx-auto px-[var(--gutter)] py-5 sm:px-4 sm:py-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-slate-500 print:hidden">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/tools" className="hover:text-primary">Tools</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            {page ? (
              <>
                <Link href={`/tools/${tool.slug}`} className="shrink-0 hover:text-primary">
                  {tool.title}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-slate-700">{page.title}</span>
              </>
            ) : (
              <span className="truncate text-slate-700">{tool.title}</span>
            )}
          </nav>
          <h1 className="mt-2 text-[25px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[34px]">{heading ?? tool.title}</h1>
          <p className="mt-1.5 max-w-3xl text-[15px] text-slate-600">{intro}</p>
        </div>
      </section>

      <div className="container mx-auto px-[var(--gutter)] pt-5 sm:px-4 sm:pt-8">{children}</div>

      {(guide || faqs.length > 0) && (
        <div className="container mx-auto mt-10 grid gap-8 px-[var(--gutter)] sm:px-4 lg:grid-cols-[1fr_340px] print:hidden">
          <div className="space-y-8">
            {guide && <div className="tool-guide max-w-3xl space-y-3 text-[15px] leading-relaxed text-slate-700">{guide}</div>}
            {faqs.length > 0 && (
              <section>
                <h2 className="text-[21px] font-bold tracking-tight text-slate-900">Questions people ask</h2>
                <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {faqs.map((f) => (
                    <details key={f.q} className="group px-4 py-3.5 sm:px-5">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-semibold text-slate-900">
                        {f.q}
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
          <aside>
            <h2 className="text-[17px] font-bold text-slate-900">More tools</h2>
            <div className="mt-3 space-y-2">
              {others.map((t) => (
                <ToolLink key={t.slug} tool={t} />
              ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export function ToolLink({ tool, big }: { tool: ToolInfo; big?: boolean }) {
  const Icon = TOOL_ICONS[tool.icon];
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className={`group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white transition-colors hover:border-primary/40 hover:shadow-sm ${big ? 'p-4 sm:p-5' : 'p-3'}`}
    >
      <span className={`grid shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ${big ? 'h-12 w-12' : 'h-10 w-10'}`}>
        <Icon className={big ? 'h-6 w-6' : 'h-5 w-5'} />
      </span>
      <span className="min-w-0">
        <span className={`block font-bold text-slate-900 group-hover:text-primary ${big ? 'text-[17px]' : 'text-[14.5px]'}`}>{tool.title}</span>
        <span className={`block text-slate-500 ${big ? 'mt-0.5 text-[14px]' : 'text-[12.5px]'}`}>{tool.short}</span>
      </span>
    </Link>
  );
}
