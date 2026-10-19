import type { Metadata } from 'next';
import StaticPageView from '@/components/StaticPageView';
import { pageMetadata } from '@/lib/seo/page-seo';
import { getSiteName } from "@/lib/site-settings.server";

/*
 * /privacy-policy — the text is edited in Dashboard → Static Pages (slug "privacy-policy"), as
 * are its Meta Title and Meta Description; the values here are the fallback.
 */

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return pageMetadata('privacy-policy', {
    title: `Privacy Policy — ${site}`,
    description: `How ${site} collects, uses and protects your information when you browse listings, create an account or post a property.`,
    path: '/privacy-policy',
  });
}

export default function PrivacyPolicyPage() {
  return (
    <StaticPageView
      slug="privacy-policy"
      title="Privacy Policy"
      fallback={<p className="mt-4 text-[15.5px] leading-relaxed text-slate-700">This page is being updated. For any question, please see our <a href="/contact" className="text-primary hover:underline">contact page</a>.</p>}
    />
  );
}
