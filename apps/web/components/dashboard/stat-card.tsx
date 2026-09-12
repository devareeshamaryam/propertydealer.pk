"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: "bg-muted text-muted-foreground", value: "text-foreground" },
  success: {
    icon: "bg-emerald-50 text-emerald-600",
    value: "text-emerald-700",
  },
  warning: { icon: "bg-amber-50 text-amber-600", value: "text-amber-700" },
  danger: { icon: "bg-red-50 text-red-600", value: "text-red-700" },
  info: { icon: "bg-blue-50 text-blue-600", value: "text-blue-700" },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  tone?: StatTone;
  hint?: string;
  /** Makes the whole card a link into the filtered list view. */
  href?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  href,
  loading,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            styles.icon,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p
          className={cn(
            "mt-3 text-3xl font-semibold tabular-nums tracking-tight",
            styles.value,
          )}
        >
          {typeof value === "number" ? value.toLocaleString("en-PK") : value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = cn(
    "rounded-xl border bg-card p-5 shadow-sm transition-shadow",
    href &&
      "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, "block")}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
