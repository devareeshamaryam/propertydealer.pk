"use client";

import { useAuth } from "@/context/auth-context";
import { MediaLibrary } from "@/components/media";
import { DataCard, PageHeader } from "@/components/dashboard";

/**
 * Media Library.
 *
 * The route keeps its old path — the site is live and ranked, and existing
 * bookmarks and links must not break — but the page itself is now the shared
 * WordPress-style library rather than a bespoke grid.
 *
 * It is no longer admin-only: agents upload property photos too, and the API
 * scopes every read to the caller, so an agent sees only their own uploads.
 */
export default function MediaLibraryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-[1600px] flex-col gap-5">
      <PageHeader
        title="Media Library"
        description={
          isAdmin
            ? "Every image on the site. Upload once, then reuse it anywhere."
            : "Your uploaded photos. Upload once, then reuse them on any listing."
        }
      />

      <DataCard className="flex min-h-0 flex-1 flex-col">
        <MediaLibrary mode="manage" folder="general" />
      </DataCard>
    </div>
  );
}
