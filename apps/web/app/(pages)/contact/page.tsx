import type { Metadata } from 'next';
import StaticPageView from '@/components/StaticPageView';
import { pageMetadata } from '@/lib/seo/page-seo';

/*
 * /contact — the text is edited in Dashboard → Static Pages (slug "contact"), as
 * are its Meta Title and Meta Description; the values here are the fallback.
 */

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('contact', {
    title: 'Contact PropertyDealer — Phone, WhatsApp & Email',
    description: 'Get in touch with PropertyDealer by phone, WhatsApp or email — for listing help, packages for agents, advertising or to report a problem.',
    path: '/contact',
  });
}

export default function ContactPage() {
  return (
    <StaticPageView
      slug="contact"
      title="Contact us"
      contactFirst
      fallback={<p className="mt-4 text-[15.5px] leading-relaxed text-slate-700">We are happy to help — with posting a property, choosing a package, a problem with a listing, or advertising on the site. Call, WhatsApp or email us using the details on this page.</p>}
    />
  );
}
