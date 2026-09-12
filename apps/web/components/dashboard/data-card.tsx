"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataCardProps {
  children: ReactNode;
  className?: string;
  /** Removes inner padding — use when the card wraps a full-bleed table. */
  flush?: boolean;
}

/** The single card surface used across the dashboard. */
export function DataCard({ children, className, flush }: DataCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm",
        !flush && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataCardTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
