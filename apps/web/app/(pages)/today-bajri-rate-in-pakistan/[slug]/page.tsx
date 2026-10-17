 import { serverApi, isNotFoundError } from "@/lib/server-api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MaterialDetailClient from "@/components/MaterialRate/MaterialDetailClient";


const SITE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk').replace(/\/$/, '');

/* Rendered on first visit, then cached; refreshed every 10 minutes and when rates change. */
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const rate = await serverApi.getBajriRateBySlug(slug);
    return {
      alternates: { canonical: `${SITE}/today-bajri-rate-in-pakistan/${slug}` },
      title: `${rate.brand} Bajri Price in Pakistan | PropertyDealer.pk`,
      description: `Today's ${rate.brand} bajri price is Rs ${rate.price}/${rate.unit}. Check latest rates and order online.`,
      openGraph: {
        title: `${rate.brand} Bajri Price Today`,
        description: `Rs ${rate.price}/${rate.unit}`,
        images: rate.image
          ? [`${SITE}${rate.image.startsWith('/') ? '' : '/'}${rate.image}`]
          : [],
      },
    };
  } catch {
    return {
      alternates: { canonical: `${SITE}/today-bajri-rate-in-pakistan/${slug}` }, title: "Bajri Rate | PropertyDealer.pk" };
  }
}

export default async function BajriDetailPage({ params }: Props) {
  const { slug } = await params;
  let rate: any;
  try {
    rate = await serverApi.getBajriRateBySlug(slug);
  } catch (e) {
    // 404 only when the rate really is gone; an API that is down keeps the cached page.
    if (isNotFoundError(e)) notFound();
    throw e;
  }
  return <MaterialDetailClient rate={rate} materialType="Bajri" />;
}