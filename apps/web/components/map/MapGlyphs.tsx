/*
 * The map's own control glyphs: solid shapes drawn for this map, sized for a
 * 40 px control, instead of a generic outline icon set.
 */

type P = { className?: string };
const base = { viewBox: '0 0 24 24', 'aria-hidden': true } as const;

export function LayersGlyph({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.2 21.6 8.4 12 13.6 2.4 8.4Z" fill="currentColor" />
      <path d="m4.6 12.1-2.2 1.2 9.6 5.2 9.6-5.2-2.2-1.2-7.4 4Z" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function PlanGlyph({ className, off }: P & { off?: boolean }) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 10h7V3.5M10.5 10v10.5M10.5 14H20.5" fill="none" stroke="currentColor" strokeWidth="2" />
      {off && <path d="M3 21 21 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

export function RulerGlyph({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M2.8 16.3 16.3 2.8l4.9 4.9L7.7 21.2Z" fill="currentColor" />
      <path d="m8 11.1 1.6 1.6M10.6 8.5l2.4 2.4M13.2 5.9l1.6 1.6M5.4 13.7l2.4 2.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LocateGlyph({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ShareGlyph({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.5 7.2 7.3h3.3v7.2h3V7.3h3.3Z" fill="currentColor" />
      <path d="M5 11v8.2c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6V11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

export function ExpandGlyph({ className, collapse }: P & { collapse?: boolean }) {
  return collapse ? (
    <svg {...base} className={className}>
      <path d="M9.5 3v6.5H3M14.5 3v6.5H21M9.5 21v-6.5H3M14.5 21v-6.5H21" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg {...base} className={className}>
      <path d="M3 9.5V3h6.5M21 9.5V3h-6.5M3 14.5V21h6.5M21 14.5V21h-6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ListGlyph({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="4" height="4" rx=".8" fill="currentColor" />
      <rect x="3" y="10" width="4" height="4" rx=".8" fill="currentColor" />
      <rect x="3" y="16" width="4" height="4" rx=".8" fill="currentColor" />
      <path d="M10 6h11M10 12h11M10 18h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function SearchGlyph({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="10.4" cy="10.4" r="6.4" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="m15.4 15.4 5.4 5.4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}
