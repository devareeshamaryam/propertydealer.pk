/**
 * The review brain: decides in well under a millisecond whether a review goes
 * live at once or waits for an admin. No AI call and no network — word lists
 * and a few checks — so the person writing it never waits.
 *
 * Lenient on purpose. Everyone has the right to say how a dealer treated them:
 * one star, "fraud hai", "dhoka diya", "never again", "bakwas service" all go
 * live. A review is held only for:
 *   - abuse: gaaliyan and slurs, in English, Urdu, Roman Urdu, Hinglish and Hindi
 *   - contact or advertising: a phone number, an email or a link
 *   - spam shape: the same words over and over
 * (The service adds two more that need the database: the same text posted on
 * another agent, and a burst of reviews in one day.)
 *
 * Matching is on whole words after the text is normalised, so "Scunthorpe"
 * problems are avoided: "chot" (injury), "haram" (forbidden), "ganda" (dirty)
 * and "dala" (put) are ordinary words and are not on the lists.
 */

export type HoldKind = 'language' | 'contact' | 'spam' | 'repeat' | 'burst';

export interface BrainResult {
  publish: boolean;
  /** Why it was held — for the admin queue. Empty when it publishes. */
  reasons: string[];
  kinds: HoldKind[];
}

/* ── normalising ─────────────────────────────────────────────────────────── */

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

/** Latin text, lower case, leetspeak undone, "c.h.u.t.i.y.a" joined, repeated letters squeezed. */
function latin(text: string): string {
  let s = text.normalize('NFKC').toLowerCase();
  // Leetspeak only inside words (so "0300" stays a number for the phone check, which runs on the raw text).
  s = s.replace(/[a-z][a-z0-9@$!]*[a-z0-9@$!]/g, (w) => w.replace(/[013457@$!]/g, (c) => LEET[c] ?? c));
  // Single letters split by spaces, dots, dashes or stars: "m a d a r" → "madar".
  s = s.replace(/\b(?:[a-z][\s.\-_*]+){2,}[a-z]\b/g, (m) => m.replace(/[\s.\-_*]+/g, ''));
  // "chuuuutiya" → "chutiya": squeeze every run of a letter to one (the lists are written the same way).
  s = s.replace(/([a-z])\1+/g, '$1');
  return s;
}

/** Urdu / Hindi script: drop the diacritics and unify the letters that have two forms. */
function script(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // zer, zabar, pesh, tashdeed…
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةه]/g, 'ہ')
    .replace(/‌|‍/g, '') // zero-width joiners
    .replace(/\s+/g, ' ');
}

const squeeze = (w: string) => w.toLowerCase().replace(/([a-z])\1+/g, '$1');

/* ── the lists ───────────────────────────────────────────────────────────── */

/**
 * Roman Urdu / Hinglish / English words that start a gaali — a word STARTING
 * with one of these counts ("madarchod", "madarchodo", "bhenchodd").
 * Written squeezed (no double letters).
 */
const LATIN_STEMS = [
  // Roman Urdu / Hinglish
  'madarchod', 'maderchod', 'madarjat', 'madarjaat',
  'behenchod', 'behnchod', 'bhenchod', 'benchod', 'bahenchod', 'bhanchod', 'banchod',
  'bhosdi', 'bhosda', 'bhosri', 'bhosad', 'bosdi',
  'chutiy', 'chutia', 'chotiya', 'chotia', 'chutya',
  'harami', 'haramzad', 'haramkhor', 'haramzade',
  'kanjar', 'kanjri', 'kanjary',
  'randi', 'rundi', 'randwa',
  'gandu', 'gando', 'gandmar', 'gandfat',
  'bharwa', 'bharva', 'bharwe', 'bharve',
  'begairat', 'beghairat', 'begherat',
  'lavde', 'lawde', 'lauda', 'lawda', 'lode',
  'fudi', 'phudi', // not 'pudi': pudina
  'jhatu', 'chinal', 'kamina', 'kamine', 'kameen',
  // English
  'fuck', 'fuk', 'fck', 'motherfuck', 'mofo', 'cunt', 'bitch', 'biatch', 'bastard',
  'ashole', 'arsehole', 'dickhead', 'whore', 'slut', 'faggot', 'nigger', 'nigga', 'retard',
].map(squeeze);

/** Short gaalis and abbreviations that only count as a whole word. */
const LATIN_WORDS = new Set(
  // Not 'kutta' alone: dogs are real ("kutte bahar the"); only the insulting phrases below.
  ['mc', 'bc', 'bsdk', 'bkl', 'mkc', 'tmkc', 'lun', 'lund', 'suar', 'tate', 'kutiya'].map(squeeze),
);

