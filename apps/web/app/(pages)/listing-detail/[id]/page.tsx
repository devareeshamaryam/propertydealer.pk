import PropertyDetail from '@/components/PropertyDetail';

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PropertyDetail slug={id} />;
}

// Optional: Metadata
export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Property Details - ${id}`,
    description: 'View property details',
    alternates: {
      canonical: `/listing-detail/${id}`,
    },
  };
}