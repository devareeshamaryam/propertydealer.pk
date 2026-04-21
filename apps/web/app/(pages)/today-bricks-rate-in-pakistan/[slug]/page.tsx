import { serverApi } from "@/lib/server-api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MaterialDetailClient from "@/components/MaterialRate/MaterialDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const rate = await serverApi.getMaterialRateBySlug(slug);
    return {
      title: `${rate.brand} Bricks Price in Pakistan | PropertyDealer.pk`,
      description: `Today's ${rate.brand} bricks price is Rs ${rate.price}/${rate.unit}. Check latest rates and order online.`,
      openGraph: {
        title: `${rate.brand} Bricks Price Today`,
        description: `Rs ${rate.price}/${rate.unit}`,
        images: rate.image
          ? [`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005').replace(/\/$/, '')}${rate.image.startsWith('/') ? '' : '/'}${rate.image}`]
          : [],
      },
    };
  } catch {
    return { title: "Bricks Rate | PropertyDealer.pk" };
  }
}

export default async function BricksDetailPage({ params }: Props) {
  const { slug } = await params;

  let rate: any;
  try {
    rate = await serverApi.getMaterialRateBySlug(slug);
  } catch {
    notFound();
  }

  return <MaterialDetailClient rate={rate} materialType="Bricks" />;
}
