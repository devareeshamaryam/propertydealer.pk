import { Facebook, Globe, Instagram, Linkedin, Youtube } from 'lucide-react';

type Links = { facebook?: string; instagram?: string; youtube?: string; tiktok?: string; linkedin?: string; website?: string };

const TikTok = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.77.12V9.66a5.73 5.73 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z" />
  </svg>
);

const ITEMS: { key: keyof Links; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'tiktok', label: 'TikTok', Icon: TikTok },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'website', label: 'Website', Icon: Globe },
];

/** An agent's social links, as round icon buttons. Nothing when there are none. */
export default function SocialLinks({ links }: { links?: Links }) {
  const items = ITEMS.filter(({ key }) => /^https?:\/\//.test(links?.[key] ?? ''));
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={links![key]}
          target="_blank"
          rel="noopener nofollow ugc"
          aria-label={label}
          title={label}
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-primary hover:text-primary"
        >
          <Icon className="h-[18px] w-[18px]" />
        </a>
      ))}
    </div>
  );
}
