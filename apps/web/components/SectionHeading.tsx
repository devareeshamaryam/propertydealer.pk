import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One way to title a section, used by every homepage block.
 *
 * Each section used to invent its own: a black pill eyebrow ("FEATURED
 * LISTINGS"), a 48px extrabold two-line headline, a large grey paragraph and a
 * 48px bottom margin — repeated eight times down one page, with the sizes
 * drifting slightly between them. That repetition of oversized, slightly
 * different headers is one of the clearest tells of a generated page.
 *
 * Listing portals title a section the way a newspaper does: a plain heading
 * at 20–24px, one line of context under it, and a "View all" on the right.
 */
export function SectionHeading({
  title,
  description,
  action,
  className,
  as: Tag = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 sm:mb-6", className)}>
      <div className="min-w-0">
        <Tag className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </Tag>
        {description && (
          <p className="mt-1 text-sm text-slate-500 sm:text-[15px]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
