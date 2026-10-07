"use client";

import { Label } from "@/components/ui/label";
import { amountInWords, amountWithSeparators, CRORE, LAKH, THOUSAND } from "@/lib/pk";
import { cn } from "@/lib/utils";

interface PriceFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Rent is quoted per month and in thousands; sale in lakh and crore. */
  mode?: "sale" | "rent";
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const SALE_STEPS = [
  { label: "25 Lakh", value: 25 * LAKH },
  { label: "50 Lakh", value: 50 * LAKH },
  { label: "1 Crore", value: CRORE },
  { label: "2 Crore", value: 2 * CRORE },
];

const RENT_STEPS = [
  { label: "25 Thousand", value: 25 * THOUSAND },
  { label: "50 Thousand", value: 50 * THOUSAND },
  { label: "1 Lakh", value: LAKH },
  { label: "2 Lakh", value: 2 * LAKH },
];

/**
 * A price box that says out loud what was typed.
 *
 * Rupee amounts on this site run to eight digits, and a listing posted at
 * 1,50,00,000 instead of 15,00,000 is a decimal point away from being ten times
 * the market. Every Pakistani portal therefore echoes the amount back in lakh
 * and crore as you type; this does the same, plus one-tap steps for the amounts
 * people actually enter.
 *
 * The value stays a plain rupee number — nothing about what is stored changes.
 */
export function PriceField({
  value,
  onChange,
  mode = "sale",
  label,
  required,
  disabled,
  className,
}: PriceFieldProps) {
  const words = amountInWords(value);
  const steps = mode === "rent" ? RENT_STEPS : SALE_STEPS;
  const current = Number(value);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="block text-sm font-semibold text-gray-700">
        {label ?? (mode === "rent" ? "Monthly Rent (PKR)" : "Sale Price (PKR)")}
        {required ? " *" : ""}
      </Label>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
          Rs
        </span>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={mode === "rent" ? "e.g. 60000" : "e.g. 15500000"}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4 tabular-nums focus:border-transparent focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* The whole point: the amount, in the words it would be advertised in. */}
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {words ? (
          <>
            <span className="font-semibold text-emerald-700">{words}</span>
            <span className="text-gray-400">·</span>
            <span className="tabular-nums text-gray-500">
              Rs {amountWithSeparators(value)}
              {mode === "rent" ? " / month" : ""}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-400">
            Type the amount in rupees — it will be shown in lakh and crore here.
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <button
            key={step.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(String(step.value))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              current === step.value
                ? "border-gray-800 bg-gray-800 text-white"
                : "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50",
            )}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
