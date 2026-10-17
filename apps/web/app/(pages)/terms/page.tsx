import type { Metadata } from 'next';
import StaticPageView from '@/components/StaticPageView';
import { pageMetadata } from '@/lib/seo/page-seo';

/*
 * /terms — the text is edited in Dashboard → Static Pages (slug "terms"), as
 * are its Meta Title and Meta Description; the values here are the fallback.
 */

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('terms', {
    title: 'Terms of Service — PropertyDealer',
    description: 'The terms for using PropertyDealer — posting listings, packages for agents, and buying, selling or renting through the site.',
    path: '/terms',
  });
}

export default function TermsPage() {
  return (
    <StaticPageView
      slug="terms"
      title="Terms of Service"
      fallback={<p className="mt-4 text-[15.5px] leading-relaxed text-slate-700">This page is being updated. For any question, please see our <a href="/contact" className="text-primary hover:underline">contact page</a>.</p>}
    />
  );
}
