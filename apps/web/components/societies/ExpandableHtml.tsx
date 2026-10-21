'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Long text, shown in part with "Read more" — all of it is in the page for search engines. */
export default function ExpandableHtml({ html, className, collapsed = 260 }: { html: string; className?: string; collapsed?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useEffect(() => {
    if (box.current) setLong(box.current.scrollHeight > collapsed + 60);
  }, [html, collapsed]);

  return (
    <div className="relative">
      <div
        ref={box}
        className={cn('prose prose-slate max-w-none text-[15px] leading-relaxed prose-headings:text-slate-900 prose-a:text-primary prose-img:rounded-xl', className)}
        style={!open && long ? { maxHeight: collapsed, overflow: 'hidden' } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {long && !open && <div className="pointer-events-none absolute inset-x-0 bottom-9 h-20 bg-gradient-to-t from-white to-transparent" />}
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-primary">
          {open ? 'Show less' : 'Read more'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    </div>
  );
}
