import { cn } from "@/lib/utils";

/**
 * The PropertyDealer mark and wordmark, still.
 *
 * The header used to animate this: a shimmering roof line, a pulsing pin, a
 * breathing dot and every letter of the name bobbing on its own delay. Motion
 * on a logo is the loudest thing on the page and it never stops, which is
 * exactly what makes a site feel generated rather than designed — no listing
 * portal anyone trusts moves its logo.
 *
 * Same drawing (roof, walls, pin), drawn once. The pin carries the brand blue
 * so the mark has one point of colour; everything else takes `currentColor`,
 * which lets the footer show it in white on navy.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <polyline
        points="4,50 50,8 96,50"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="miter"
        strokeLinecap="square"
        fill="none"
      />
      <polyline
        points="14,50 14,92 86,92 86,50"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="miter"
        strokeLinecap="square"
        fill="none"
      />
      <path
        d="M36,59 A14,14 0 1,1 64,59 Q64,73 50,82 Q36,73 36,59 Z"
        className="fill-primary"
      />
      <circle cx="50" cy="57" r="5.5" fill="#ffffff" />
    </svg>
  );
}

export function BrandLogo({
  className,
  markClassName,
  textClassName,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <BrandMark className={cn("h-8 w-8", markClassName)} />
      <span
        className={cn(
          "text-[19px] font-bold leading-none tracking-tight",
          textClassName,
        )}
      >
        Property<span className="text-primary">Dealer</span>
      </span>
    </span>
  );
}
