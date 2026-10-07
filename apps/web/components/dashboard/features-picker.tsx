"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";

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
  disabled?: boolean;
  label?: string;
}

/**
 * Features, ticked rather than typed.
 *
 * Each one used to be a free-text box, so the same feature arrived spelled six
 * ways and nothing could ever be filtered on. The list shown depends on the
 * property type — a plot has no false ceiling, an office has no servant
 * quarter — and anything already on the listing that is not in the catalogue
 * is kept as a custom chip, so editing an old listing never quietly drops what
 * someone wrote.
 */
export function FeaturesPicker({
  value,
  onChange,
  propertyType,
  disabled,
  label = "Property features",
}: FeaturesPickerProps) {
  const [customDraft, setCustomDraft] = useState("");

  const groups = useMemo(() => featureGroupsFor(propertyType), [propertyType]);
  const selected = useMemo(() => new Set(value), [value]);

  /**
   * What this listing already says that the catalogue does not offer — either
   * typed before this picker existed, or added below.
   */
  const custom = useMemo(
    () => value.filter((feature) => !ALL_KNOWN_FEATURES.has(feature)),
    [value],
  );

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

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {group.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.features.map((feature) => {
                const on = selected.has(feature);
                return (
                  <button
                    key={feature}
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
              })}
            </div>
          </div>
        ))}
      </div>

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
