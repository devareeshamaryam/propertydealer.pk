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
  const { slug } = await params; // ✅ await params
  try {
    const rate = await serverApi.getCementRateBySlug(slug);
    return {
      title: `${rate.brand} Price in Pakistan — ${rate.weightKg ?? 50} Kg Bag | PropertyDealer.pk`,
      description: `Today's ${rate.brand} cement price is Rs ${rate.price}. Check latest updates and order online.`,
      openGraph: {
        title: `${rate.brand} Cement Price Today`,
        description: `Rs ${rate.price}`,
        images: rate.image
          ? [`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005').replace(/\/$/, '')}${rate.image.startsWith('/') ? '' : '/'}${rate.image}`]
          : [],
      },
    };
  } catch {
    return { title: "Cement Rate | PropertyDealer.pk" };
  }
}

export default async function CementDetailPage({ params }: Props) {
  const { slug } = await params; // ✅ await params

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