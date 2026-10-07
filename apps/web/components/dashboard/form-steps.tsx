"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FormStep {
  id: number;
  title: string;
  /** One line telling the person what this step is for. */
  hint?: string;
}

interface FormStepsProps {
  steps: FormStep[];
  current: number;
  /** Jumping back is allowed; jumping ahead is not, so each step can validate. */
  onGoTo?: (step: number) => void;
  className?: string;
}

/**
 * The progress header for a multi-step form.
 *
 * Posting a property is a twenty-field job. Presented as one scroll it reads as
 * a tax return and people abandon it — which is why every portal in this market
 * (OLX, Zameen, Graana) breaks it into three or four named steps with a bar at
 * the top. Done steps are clickable so corrections are cheap.
 */
export function FormSteps({ steps, current, onGoTo, className }: FormStepsProps) {
  const active = steps.find((step) => step.id === current);

  return (
    <div className={cn("space-y-3", className)}>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const done = step.id < current;
          const isCurrent = step.id === current;
          const reachable = step.id <= current;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={reachable && onGoTo ? () => onGoTo(step.id) : undefined}
                disabled={!reachable || !onGoTo}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                  reachable && onGoTo && !isCurrent && "hover:bg-gray-50",
                  !reachable && "cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done && "bg-emerald-600 text-white",
                    isCurrent && "bg-gray-900 text-white",
                    !done && !isCurrent && "bg-gray-100 text-gray-400",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : step.id}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-sm font-medium sm:block",
                    isCurrent ? "text-gray-900" : done ? "text-gray-700" : "text-gray-400",
                  )}
                >
                  {step.title}
                </span>
              </button>

              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-0.5 w-6 shrink-0 rounded sm:block",
                    done ? "bg-emerald-600" : "bg-gray-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* On a phone the step names are hidden above, so name the current one. */}
      <div className="sm:hidden">
        <p className="text-sm font-semibold text-gray-900">
          Step {current} of {steps.length} — {active?.title}
        </p>
      </div>
      {active?.hint && <p className="text-sm text-gray-500">{active.hint}</p>}
    </div>
  );
}
