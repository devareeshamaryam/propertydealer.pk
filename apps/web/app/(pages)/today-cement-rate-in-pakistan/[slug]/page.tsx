 import { serverApi, isNotFoundError } from "@/lib/server-api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CementDetailClient from "./CementDetailClient";


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
    const rate = await serverApi.getCementRateBySlug(slug);

    const title = rate.metaTitle?.trim()
      || `${rate.brand} Price in Pakistan — ${rate.weightKg ?? 50} Kg Bag | PropertyDealer.pk`;

    const description = rate.metaDescription?.trim()
      || `Today's ${rate.brand} cement price is Rs ${rate.price}. Check latest updates and order online.`;

    const imageUrl = rate.image
      ? `${SITE}${rate.image.startsWith('/') ? '' : '/'}${rate.image}`
      : undefined;

    const canonicalUrl = `https://propertydealer.pk/today-cement-rate-in-pakistan/${slug}`;

    return {
      title,
      description,
      // ✅ Canonical URL — har page ka apna unique URL
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  } catch {
    return { title: "Cement Rate | PropertyDealer.pk" };
  }
}

export default async function CementDetailPage({ params }: Props) {
  const { slug } = await params;

  let rate: any;
  try {
    rate = await serverApi.getCementRateBySlug(slug);
  } catch (e) {
    // 404 only when the rate really is gone; an API that is down keeps the cached page.
    if (isNotFoundError(e)) notFound();
    throw e;
  }

  return (
    <CementDetailClient rate={rate} />
  );
}