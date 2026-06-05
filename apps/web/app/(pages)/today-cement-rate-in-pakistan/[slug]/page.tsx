 import { serverApi } from "@/lib/server-api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CementDetailClient from "./CementDetailClient";
import { CartProvider } from "@/contexts/CartContext";

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
      ? `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005').replace(/\/$/, '')}${rate.image.startsWith('/') ? '' : '/'}${rate.image}`
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
  } catch {
    notFound();
  }

  return (
    <CartProvider>
      <CementDetailClient rate={rate} />
    </CartProvider>
  );
}