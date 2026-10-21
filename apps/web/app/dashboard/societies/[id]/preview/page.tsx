"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/components/dashboard";
import SocietyGuideView from "@/components/societies/SocietyGuideView";
import { societyApi } from "@/lib/api/society.api";
import type { SocietyPage } from "@/lib/societies";

/** The guide as visitors will see it — also before it is published. */
export default function SocietyPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<SocietyPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    societyApi
      .get(id)
      .then((d) => societyApi.preview(d.citySlug, d.slug))
      .then(setPage)
      .catch((e) => setError(apiErrorMessage(e, "Save it as a society first")));
  }, [id]);

  return (
    <div className="-mx-4 -my-4 sm:-mx-6">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-2.5">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/societies/${id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to editing
          </Link>
        </Button>
      </div>
      {error ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{error}</p>
      ) : page ? (
        <SocietyGuideView s={page} map={null} listings={[]} preview />
      ) : (
        <div className="space-y-4 p-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
    </div>
  );
}
