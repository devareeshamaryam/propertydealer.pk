import type { ToolInfo } from '@/lib/tools';

/*
 * Each tool's own small picture — drawn for what the tool does, not a stock
 * icon: a house going up under a crane, a measured plot, a price tag in
 * rupees, a house with a rate coin, a calendar of paid instalments, rent
 * climbing. Solid colours on the tool's own tile.
 */

const SIZE = { sm: 40, md: 48, lg: 64 } as const;

function Art({ icon, dark }: { icon: ToolInfo['icon']; dark: string }) {
  const W = '#ffffff';
  switch (icon) {
    case 'hammer': // construction: a house going up under a crane
      return (
        <>
          <rect x="33" y="7" width="3" height="32" fill={W} />
          <rect x="12" y="7" width="29" height="3" fill={W} />
          <rect x="20" y="10" width="1.6" height="7" fill={W} />
          <rect x="16.5" y="16.5" width="8.5" height="5.5" rx="0.8" fill={dark} stroke={W} strokeWidth="1.2" />
          <path d="M6 28 L18 19 L30 28 Z" fill={W} />
          <rect x="9" y="27" width="18" height="13" fill={W} />
          <path d="M9 31.5 H27 M9 36 H27 M14 27 V31.5 M21 31.5 V36 M14 36 V40" stroke={dark} strokeWidth="1.3" />
        </>
      );
    case 'ruler': // area: a measured plot
      return (
        <>
          <rect x="8" y="8" width="26" height="26" rx="2" fill={W} />
          <path d="M8 21 H34 M21 8 V34" stroke={dark} strokeWidth="1.6" strokeDasharray="2.5 2" />
          <path d="M8 40 H34 M8 37.5 V42.5 M34 37.5 V42.5" stroke={W} strokeWidth="2" />
          <path d="M40 8 V34 M37.5 8 H42.5 M37.5 34 H42.5" stroke={W} strokeWidth="2" />
        </>
      );
    case 'tag': // price per marla: a rupee price tag
      return (
        <>
          <path d="M41 11 H22 L8 24 L22 37 H41 Z" fill={W} />
          <circle cx="17" cy="24" r="2.6" fill={dark} />
          <text x="31" y="28.5" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif" fill={dark}>
            Rs
          </text>
        </>
      );
    case 'landmark': // home loan: a house and the rate
      return (
        <>
          <path d="M5 24 L19 11 L33 24 Z" fill={W} />
          <rect x="9" y="23" width="20" height="16" fill={W} />
          <rect x="16" y="30" width="6" height="9" fill={dark} />
          <circle cx="35" cy="33" r="9" fill="#facc15" stroke={W} strokeWidth="2" />
          <text x="35" y="37" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#713f12">
            %
          </text>
        </>
      );
    case 'calendar': // instalments: a calendar of payments, the first ones paid
      return (
        <>
          <rect x="8" y="11" width="32" height="29" rx="3" fill={W} />
          <rect x="8" y="11" width="32" height="8" rx="3" fill={dark} />
          <rect x="14" y="7" width="3.2" height="8" rx="1.2" fill={W} />
          <rect x="30.8" y="7" width="3.2" height="8" rx="1.2" fill={W} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = 12.5 + (i % 3) * 8.5;
            const y = 22.5 + Math.floor(i / 3) * 8;
            return i < 4 ? (
              <rect key={i} x={x} y={y} width="6" height="5.5" rx="1.2" fill={dark} />
            ) : (
              <rect key={i} x={x + 0.6} y={y + 0.6} width="4.8" height="4.3" rx="1" fill="none" stroke={dark} strokeWidth="1.2" />
            );
          })}
        </>
      );
    case 'trending': // rental yield: returns climbing
      return (
        <>
          <rect x="8" y="30" width="6" height="10" rx="1" fill={W} />
          <rect x="17" y="25" width="6" height="15" rx="1" fill={W} />
          <rect x="26" y="20" width="6" height="20" rx="1" fill={W} />
          <rect x="35" y="14" width="6" height="26" rx="1" fill={W} />
          <path d="M8 24 L18 16 L25 19 L37 8" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M31 7 L38.5 6.5 L38 14" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
  }
}

export default function ToolArt({ tool, size = 'md' }: { tool: ToolInfo; size?: keyof typeof SIZE }) {
  const px = SIZE[size];
  const dark = `color-mix(in srgb, ${tool.color} 55%, #000)`;
  return (
    <svg width={px} height={px} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <rect width="48" height="48" rx="11" fill={tool.color} />
      <Art icon={tool.icon} dark={dark} />
    </svg>
  );
}
