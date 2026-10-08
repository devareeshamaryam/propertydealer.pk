import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from '@rent-ghar/db/schemas/property.schema';

/**
 * The listing brain: decides whether a new property goes live immediately or
 * waits for an admin.
 *
 * Before this, every agent listing sat in a queue — so an honest agent's house
 * was invisible until someone happened to log in and approve it, and the queue
 * was long enough that nobody read it carefully. Both halves of that are bad:
 * good listings are slow, bad ones get waved through.
 *
 * So: score it. A clean listing publishes itself; anything that smells goes to
 * the admin WITH the reasons attached, so reviewing is a ten-second decision
 * instead of a fresh investigation.
 *
 * The rules below are specific to Pakistani property, not generic spam rules:
 * price per marla bands, "file" and "possession" vocabulary, 0300-style
 * numbers hidden in text, the societies people actually fake.
 */

export interface BrainInput {
  title: string;
  description?: string;
  price?: number;
  /** Square feet, as stored. */
  areaSize?: number;
  marla?: number;
  listingType?: 'rent' | 'sale';
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  location?: string;
  contactNumber?: string;
  whatsappNumber?: string;
  photos: string[];
  hasVideo?: boolean;
  features?: string[];
}

export interface BrainVerdict {
  /** 0 (clean) to 100 (certainly spam). */
  score: number;
  /** Why, in words an admin can act on. */
  reasons: string[];
  action: 'publish' | 'review';
  source: 'rules' | 'rules+ai';
}

/* ───────────────────────────── the vocabulary ───────────────────────────── */

/**
 * Phrases that are scams in this market. Deliberately NOT including ordinary
 * Pakistani property words — "file", "possession", "non-possession",
 * "installments", "on instalment", "allotment" and "balloting" are all normal
 * here and flagging them would hold half the legitimate listings on the site.
 */
const SCAM_PHRASES = [
  'double your money',
  'double profit',
  'guaranteed profit',
  'guaranteed return',
  'investment plan',
  'investment scheme',
  'profit in 1 month',
  'profit in one month',
  'lottery',
  'you have won',
  'claim your prize',
  'western union',
  'easypaisa only',
  'jazzcash only',
  'advance payment only',
  'advance fee',
  'processing fee',
  'token money first',
  'crypto',
  'bitcoin',
  'forex',
  'earn from home',
  'work from home',
  'no risk',
  '100% guaranteed',
  'click here',
  'limited time offer only',
  'cash only no questions',
  'fake file',
  'duplicate file',
];

/** Being pushed off the platform is the single most common scam vector. */
const OFF_PLATFORM = [
  'whatsapp me',
  'whats app me',
  'inbox me',
  'dm me',
  'message me on',
  'contact me on insta',
  'telegram',
  'imo',
  'call me on',
  'rabta karen',
  'rabita karen',
];

const URL_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]{3,}\.(com|net|pk|org|io|co|info|xyz|shop|store|site)\b)/i;
const EMAIL_PATTERN =
  /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9.-]+\s*(\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i;

/**
 * Price sanity, in rupees per marla (1 marla = 225 sq ft).
 *
 * Wide on purpose — these bands only have to catch bait pricing and typos, not
 * judge the market. A 5 marla house at Rs 50,000 is bait; at Rs 5 crore it is
 * DHA Lahore and perfectly real.
 */
const SALE_PER_MARLA = { min: 150_000, max: 60_000_000 };
const RENT_PER_MARLA = { min: 1_000, max: 400_000 };

/* ───────────────────────────── helpers ───────────────────────────── */

/**
 * Finds a phone number in free text, including the obfuscations people
 * actually use here: "0 3 0 0 1234567", "O3OO-I234567", "zero three double
 * zero", "03OO.123.4567".
 */
export function findsContactInText(text: string): {
  phone: boolean;
  url: boolean;
  email: boolean;
} {
  const raw = String(text || '');

  // Letters that stand in for digits, then words that spell digits.
  const deLeet = raw
    .replace(/[oO]/g, '0')
    .replace(/[iIlL|]/g, '1')
    .replace(/\bzero\b/gi, '0')
    .replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bthree\b/gi, '3')
    .replace(/\bfour\b/gi, '4')
    .replace(/\bfive\b/gi, '5')
    .replace(/\bsix\b/gi, '6')
    .replace(/\bseven\b/gi, '7')
    .replace(/\beight\b/gi, '8')
    .replace(/\bnine\b/gi, '9');

  const compact = deLeet.replace(/[\s.\-_()+/,]/g, '');

  const phone =
    // A Pakistani mobile: 03xx xxxxxxx or +92 3xx xxxxxxx.
    /(?:\+?92|0)3\d{8,9}/.test(compact) ||
    // A landline with a city code: 042 35xxxxxx and friends.
    /(?:\+?92|0)(?:21|22|41|42|51|52|53|55|61|62|68|81|91)\d{7,8}/.test(compact) ||
    // Any run of 10+ digits. Prices, areas and years never get that long.
    /\d{11,}/.test(compact);

  return {
    phone,
    url: URL_PATTERN.test(raw),
    email: EMAIL_PATTERN.test(raw),
  };
}

