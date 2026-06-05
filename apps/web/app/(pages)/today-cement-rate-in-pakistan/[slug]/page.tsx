 import { serverApi } from "@/lib/server-api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CementDetailClient from "./CementDetailClient";
import { CartProvider } from "@/contexts/CartContext";

// Next.js 15: params is now a Promise
interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const rate = await serverApi.getCementRateBySlug(slug);

    // ✅ DB se metaTitle/metaDescription use karo — agar nahi hai toh fallback
    const title = rate.metaTitle?.trim()
      || `${rate.brand} Price in Pakistan — ${rate.weightKg ?? 50} Kg Bag | PropertyDealer.pk`;

    const description = rate.metaDescription?.trim()
      || `Today's ${rate.brand} cement price is Rs ${rate.price}. Check latest updates and order online.`;

    const imageUrl = rate.image
      ? `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005').replace(/\/$/, '')}${rate.image.startsWith('/') ? '' : '/'}${rate.image}`
      : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
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