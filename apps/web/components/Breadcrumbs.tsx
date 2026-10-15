import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-3 ${className}`}>
      <ol
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-slate-500"
      >
        {items.map((item, index) => (
          <li
            key={index}
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="flex min-w-0 items-center gap-1.5"
          >
            {index < items.length - 1 ? (
              <>
                <Link
                  href={item.url}
                  itemProp="item"
                  className="flex items-center gap-1 transition-colors hover:text-primary"
                >
                  {index === 0 && <Home className="w-3.5 h-3.5" />}
                  <span itemProp="name">{item.name}</span>
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              </>
            ) : (
              <span itemProp="name" className="block max-w-[46ch] truncate text-slate-700">
                {item.name}
              </span>
            )}
            <meta itemProp="position" content={String(index + 1)} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