@Injectable()
export class ListingBrainService {
  private readonly logger = new Logger(ListingBrainService.name);

  /**
   * At or above this, an admin looks at it first. 45 is deliberately strict:
   * one phone number in the description is enough on its own, because that is
   * the behaviour this site most needs to stop.
   */
  private readonly holdThreshold: number;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
  ) {
    this.holdThreshold = Number(config.get('LISTING_BRAIN_THRESHOLD') ?? 45);
    this.enabled = config.get('LISTING_BRAIN_ENABLED') !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Score a listing, then ask the AI as a second opinion when a key is set.
   *
   * Rules run first and always: they are instant, free and explainable. The AI
   * can only ever make the verdict stricter, never looser — a model having a
   * bad day must not publish something the rules caught.
   */
  async review(input: BrainInput, ownerId?: string): Promise<BrainVerdict> {
    const rules = this.scoreByRules(input);
    let score = rules.score;
    const reasons = [...rules.reasons];
    let source: BrainVerdict['source'] = 'rules';

    // A listing that is already being held does not need a paid second
    // opinion — it is going to the admin either way.
    if (score < 100 && ownerId) {
      const duplicate = await this.looksLikeDuplicate(input, ownerId);
      if (duplicate) {
        score += 30;
        reasons.push(duplicate);
      }
    }

    if (score < this.holdThreshold) {
      const ai = await this.askAi(input);
      if (ai) {
        source = 'rules+ai';
        if (ai.risk > score) score = ai.risk;
        for (const reason of ai.reasons) reasons.push(`AI: ${reason}`);
        if (ai.block) score = Math.max(score, this.holdThreshold);
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      reasons,
      action: score >= this.holdThreshold ? 'review' : 'publish',
      source,
    };
  }

  /* ─────────────────────────── the rules ─────────────────────────── */

  scoreByRules(input: BrainInput): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    const title = (input.title || '').trim();
    const description = String(input.description || '')
      // The description is rich text; judge the words, not the markup.
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const text = `${title} ${description}`;
    const lower = text.toLowerCase();

    /* ── Contact details hidden in the text ── */
    const contact = findsContactInText(text);
    if (contact.phone) {
      // The whole reason contact fields exist: a number in the description
      // skips the sign-in gate, the enquiry counter and any traceability.
      score += 45;
      reasons.push('Phone number written in the title or description');
    }
    if (contact.url) {
      score += 30;
      reasons.push('External link in the text');
    }
    if (contact.email) {
      score += 25;
      reasons.push('Email address in the text');
    }

    const offPlatform = OFF_PLATFORM.filter((phrase) => lower.includes(phrase));
    if (offPlatform.length) {
      score += 25;
      reasons.push(`Asks to be contacted off the site ("${offPlatform[0]}")`);
    }

    /* ── Scam vocabulary ── */
    const scams = SCAM_PHRASES.filter((phrase) => lower.includes(phrase));
    if (scams.length) {
      score += Math.min(60, scams.length * 30);
      reasons.push(`Scam wording: ${scams.slice(0, 3).join(', ')}`);
    }

    /* ── Price sanity, per marla ── */
    const marla =
      Number(input.marla) > 0
        ? Number(input.marla)
        : Number(input.areaSize) > 0
          ? Number(input.areaSize) / 225
          : 0;
    const price = Number(input.price) || 0;

    if (price <= 0) {
      score += 25;
      reasons.push('No price');
    } else if (marla > 0) {
      const perMarla = price / marla;
      const band = input.listingType === 'rent' ? RENT_PER_MARLA : SALE_PER_MARLA;

      if (perMarla < band.min) {
        score += 35;
        reasons.push(
          `Price looks like bait: ${Math.round(perMarla).toLocaleString('en-PK')} per marla for ${input.listingType === 'rent' ? 'rent' : 'sale'}`,
        );
      } else if (perMarla > band.max) {
        score += 20;
        reasons.push(
          `Price looks like a typo: ${Math.round(perMarla).toLocaleString('en-PK')} per marla`,
        );
      }
    }

    /* ── Is it actually a listing? ── */
    if (title.length < 10) {
      score += 20;
      reasons.push('Title too short to say what this is');
    }
    if (description.length < 40) {
      score += 15;
      reasons.push('Description almost empty');
    }

    const letters = title.replace(/[^a-z]/gi, '').length;
    if (title.length >= 10 && letters / title.length < 0.45) {
      score += 15;
      reasons.push('Title looks like gibberish');
    }

    const shoutyWords = title
      .split(/\s+/)
      .filter((word) => word.length > 3 && word === word.toUpperCase() && /[A-Z]/.test(word));
    if (shoutyWords.length >= 4) {
      score += 10;
      reasons.push('Title is mostly in capitals');
    }
    if (/(.)\1{5,}/.test(lower)) {
      score += 10;
      reasons.push('Repeated characters');
    }

    // Keyword stuffing: "House for sale Lahore DHA Lahore DHA Lahore".
    const words = lower.split(/\s+/).filter((word) => word.length > 3);
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    const stuffed = [...counts.entries()].filter(([, count]) => count >= 4);
    if (stuffed.length >= 2) {
      score += 15;
      reasons.push(`Keyword stuffing ("${stuffed[0]?.[0]}" repeated)`);
    }

    /* ── Photos ── */
    if (input.photos.length === 0) {
      score += 30;
      reasons.push('No photos at all');
    } else if (input.photos.length === 1 && !input.hasVideo) {
      score += 10;
      reasons.push('Only one photo');
    }

    /* ── Does the property make physical sense? ── */
    const beds = Number(input.bedrooms) || 0;
    if (marla > 0 && beds > 0) {
      // Roughly: you cannot fit more than two bedrooms into a marla, even in
      // the most optimistic apartment plan.
      if (beds > Math.max(4, Math.ceil(marla * 2))) {
        score += 20;
        reasons.push(`${beds} bedrooms in ${marla.toFixed(1)} marla is not plausible`);
      }
    }

    const plotLike = ['plot', 'land', 'agricultural'].includes(
      String(input.propertyType || '').toLowerCase(),
    );
    if (plotLike && beds > 0) {
      score += 10;
      reasons.push('A plot is listed with bedrooms');
    }

    /* ── Contact number shape ── */
    const digits = String(input.contactNumber || '').replace(/\D/g, '');
    if (digits.length < 10) {
      score += 20;
      reasons.push('Contact number is incomplete');
    } else if (!/^(92|0)?3\d{9}$/.test(digits) && !/^(92|0)?\d{9,11}$/.test(digits)) {
      score += 10;
      reasons.push('Contact number does not look Pakistani');
    }

    return { score, reasons };
  }

  /**
   * The same listing posted again — the most common way the home page gets
   * flooded. Matches on this owner's recent listings by title and price rather
   * than exact text, because the usual trick is a one-word change.
   */
  private async looksLikeDuplicate(
    input: BrainInput,
    ownerId: string,
  ): Promise<string | null> {
    if (!Types.ObjectId.isValid(ownerId)) return null;

    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const normalise = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const target = normalise(input.title);

      const recent = await this.propertyModel
        .find({
          owner: new Types.ObjectId(ownerId),
          createdAt: { $gte: since },
          status: { $in: ['pending', 'approved'] },
        })
        .select('title price')
        .limit(40)
        .lean()
        .exec();

      for (const row of recent) {
        const same = normalise(String((row as { title?: string }).title ?? ''));
        const samePrice = Number((row as { price?: number }).price) === Number(input.price);
        if (same && same === target && samePrice) {
          return 'Same title and price as one of this agent’s listings from the last two weeks';
        }
      }
    } catch (error) {
      this.logger.warn(
        `Duplicate check failed: ${(error as Error).message}`,
      );
    }

    return null;
  }

  /* ─────────────────────────── the AI second opinion ─────────────────────────── */

  private aiKey(): string | null {
    const key = this.config.get<string>('OPENAI_API_KEY') ?? '';
    if (key.length < 20 || key.startsWith('your-') || key.includes('...')) return null;
    return key;
  }

  /**
   * gpt-4o-mini reading the listing the way a moderator would.
   *
   * Returns null when there is no key or the call fails, and the rules verdict
   * stands — moderation must keep working whether or not OpenAI does.
   */
  private async askAi(
    input: BrainInput,
  ): Promise<{ risk: number; block: boolean; reasons: string[] } | null> {
    const key = this.aiKey();
    if (!key) return null;

    const system = `You moderate new listings on a Pakistani property website (houses, flats, plots, shops, offices, agricultural land). Decide how risky a listing is (0-100) and whether it must be BLOCKED from publishing until a human checks it.

Block aggressively for:
- Any contact detail hidden in the title or description: phone numbers (including spaced, worded or letter-swapped like "O3OO", "zero three"), WhatsApp/Telegram handles, emails, links, "inbox me", "rabta karen". Buyers must use the site's contact button.
- Investment scams: guaranteed profit, double your money, plot-file schemes promising returns, crypto, forex, advance/processing fees before viewing.
- Fake or duplicate plot files, forged allotment or possession claims, "no questions asked" cash deals.
- Bait pricing: a price far below anything real for that size and city, used to get calls.
- Dealer spam: the same text repeated, keyword stuffing with city and society names, listings that describe an agency rather than a property.
- Empty, gibberish or copy-pasted listings; adult, illegal or hateful content.

Do NOT block ordinary Pakistani property vocabulary — "file", "possession", "non-possession", "installments", "balloting", "allotment", "corner", "west open", "DHA", "Bahria", "society", "marla", "kanal" are all normal and legitimate. A genuine listing with a real address, a sensible price, photos and no contact details in the text must pass with risk under 35 and block=false.

Reply ONLY with compact JSON: {"risk": <0-100 integer>, "block": <boolean>, "reasons": [<short English strings>]}.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.config.get('LISTING_BRAIN_MODEL') || 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 300,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `Listing to review:\n${JSON.stringify({
                title: input.title,
                description: String(input.description || '')
                  .replace(/<[^>]*>/g, ' ')
                  .slice(0, 2500),
                price: input.price,
                listingType: input.listingType,
                propertyType: input.propertyType,
                marla: input.marla,
                areaSizeSqFt: input.areaSize,
                bedrooms: input.bedrooms,
                location: input.location,
                photoCount: input.photos.length,
                features: input.features?.slice(0, 20),
              })}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        this.logger.warn(`Listing AI returned HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = body.choices?.[0]?.message?.content;
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        risk?: unknown;
        block?: unknown;
        reasons?: unknown;
      };

      const risk = Math.max(0, Math.min(100, Math.round(Number(parsed.risk) || 0)));

      return {
        risk,
        block: Boolean(parsed.block) || risk >= 70,
        reasons: Array.isArray(parsed.reasons)
          ? parsed.reasons.slice(0, 6).map((reason) => String(reason))
          : [],
      };
    } catch (error) {
      this.logger.warn(`Listing AI failed: ${(error as Error).message}`);
      return null;
    }
  }
}
