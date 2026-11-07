import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ToolIcon } from '@/components/tools/ToolShell';
import { getToolPage } from '@/lib/server-api';
import { fillYear, toolPageMetadata, toolPageText } from '@/lib/tool-pages';
import { TOOLS } from '@/lib/tools';

export async function generateMetadata(): Promise<Metadata> {
  return toolPageMetadata('index', await getToolPage('index'));
}

export default async function ToolsPage() {
  const [first, ...rest] = TOOLS;
  // The admin's heading, intro, text and questions (Dashboard → Tool Pages).
  const saved = await getToolPage('index');
  const { heading, intro } = toolPageText('index', saved);
  const faqs = saved?.faqs ?? [];
  return (
    <main className="min-h-screen bg-slate-100 pb-14">
      <div className="border-b border-slate-300 bg-white">
        <div className="container mx-auto px-[var(--gutter)] py-5 sm:px-4 sm:py-8">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[34px]">{heading}</h1>
          <p className="mt-1 max-w-2xl text-[14.5px] text-slate-600 sm:text-[15.5px]">{intro}</p>
        </div>
      </div>

      <div className="container mx-auto space-y-4 px-[var(--gutter)] pt-5 sm:px-4 sm:pt-8">
        {/* The most used tool, as a wide card */}
        {first && (
          <Link href={`/tools/${first.slug}`} className="group flex items-center gap-4 rounded-xl bg-white p-4 border border-slate-300 transition-colors hover:border-primary sm:p-5">
            <ToolIcon tool={first} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] font-extrabold text-slate-900 group-hover:text-primary">{first.title}</span>
              <span className="block text-[14px] text-slate-600">{first.short}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-primary" />
          </Link>
        )}

        {/* The rest, as app icons */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((t) => (
            <Link key={t.slug} href={`/tools/${t.slug}`} className="group flex flex-col items-start gap-3 rounded-xl bg-white p-4 border border-slate-300 transition-colors hover:border-primary">
              <ToolIcon tool={t} />
              <span>
                <span className="block text-[15px] font-bold leading-tight text-slate-900 group-hover:text-primary">{t.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600">{t.short}</span>
              </span>
            </Link>
          ))}
        </div>

        {saved?.content && (
          <section className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-5 sm:px-6 sm:py-6">
            {saved.contentTitle && <h2 className="mb-3 text-[19px] font-bold leading-snug text-slate-900 sm:text-[21px]">{fillYear(saved.contentTitle)}</h2>}
            <div
              className="prose max-w-none text-[15px] leading-relaxed text-slate-700 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: saved.content }}
            />
          </section>
        )}

        {faqs.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
                }).replace(/</g, '\\u003c'),
              }}
            />
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
      </div>
    </main>
  );
}