/** Phrases (squeezed, single spaces). */
const LATIN_PHRASES = [
  'teri ma ki', 'teri maa ki', 'teri ma ka', 'teri behen ki', 'teri bhen ki', 'teri ma ko', 'ma ki ankh',
  'kute ka bacha', 'kute ke bache', 'kuti ka bacha', 'kuta insan', 'kute insan', 'kuti insan', 'kuta banda', 'kute log', 'kuti ki', 'ulu ka patha', 'ulu ke pathe', 'sur ka bacha',
  'son of a bitch', 'piece of shit',
].map((p) => squeeze(p));

/** Urdu script — matched as substrings of the normalised text (the words are distinctive). */
const URDU = [
  'حرامی', 'حرامزاد', 'حرام زاد', 'حرام خور', 'کنجر', 'کنجری', 'رنڈی', 'چوتیا', 'چوتیے', 'مادرچود', 'مادر چود',
  'بہنچود', 'بہن چود', 'بھنچود', 'بھن چود', 'گانڈو', 'گانڈ', 'بھڑوا', 'بھڑوے', 'بےغیرت', 'بے غیرت', 'کمینہ', 'کمینے',
  'کتے کا بچہ', 'کتے کے بچے', 'کتا انسان', 'کتی کی', 'الو کا پٹھا', 'تیری ماں', 'تیری بہن', 'لعنتی', 'خنزیر',
].map(script);

/** Urdu words that only count alone (they are parts of ordinary words otherwise). */
const URDU_WORDS = new Set(['کتیا', 'سور', 'لن'].map(script));

/** Hindi (Devanagari). */
const HINDI = ['मादरचोद', 'बहनचोद', 'भेनचोद', 'चूतिया', 'चुतिया', 'हरामी', 'हरामज़ादा', 'रंडी', 'गांडू', 'भोसड़ी', 'भड़वा', 'कमीना', 'कुत्ते'];

/* ── the checks ──────────────────────────────────────────────────────────── */

function abusive(text: string): boolean {
  const l = latin(text);
  const words = l.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => LATIN_WORDS.has(w) || LATIN_STEMS.some((s) => w.startsWith(s)))) return true;
  const spaced = ` ${words.join(' ')} `;
  if (LATIN_PHRASES.some((p) => spaced.includes(` ${p} `) || spaced.includes(` ${p}`))) return true;

  const u = script(text);
  if (URDU.some((w) => u.includes(w))) return true;
  const uWords = u.split(/[\s.,،!؟?:;"'()\-]+/).filter(Boolean);
  if (uWords.some((w) => URDU_WORDS.has(w))) return true;
  return HINDI.some((w) => text.includes(w));
}

function contact(text: string): string | null {
  const digits = text.replace(/[٠-٩۰-۹]/g, (d) => String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d) % 10));
  // A mobile number however it is written — 0300 1234567, 0300-1234567, +92 300 1234567, 923001234567 —
  // or any 10+ digits in one run. Not prices ("2,50,00,000") or years ("2024 2025").
  if (/(?:\+\s?92|\b92|\b0)[\s\-.]?3\d{2}[\s\-.]?\d{3}[\s\-.]?\d{4}\b/.test(digits) || /\d{10,}/.test(digits)) return 'Has a phone number';
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return 'Has an email address';
  if (/(https?:\/\/|www\.|\b[\w-]+\.(com|pk|net|org|io|co|info|me|link|xyz)\b)/i.test(text)) return 'Has a link';
  return null;
}

/** "good good good good good…", "aaaaaaaa", the same word for most of the review. */
function spammy(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 8 && new Set(words).size / words.length < 0.3) return true;
  if (/(.)\1{9,}/.test(text)) return true;
  const letters = text.replace(/[^\p{L}]/gu, '');
  return letters.length >= 20 && new Set(letters.toLowerCase()).size <= 3;
}

/** The text-only verdict. */
export function judgeReview(text: string): BrainResult {
  const reasons: string[] = [];
  const kinds: HoldKind[] = [];
  if (abusive(text)) {
    reasons.push('Abusive language');
    kinds.push('language');
  }
  const c = contact(text);
  if (c) {
    reasons.push(c);
    kinds.push('contact');
  }
  if (spammy(text)) {
    reasons.push('Looks like spam (repeated words or letters)');
    kinds.push('spam');
  }
  return { publish: kinds.length === 0, reasons, kinds };
}

/** What the reviewer is told when their review waits — plain, and never "AI flagged you". */
export function holdMessage(kinds: HoldKind[]): string {
  if (kinds.includes('contact')) return 'It has a phone number, email or link, so our team will check it first.';
  if (kinds.includes('language')) return 'Some of the words in it need a quick check by our team first.';
  if (kinds.includes('repeat')) return 'It is the same as a review you posted on another agent, so our team will check it first.';
  if (kinds.includes('burst')) return 'You have posted several reviews today, so our team will check this one first.';
  return 'Our team will check it first.';
}
