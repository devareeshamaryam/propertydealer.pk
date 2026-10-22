"use client";

import { useEffect, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AREA_UNITS,
  type AreaUnit,
  fromSquareFeet,
  naturalAreaUnit,
  toSquareFeet,
} from "@/lib/pk";
import { cn } from "@/lib/utils";

interface AreaSizeFieldProps {
  /** Canonical size in square feet, as stored. */
  value: string;
  onChange: (squareFeet: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Square feet in one marla in the listing's city (225 unless the city says otherwise). */
  marlaSqft?: number;
}

const QUICK_MARLA = [3, 5, 7, 10];
const QUICK_KANAL = [1, 2, 4];

/**
 * Size, entered the way it is sold.
 *
 * The form used to demand "Property Size (sq ft)" as a required field and then
 * offer Marla and Kanal as two more optional boxes — so listing a 5 marla house
 * meant knowing it is 1,125 sq ft, and the three numbers could disagree with
 * each other. Here you pick the unit you think in and type one number; square
 * feet is derived.
 *
 * Square feet remains what is stored and sent, so every existing listing, size
 * filter and area page keeps working untouched.
 */
export function AreaSizeField({
  value,
  onChange,
  label = "Property size",
  required,
  disabled,
  className,
  marlaSqft = 225,
}: AreaSizeFieldProps) {
  const squareFeet = Number(value) || 0;

  const [unit, setUnit] = useState<AreaUnit>(() => naturalAreaUnit(squareFeet, marlaSqft));
  const [shown, setShown] = useState(() =>
    squareFeet > 0 ? String(fromSquareFeet(squareFeet, naturalAreaUnit(squareFeet, marlaSqft), marlaSqft)) : "",
  );
  const typed = useRef(false);
  const lastMarla = useRef(marlaSqft);

  // An edit form loads its property after this mounts: re-derive the unit and
  // the displayed number once the real size arrives, but never while the user
  // is the one typing (that would fight the cursor). When the city — and so
  // the marla — changes after the user typed "5 marla", it stays 5 marla and
  // the square feet follow.
  useEffect(() => {
    const marlaChanged = lastMarla.current !== marlaSqft;
    lastMarla.current = marlaSqft;
    if (marlaChanged && typed.current && Number(shown) > 0) {
      const sqft = toSquareFeet(shown, unit, marlaSqft);
      if (sqft !== squareFeet) onChange(String(sqft));
      return;
    }
    if (squareFeet <= 0) return;
    const currentlyShowing = toSquareFeet(shown || "0", unit, marlaSqft);
    if (currentlyShowing === squareFeet) return;

    const next = naturalAreaUnit(squareFeet, marlaSqft);
    setUnit(next);
    setShown(String(fromSquareFeet(squareFeet, next, marlaSqft)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareFeet, marlaSqft]);

  const push = (size: string, nextUnit: AreaUnit) => {
    typed.current = true;
    setShown(size);
    setUnit(nextUnit);
    const sqft = toSquareFeet(size, nextUnit, marlaSqft);
    onChange(sqft > 0 ? String(sqft) : "");
  };

  const quick = unit === "kanal" ? QUICK_KANAL : unit === "marla" ? QUICK_MARLA : [];
  const derived = toSquareFeet(shown || "0", unit, marlaSqft);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="block text-sm font-semibold text-gray-700">
        {label}
        {required ? " *" : ""}
      </Label>

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={shown}
          onChange={(event) => push(event.target.value, unit)}
          placeholder="0"
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 tabular-nums focus:border-transparent focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Select
          value={unit}
          onValueChange={(next) => push(shown, next as AreaUnit)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[150px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AREA_UNITS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-5 flex-wrap items-center gap-x-2 text-sm">
        {derived > 0 && unit !== "sqft" ? (
          <span className="tabular-nums text-gray-500">
            = {derived.toLocaleString("en-PK")} sq ft
            {marlaSqft !== 225 && (unit === "marla" || unit === "kanal") && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                1 Marla = {marlaSqft} sq ft in this city
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            Pick Marla, Kanal or Square Feet — whichever the plot is sold in.
          </span>
        )}
      </div>

      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quick.map((size) => (
            <button
              key={size}
              type="button"
              disabled={disabled}
              onClick={() => push(String(size), unit)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                Number(shown) === size
                  ? "border-gray-800 bg-gray-800 text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50",
              )}
            >
              {size} {unit === "kanal" ? "Kanal" : "Marla"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
