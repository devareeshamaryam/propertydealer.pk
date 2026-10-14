"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  ALL_KNOWN_FEATURES,
  featureGroupsFor,
} from "@/lib/property-features";
import { cn } from "@/lib/utils";

interface FeaturesPickerProps {
  value: string[];
  onChange: (features: string[]) => void;
  /** Capitalised property type ("House", "Plot", …) — decides which groups show. */
  propertyType?: string;
  /** Rent or sale — hides the half of the terms that belongs to the other one. */
  purpose?: "rent" | "sale";
  disabled?: boolean;
  label?: string;
}

/**
 * Features, ticked rather than typed — a few at a time.
 *
 * Each one used to be a free-text box, so the same feature arrived spelled six
 * ways and nothing could be filtered on. Then the catalogue grew to a couple
 * of hundred entries and the opposite problem appeared: a house opened with
 * about a hundred and seventy chips laid out at once, which is not a form
 * anybody fills in, it is a wall somebody scrolls past.
 *
 * So the list is cut twice. By type and purpose, in featureGroupsFor — a plot
 * is not asked about false ceilings, a sale is not asked whether bachelors are
 * allowed. And by the page itself: groups are closed until opened, so what
 * greets the agent is a dozen headings rather than everything. A group that
 * already has ticks opens on its own, so nothing is hidden on an edit, and the
 * search box reaches any feature without knowing which group it lives in.
 *
 * Anything already on the listing that is not in the catalogue is kept as a
 * custom chip, so editing an old listing never quietly drops what someone
 * wrote.
 */
export function FeaturesPicker({
  value,
  onChange,
  propertyType,
  purpose,
  disabled,
  label = "Property features",
}: FeaturesPickerProps) {
  const [customDraft, setCustomDraft] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => featureGroupsFor(propertyType, purpose),
    [propertyType, purpose],
  );
  const selected = useMemo(() => new Set(value), [value]);

  /*
   * Which groups start open: the first, plus any the listing already has ticks
   * in. Keyed by title and recomputed when the type changes, because changing
   * the type changes which groups exist.
   */
  useEffect(() => {
    setOpen((previous) => {
      const next: Record<string, boolean> = {};
      groups.forEach((group, index) => {
        const hasPicks = group.features.some((feature) => selected.has(feature));
        next[group.title] = previous[group.title] ?? (index === 0 || hasPicks);
      });
      return next;
    });
    // `selected` is deliberately not a dependency: this decides the opening
    // state, and re-running it on every tick would re-open groups the person
    // had just collapsed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  /**
   * What this listing already says that the catalogue does not offer — either
   * typed before this picker existed, or added below.
   */
  const custom = useMemo(
    () => value.filter((feature) => !ALL_KNOWN_FEATURES.has(feature)),
    [value],
  );

  const needle = query.trim().toLowerCase();

  /** Search ignores groups entirely — you rarely know which one it is in. */
  const matches = useMemo(() => {
    if (!needle) return [];
    const found: string[] = [];
    for (const group of groups) {
      for (const feature of group.features) {
        if (feature.toLowerCase().includes(needle) && !found.includes(feature)) {
          found.push(feature);
        }
      }
    }
    return found.slice(0, 40);
  }, [needle, groups]);

  const toggle = (feature: string) => {
    if (disabled) return;
    onChange(
      selected.has(feature)
        ? value.filter((item) => item !== feature)
        : [...value, feature],
    );
  };

  const addCustom = () => {
    const text = customDraft.trim();
    if (!text || selected.has(text)) {
      setCustomDraft("");
      return;
    }
    onChange([...value, text]);
    setCustomDraft("");
  };

  const Chip = ({ feature }: { feature: string }) => {
    const on = selected.has(feature);
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => toggle(feature)}
        aria-pressed={on}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
          on
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50",
        )}
      >
        {on && <Check className="h-3.5 w-3.5" />}
        {feature}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="block text-sm font-semibold text-gray-700">
          {label}
        </Label>
        <span className="text-xs text-gray-500">
          {value.length > 0
            ? `${value.length} selected`
            : "Tap whatever applies — buyers filter on these"}
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search features — e.g. solar, servant, corner"
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-9 text-sm focus:border-transparent focus:ring-2 focus:ring-gray-800 disabled:opacity-50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {needle ? (
        <div>
          {matches.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">
              Nothing matches “{query}”. Add it as your own below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {matches.map((feature) => (
                <Chip key={feature} feature={feature} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y rounded-xl border">
          {groups.map((group) => {
            const picked = group.features.filter((feature) =>
              selected.has(feature),
            ).length;
            const isOpen = open[group.title] ?? false;

            return (
              <div key={group.title}>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((previous) => ({
                      ...previous,
                      [group.title]: !isOpen,
                    }))
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-gray-50"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    {group.title}
                  </span>
                  {picked > 0 && (
                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                      {picked}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {group.features.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="flex flex-wrap gap-2 px-3 pb-4">
                    {group.features.map((feature) => (
                      <Chip key={feature} feature={feature} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Anything the list does not cover. */}
      <div className="border-t pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Something else
        </p>

        {custom.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {custom.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm text-sky-900"
              >
                {feature}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(feature)}
                  aria-label={`Remove ${feature}`}
                  className="text-sky-700 hover:text-sky-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={customDraft}
            onChange={(event) => setCustomDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="e.g. Tube well with filtration"
            disabled={disabled}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-gray-800 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={disabled || !customDraft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
