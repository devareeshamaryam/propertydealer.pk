'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GA_MEASUREMENT_ID = 'G-GFGWSFNVDS';

/**
 * Component for injecting JSON-LD Structured Data for SEO
 */
export default function StructuredData() {
  const pathname = usePathname();
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
        'email': 'info@propertydealer.pk',
        'telephone': '+923030119992',
        'sameAs': [],
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
        'telephone': '+92 3030119992',
        'email': 'info@propertydealer.pk',
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
      telephone: '+923030119992',
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
