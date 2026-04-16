 // app/hotels/[id]/page.tsx
import { notFound } from 'next/navigation';
import { hotels } from '@/lib/data';
import HotelDetailClient from '@/components/HotelDetailClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function HotelDetailPage(props: PageProps) {
  // Next.js 15: params is now a Promise, must await it
  const params = await props.params;
  const hotel = hotels.find((h) => h.id === params.id);

  if (!hotel) {
    notFound();
  }

  return <HotelDetailClient hotel={hotel} />;
}