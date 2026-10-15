'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved } from '@/lib/site-settings';

/**
 * Component for injecting JSON-LD Structured Data for SEO
 */
export default function StructuredData() {
  const pathname = usePathname();
  // Contact details, socials and the Analytics id come from Settings → General.
  const r = resolved(useSiteSettings());
  const GA_MEASUREMENT_ID = r.gaId;
  const phone = r.phone.replace(/[^\d+]/g, '');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';
  const siteUrlWithSlash = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;

  // Home Page Specific Schema Graph
  const homePageSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrlWithSlash}#organization`,
        'name': 'Property Dealer',
        'url': siteUrlWithSlash,
        'logo': {
          '@type': 'ImageObject',
          'url': `${siteUrlWithSlash}logo.png`
        },
        'email': r.email,
        'telephone': phone,
        'sameAs': r.socials.map(([, url]) => url),
        'description': 'Property Dealer is a property buying and selling marketplace across Pakistan, connecting buyers and sellers for residential and commercial real estate.'
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrlWithSlash}#website`,
        'url': siteUrlWithSlash,
        'name': 'Property Dealer',
        'publisher': {
          '@id': `${siteUrlWithSlash}#organization`
        },
        'potentialAction': {
          '@type': 'SearchAction',
          'target': `${siteUrlWithSlash}properties/all?search={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'RealEstateAgent',
        '@id': `${siteUrlWithSlash}#realestateagent`,
        'name': 'Property Dealer',
        'url': siteUrlWithSlash,
        'image': `${siteUrlWithSlash}logo.png`,
        'telephone': phone,
        'email': r.email,
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Multan',
          'addressCountry': 'PK'
        },
        'areaServed': [
          { '@type': 'Country', 'name': 'Pakistan' },
          { '@type': 'City', 'name': 'Lahore' },
          { '@type': 'City', 'name': 'Islamabad' },
          { '@type': 'City', 'name': 'Karachi' },
          { '@type': 'City', 'name': 'Multan' },
          { '@type': 'City', 'name': 'Gujranwala' },
          { '@type': 'City', 'name': 'Faisalabad' }
        ],
        'parentOrganization': {
          '@id': `${siteUrlWithSlash}#organization`
        }
      }
    ]
  };

  // General organization data for other pages
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrlWithSlash}#organization`,
    name: 'Property Dealer',
    url: siteUrlWithSlash,
    logo: `${siteUrlWithSlash}logo.png`,
    description: 'Property Dealer is a property buying and selling marketplace across Pakistan.',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PK',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: phone,
      contactType: 'customer service',
    },
  };

  return (
    <>
      {pathname === '/' ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
        />
      ) : (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
        />
      )}

      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
