"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BedDouble,
  Bath,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Hash,
  ImageOff,
  Loader2,
  MapPin,
  Maximize2,
  Phone,
  Ruler,
  SquarePen,
  Tag,
  User as UserIcon,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { BackendProperty } from "@/lib/types/property-utils";
import { cn } from "@/lib/utils";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center rounded-lg bg-muted">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  draft: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

/** "pending" -> "Pending"; never renders "undefinedundefined" for a missing status. */
function titleCase(value?: string) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Resolves city/area whether `area` came back populated or as a bare id. */
function resolveLocation(property: BackendProperty) {
  const area = property.area;
  if (area && typeof area === "object") {
    return {
      areaName: area.name ?? "",
      cityName: area.city?.name ?? property.city ?? "",
    };
  }
  return { areaName: "", cityName: property.city ?? "" };
}

function Field({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">
        {value || "—"}
      </div>
    </div>
  );
}

/** Image with a real in-component fallback instead of a dead placeholder host. */
function SafeImage({
  src,
  alt,
  className,
  onClick,
}: {
  src?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  // Remember which src failed rather than resetting a boolean in an effect —
  // a new src is then considered good again without an extra render pass.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-6 w-6" />
        <span className="text-xs">No image</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}

interface PropertyPreviewDialogProps {
  property: BackendProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while the detail request for this property is in flight. */
  loading?: boolean;
  /** Shown as an Edit link when the viewer may edit. */
  canEdit?: boolean;
}

export function PropertyPreviewDialog({
  property,
  open,
  onOpenChange,
  loading,
  canEdit,
}: PropertyPreviewDialogProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [galleryOwner, setGalleryOwner] = useState(property?._id);

  // Opening a different property restarts the carousel. Adjusting state during
  // render is the documented pattern for this; an effect would render the new
  // property's gallery at the old index first.
  if (property?._id !== galleryOwner) {
    setGalleryOwner(property?._id);
    setActiveImage(0);
  }

  const gallery = useMemo(() => {
    if (!property) return [] as string[];
    const images = [
      property.mainPhotoUrl,
      ...(property.additionalPhotosUrls ?? []),
    ].filter((url): url is string => Boolean(url));
    // De-duplicate: mainPhotoUrl is often repeated in additionalPhotosUrls.
    return [...new Set(images)];
  }, [property]);

  const { areaName, cityName } = property
    ? resolveLocation(property)
    : { areaName: "", cityName: "" };

  const hasCoordinates =
    typeof property?.latitude === "number" &&
    typeof property?.longitude === "number";

  const copyId = async () => {
    if (!property?._id) return;
    try {
      await navigator.clipboard.writeText(property._id);
      toast.success("Property ID copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const showPrevious = () =>
    setActiveImage((index) => (index === 0 ? gallery.length - 1 : index - 1));
  const showNext = () =>
    setActiveImage((index) => (index + 1) % gallery.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[min(96vw,1100px)] gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
        showCloseButton
      >
        {loading || !property ? (
          <div className="p-6">
            <DialogHeader className="sr-only">
              <DialogTitle>Loading property</DialogTitle>
              <DialogDescription>Fetching property details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-[280px] w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Sticky header: identity and the actions worth having at hand */}
            <DialogHeader className="space-y-0 border-b px-6 py-4 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-semibold">
                    {property.title}
                  </DialogTitle>
                  <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {[property.location, areaName, cityName]
                        .filter(Boolean)
                        .join(", ") || "Location not set"}
                    </span>
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    className={
                      STATUS_STYLES[property.status] ??
                      "bg-muted text-muted-foreground"
                    }
                  >
                    {titleCase(property.status)}
                  </Badge>
                  {canEdit && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/property/edit/${property._id}`}>
                        <SquarePen className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                  )}
                  {property.status === "approved" && property.slug && (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/property/${property.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Live page
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="grid max-h-[calc(92vh-8rem)] grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_320px]">
              {/* Main column */}
              <div className="min-w-0 p-6">
                {/* Gallery */}
                <div className="group relative overflow-hidden rounded-xl border bg-muted">
                  <SafeImage
                    src={gallery[activeImage]}
                    alt={`${property.title} — image ${activeImage + 1}`}
                    className="h-[300px] w-full object-cover sm:h-[380px]"
                  />

                  {gallery.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={showPrevious}
                        aria-label="Previous image"
                        className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={showNext}
                        aria-label="Next image"
                        className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
                        {activeImage + 1} / {gallery.length}
                      </div>
                    </>
                  )}
                </div>

                {gallery.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => setActiveImage(index)}
                        aria-label={`Show image ${index + 1}`}
                        aria-current={index === activeImage}
                        className={cn(
                          "h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                          index === activeImage
                            ? "border-primary"
                            : "border-transparent hover:border-muted-foreground/40",
                        )}
                      >
                        <SafeImage
                          src={url}
                          alt={`Thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Key specs */}
                <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border bg-muted/40 p-4 sm:grid-cols-4">
                  <Field
                    icon={BedDouble}
                    label="Bedrooms"
                    value={property.bedrooms ?? 0}
                  />
                  <Field
                    icon={Bath}
                    label="Bathrooms"
                    value={property.bathrooms ?? 0}
                  />
                  <Field
                    icon={Ruler}
                    label="Area"
                    value={
                      property.areaSize
                        ? `${property.areaSize.toLocaleString("en-PK")} sq ft`
                        : "—"
                    }
                  />
                  <Field
                    icon={Maximize2}
                    label="Plot size"
                    value={
                      property.kanal
                        ? `${property.kanal} kanal`
                        : property.marla
                          ? `${property.marla} marla`
                          : "—"
                    }
                  />
                </div>

                {/* Details tabs */}
                <Tabs defaultValue="description" className="mt-6">
                  <TabsList>
                    <TabsTrigger value="description">Description</TabsTrigger>
                    <TabsTrigger value="features">
                      Features
                      {property.features && property.features.length > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {property.features.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="location">Location</TabsTrigger>
                  </TabsList>

                  <TabsContent value="description" className="mt-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {property.description?.trim() ||
                        "No description provided."}
                    </p>
                    {property.videoUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        asChild
                      >
                        <Link
                          href={property.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Video className="mr-2 h-3.5 w-3.5" />
                          Watch video tour
                        </Link>
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="features" className="mt-4">
                    {property.features && property.features.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {property.features.map((feature, index) => (
                          <Badge
                            key={`${feature}-${index}`}
                            variant="secondary"
                            className="font-normal"
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No features or amenities listed.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="location" className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Address" value={property.location} />
                      <Field label="Area" value={areaName} />
                      <Field label="City" value={cityName} />
                      <Field
                        label="Coordinates"
                        value={
                          hasCoordinates
                            ? `${property.latitude?.toFixed(5)}, ${property.longitude?.toFixed(5)}`
                            : "Not set"
                        }
                      />
                    </div>
                    {hasCoordinates ? (
                      <PropertyMap
                        latitude={property.latitude as number}
                        longitude={property.longitude as number}
                        title={property.title}
                      />
                    ) : (
                      <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
                        <MapPin className="h-6 w-6" />
                        <p className="text-sm">
                          No map pin set for this property
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Summary rail */}
              <aside className="border-t bg-muted/30 p-6 lg:border-l lg:border-t-0">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {property.listingType === "rent"
                      ? "Monthly rent"
                      : "Total price"}
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-primary">
                    Rs {property.price?.toLocaleString("en-PK") ?? "—"}
                  </p>
                </div>

                <Separator className="my-5" />

                <div className="space-y-4">
                  <Field
                    icon={Tag}
                    label="Purpose"
                    value={
                      property.listingType === "rent" ? "For Rent" : "For Sale"
                    }
                  />
                  <Field
                    icon={Tag}
                    label="Property type"
                    value={
                      <span className="capitalize">
                        {property.propertyType}
                      </span>
                    }
                  />
                  <Field
                    icon={Phone}
                    label="Contact"
                    value={
                      property.contactNumber ? (
                        <a
                          href={`tel:${property.contactNumber}`}
                          className="hover:underline"
                        >
                          {property.contactNumber}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  {property.whatsappNumber && (
                    <Field
                      icon={Phone}
                      label="WhatsApp"
                      value={property.whatsappNumber}
                    />
                  )}
                  <Field
                    icon={UserIcon}
                    label="Listed by"
                    value={
                      property.owner && typeof property.owner === "object"
                        ? (property.owner.name ?? property.owner.email ?? "—")
                        : "—"
                    }
                  />
                  {property.source && (
                    <Field label="Source" value={property.source} />
                  )}
                </div>

                <Separator className="my-5" />

                <div className="space-y-4">
                  <Field
                    icon={Calendar}
                    label="Created"
                    value={formatDateTime(property.createdAt)}
                  />
                  <Field
                    icon={Calendar}
                    label="Last updated"
                    value={formatDateTime(property.updatedAt)}
                  />
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Property ID
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyId()}
                      className="mt-1 flex items-center gap-1.5 font-mono text-xs text-foreground transition-colors hover:text-primary"
                      title="Copy full ID"
                    >
                      <span className="truncate">{property._id}</span>
                      <Copy className="h-3 w-3 shrink-0" />
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
