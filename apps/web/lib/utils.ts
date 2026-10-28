import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Short names that are always written in capitals: "dha phase 6" → "DHA Phase 6", not "Dha". */
const ACRONYMS = new Set(['dha', 'lda', 'eme', 'paf', 'cda', 'mda', 'fda', 'ruda', 'wapda', 'pcsir', 'nfc', 'ptcl', 'bzu', 'cbd', 'pia']);

export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const bare = word.replace(/[^a-z]/g, '');
      if (ACRONYMS.has(bare)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
