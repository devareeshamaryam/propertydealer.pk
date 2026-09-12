"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/** Skeleton rows sized to the real table, so the layout does not jump on load. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton
                className="h-4"
                style={{
                  width:
                    colIndex === 0
                      ? "70%"
                      : colIndex === columns - 1
                        ? "50%"
                        : "60%",
                }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

interface StateRowProps {
  colSpan: number;
  children: ReactNode;
}

function StateRow({ colSpan, children }: StateRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-auto py-16 text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}

/** Nothing exists yet — offer the create action. */
export function EmptyRow({
  colSpan,
  icon: Icon,
  title,
  description,
  action,
}: {
  colSpan: number;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateRow colSpan={colSpan}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div>
          <p className="font-medium text-foreground">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
    </StateRow>
  );
}

/**
 * Rows exist but the current search/filter matched none. Distinct from
 * EmptyRow — the fix here is clearing the filter, not creating a record.
 */
export function NoResultsRow({
  colSpan,
  search,
  onReset,
}: {
  colSpan: number;
  search?: string;
  onReset: () => void;
}) {
  return (
    <StateRow colSpan={colSpan}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">No matching results</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? (
              <>
                Nothing matched “
                <span className="font-medium text-foreground">{search}</span>”.
              </>
            ) : (
              <>No rows match the current filters.</>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          Clear filters
        </Button>
      </div>
    </StateRow>
  );
}

/** Request failed — show the reason and a retry that re-runs the fetch. */
export function ErrorRow({
  colSpan,
  message,
  onRetry,
}: {
  colSpan: number;
  message: string;
  onRetry: () => void;
}) {
  return (
    <StateRow colSpan={colSpan}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <p className="font-medium text-foreground">Could not load data</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    </StateRow>
  );
}
