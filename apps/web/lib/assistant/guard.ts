/**
 * Requests the assistant turns down before any lookup or model call — the
 * obvious ways to misuse it, answered politely and for free:
 *
 *   - collecting contact details in bulk (every dealer's number, an export),
 *   - personal details about someone (an owner's CNIC, home address, number),
 *   - spam, fake reviews, forged papers, getting round the law,
 *   - "ignore your instructions" / show your prompt.
 *
 * Shared by the chat window (no request at all) and the chat route (in case
 * the window is bypassed). The model has the same rules in its prompt for
 * anything phrased in a way these patterns miss.
 */

const t = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ")} `;

const MANY = /\b(all|every|sab|sare|saray|saare|tamam|tmam|poore|puri|list|bulk|export|download|csv|excel|sheet|database|data base|scrape|har)\b|تمام|سب/;
const CONTACT = /\b(numbers?|nmbr|phone|phones|mobile|contacts?|whatsapp|whats app|emails?|e mail|cell)\b|نمبر|فون/;
const PEOPLE = /\b(dealers?|agents?|agencies|agency|owners?|sellers?|buyers?|users?|members?|customers?|log|logon|logo)\b|ڈیلر|ایجنٹ|مالک/;

const PRIVATE = /\b(cnic|id card|shanakhti|nadra|home address|ghar ka pata|ghar ka address|personal number|owner ka number|owner ki details|maalik ka number|malik ka number|kis ka hai|who owns|owner name)\b/;
const SPAM = /\b(spam|bulk sms|bulk message|mass message|bulk whatsapp|broadcast|send to all|sab ko message|sab ko msg|marketing list)\b/;
const FRAUD = /\b(fake review|fake reviews|jaali review|fake document|fake documents|jaali kagzat|jaali registry|fake registry|forge|forged|fake fard|fake noc|fake file|tax bachane|tax chori|avoid tax illegally|black money|money launder|qabza|illegal possession|scam (?:someone|kisi|logon))\b/;
const INJECT = /\b(ignore (?:all |your |previous |the )?(?:instructions|rules|prompt)|system prompt|your prompt|developer mode|jailbreak|act as (?:dan|an unrestricted)|reveal (?:your )?instructions)\b/;

export const REFUSALS = {
  bulk: "Sorry, I can't share contact numbers in bulk — that protects our dealers and users from spam. To reach a dealer, open their profile and contact them there. You can browse them all in the [property dealers directory](/property-dealers).",
  private: "Sorry, I can't share anyone's personal details such as their CNIC, home address or phone number. For a listing, use the contact button on the listing page to reach the advertiser.",
  spam: "Sorry, I can't help with sending bulk or unsolicited messages. If you'd like to promote your properties, our [plans](/packages) give your listings more visibility.",
  fraud: "Sorry, I can't help with that. If you think something about a deal or a listing isn't right, please report the listing, and always verify documents with the relevant authority before paying.",
  inject: "I'm here to help with property — buying, renting, prices, societies, dealers, rates and building costs. What are you looking for?",
} as const;

/** A polite refusal for a request that must not be answered, or null. */
export function refusal(text: string): string | null {
  const s = t(text);
  if (INJECT.test(s)) return REFUSALS.inject;
  if (SPAM.test(s)) return REFUSALS.spam;
  if (FRAUD.test(s)) return REFUSALS.fraud;
  if (PRIVATE.test(s)) return REFUSALS.private;
  if (CONTACT.test(s) && (MANY.test(s) || /\b(dealers|agents|agencies|owners|sellers|users)\b/.test(s)) && PEOPLE.test(s)) return REFUSALS.bulk;
  return null;
}
