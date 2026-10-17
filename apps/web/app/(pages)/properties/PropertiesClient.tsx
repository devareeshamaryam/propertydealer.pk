'use client'

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PropertiesListing from '@/components/PropertiesListing';
import SearchParamsBridge from '@/components/SearchParamsBridge';
import { Property } from '@/lib/data';

interface PropertiesClientProps {
  initialProperties?: Property[];
}

/*
 * /properties. The list is rendered on the server with the newest listings;
 * old query-string links (?purpose=…&city=…&type=…) are sent on to their clean
 * URL once the query string is known in the browser. The query string comes
 * through <SearchParamsBridge> so the page itself is not rendered in the
 * browser only (which useSearchParams() here would cause on a cached page).
 */
export default function PropertiesClient({ initialProperties }: PropertiesClientProps) {
  const router = useRouter();
  const [params, setParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    if (!params) return;
    const purpose = params.get('purpose');
    const city = params.get('city') || '';
    const type = params.get('type') || '';
    if (!purpose && !city && !type) return;

    const pp = purpose === 'buy' ? 'sale' : purpose === 'rent' ? 'rent' : null;
    const cSlug = city ? city.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') : '';
    const tSlug = type && type !== 'all' ? `/${type.toLowerCase()}` : '';
    if (pp) router.replace(cSlug ? `/properties/${pp}/${cSlug}${tSlug}` : `/properties/${pp}${tSlug}`);
    else router.replace(cSlug ? `/properties/all/${cSlug}${tSlug}` : tSlug ? `/properties/all${tSlug}` : '/properties');
  }, [params, router]);

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsBridge onChange={setParams} />
      </Suspense>
      <PropertiesListing purpose="all" city="" type="all" useCleanUrls={true} initialProperties={initialProperties} />
    </>
  );
}
