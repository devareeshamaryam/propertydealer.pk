import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The "Verified" mark of agencies on a plan with the verified badge — on
 * profiles, listing pages and listing cards. `icon` is the bare tick, for
 * tight spots next to a name.
 */
export default function VerifiedBadge({ icon = false, className }: { icon?: boolean; className?: string }) {
  if (icon) {
    return <BadgeCheck className={cn('h-4 w-4 shrink-0 text-sky-500', className)} aria-label="Verified agency" role="img" />;
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11.5px] font-semibold text-sky-700 ring-1 ring-sky-200', className)}
      title="Verified agency"
    >
      <BadgeCheck className="h-3.5 w-3.5" /> Verified
    </span>
  );
}
