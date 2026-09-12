"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  CheckCircle2,
  FileArchive,
  FileCode2,
  Info,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { importApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DataCard, DataCardTitle, PageHeader } from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface ImportForm {
  xml: FileList;
  imagesXml: FileList;
  zip: FileList;
}

interface ImportResult {
  totalFound?: number;
  imported?: number;
  skipped?: number;
  imageMapSize?: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileFieldProps {
  id: string;
  label: string;
  hint: string;
  accept: string;
  icon: React.ComponentType<{ className?: string }>;
  required?: boolean;
  file?: File;
  onClear: () => void;
  register: ReturnType<typeof useForm<ImportForm>>["register"];
  name: keyof ImportForm;
}

/**
 * Drop zone that actually reports what was picked. The previous version gave
 * no feedback at all after choosing a file, and positioned its file input
 * `absolute` inside a label with no positioning context, so the invisible hit
 * area escaped its own card.
 */
function FileField({
  id,
  label,
  hint,
  accept,
  icon: Icon,
  required,
  file,
  onClear,
  register,
  name,
}: FileFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}{" "}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClear}
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="relative flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed bg-muted/30 transition-colors hover:border-primary/50 hover:bg-accent"
        >
          <Icon className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Click to upload</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <input
            id={id}
            {...register(name)}
            type="file"
            accept={accept}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      )}
    </div>
  );
}

export default function ImportPage() {
  const { register, handleSubmit, reset, watch, setValue } =
    useForm<ImportForm>();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const xmlList = watch("xml");
  const imagesXmlList = watch("imagesXml");
  const zipList = watch("zip");

  const xmlFile = xmlList?.[0];
  const imagesXmlFile = imagesXmlList?.[0];
  const zipFile = zipList?.[0];

  // Warn before leaving mid-import — a WXR import can take a while and there
  // is no resume.
  useEffect(() => {
    if (!isLoading) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isLoading]);

  const clearField = (name: keyof ImportForm) =>
    setValue(name, undefined as unknown as FileList, { shouldDirty: true });

  const onSubmit = async (data: ImportForm) => {
    const xml = data.xml?.[0];
    if (!xml) {
      toast.error("Select a WordPress export file", {
        description: "The XML file is required to start an import.",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("xml", xml);

    const imagesXml = data.imagesXml?.[0];
    if (imagesXml) formData.append("imagesXml", imagesXml);

    const zip = data.zip?.[0];
    if (zip) formData.append("zip", zip);

    try {
      const response = await importApi.importWordPress(formData);
      setResult(response);
      toast.success("Import finished", {
        description: `${response?.imported ?? 0} of ${response?.totalFound ?? 0} listings imported.`,
      });
      reset();
    } catch (err) {
      console.error("Import Error:", err);
      toast.error("Import failed", {
        description: apiErrorMessage(
          err,
          "Check the file format and try again.",
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader
        title="Bulk Import"
        description="Import properties from a WordPress WXR export."
      />

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-blue-600" />
        <div className="space-y-1">
          <p className="font-medium">How this works</p>
          <p className="text-blue-800">
            Upload the WordPress export (WXR) file. Optionally add an images XML
            for image URLs, or a ZIP of the uploads folder to sync image files.
            Existing listings with a matching slug are skipped, not overwritten.
          </p>
        </div>
      </div>

      <DataCard>
        <DataCardTitle hint="XML is required; the other two are optional">
          Source files
        </DataCardTitle>

        <Separator className="my-5" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FileField
            id="import-xml"
            name="xml"
            label="WordPress export file"
            hint=".xml (WXR) files only"
            accept=".xml"
            icon={FileCode2}
            required
            file={xmlFile}
            onClear={() => clearField("xml")}
            register={register}
          />

          <FileField
            id="import-images-xml"
            name="imagesXml"
            label="Images XML"
            hint="Maps attachment IDs to image URLs"
            accept=".xml"
            icon={FileCode2}
            file={imagesXmlFile}
            onClear={() => clearField("imagesXml")}
            register={register}
          />

          <FileField
            id="import-zip"
            name="zip"
            label="Images archive"
            hint=".zip of wp-content/uploads"
            accept=".zip"
            icon={FileArchive}
            file={zipFile}
            onClear={() => clearField("zip")}
            register={register}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading || !xmlFile}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing — do not close this tab…
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Start import
              </>
            )}
          </Button>
        </form>
      </DataCard>

      {result && (
        <DataCard className={cn("border-emerald-200 bg-emerald-50/50")}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900">Import results</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-white">
                  Found:{" "}
                  <span className="ml-1 font-semibold">
                    {result.totalFound ?? 0}
                  </span>
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  Imported:{" "}
                  <span className="ml-1 font-semibold">
                    {result.imported ?? 0}
                  </span>
                </Badge>
                <Badge variant="secondary">
                  Skipped:{" "}
                  <span className="ml-1 font-semibold">
                    {result.skipped ?? 0}
                  </span>
                </Badge>
                {result.imageMapSize !== undefined && (
                  <Badge variant="outline" className="bg-white">
                    Images mapped:{" "}
                    <span className="ml-1 font-semibold">
                      {result.imageMapSize}
                    </span>
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 bg-white"
                asChild
              >
                <Link href="/dashboard/property">
                  Review imported properties
                </Link>
              </Button>
            </div>
          </div>
        </DataCard>
      )}
    </div>
  );
}
