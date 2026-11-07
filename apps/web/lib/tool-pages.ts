import type { Metadata } from 'next';
import { toolBySlug } from './tools';

/*
 * Tool pages' SEO and text. Each page has built-in text (below); the admin
 * can replace any of it from Dashboard → Tool Pages, add a block of rich text
 * shown under the tool, and add questions. Empty fields keep the built-in.
 */

export interface ToolPageText {
  metaTitle?: string;
  metaDescription?: string;
  /** Comma-separated. */
  keywords?: string;
  ogImage?: string;
  heading?: string;
  intro?: string;
  contentTitle?: string;
  content?: string;
  faqs?: { q: string; a: string }[];
  noindex?: boolean;
  updatedAt?: string;
}

export interface ToolPageDefaults {
  /** Where the page lives. */
  path: string;
  /** Name in the admin list. */
  name: string;
  title: string;
  description: string;
  keywords: string[];
  heading: string;
  intro: string;
}

const YEAR = new Date().getFullYear();
const desc = (slug: string) => toolBySlug(slug).description;

/** The tools page itself is "index". */
export const TOOL_PAGE_DEFAULTS: Record<string, ToolPageDefaults> = {
  index: {
    path: '/tools',
    name: 'All tools page',
    title: 'Property Tools — Construction Cost, Area Converter, Home Loan & More',
    description:
      'Free property tools for Pakistan: construction cost on live material rates, marla/kanal area converter, price per marla, home loan, instalment plan and rental yield calculators.',
    keywords: [],
    heading: 'Property tools',
    intro: 'Quick, free answers for buying, building and renting in Pakistan.',
  },
  'construction-cost-calculator': {
    path: '/tools/construction-cost-calculator',
    name: 'Construction Cost Calculator',
    title: `House Construction Cost Calculator Pakistan ${YEAR} — Grey & Complete`,
    description:
      "Free house construction cost calculator for Pakistan: estimate grey structure and complete house cost on today's cement, steel and brick rates — by city, plot size and storeys.",
    keywords: ['house construction cost calculator', 'house construction cost calculator pakistan', 'construction cost calculator pakistan', 'construction cost calculator', 'grey structure cost', 'construction cost per square foot pakistan'],
    heading: 'House Construction Cost Calculator Pakistan',
    intro:
      "A construction cost calculator for Pakistan on live rates: pick your plot, storeys and city — see the grey structure and complete house cost on today's cement, steel and brick prices, and where every rupee goes.",
  },
  'bricks-calculator': {
    path: '/tools/bricks-calculator',
    name: 'Bricks Calculator',
    title: `Bricks Calculator Pakistan ${YEAR} — Room, Boundary Wall & House`,
    description:
      "Free bricks calculator for Pakistan: how many bricks, cement bags and sand for a room, a boundary wall round your plot, a whole house or any wall — priced on today's rates, ready to WhatsApp to your supplier.",
    keywords: ['bricks calculator', 'brick calculator pakistan', 'how many bricks in 1 sq ft', 'bricks per square foot', 'bricks in 9 inch wall', 'brick wall calculator', 'bricks cement sand calculator', 'bricks for boundary wall', 'bricks for 5 marla house', 'bricks for one room'],
    heading: 'Bricks Calculator',
    intro:
      "Pick what you're building — a room, a boundary wall, a whole house or one wall — and see the bricks, cement and sand it takes, priced on today's rates. Send the list to your supplier on WhatsApp.",
  },
  'cement-bags-calculator': {
    path: '/tools/cement-bags-calculator',
    name: 'Cement Bags Calculator',
    title: `Cement Bags Calculator Pakistan ${YEAR} — Roof, Plaster, Floor & House`,
    description:
      "Free cement calculator for Pakistan: cement bags, sand and crush (bajri) for a roof (lenter), a room's plaster, a floor, columns and beams, brickwork or a whole house — on today's rates, ready to WhatsApp.",
    keywords: ['cement calculator', 'cement bags calculator', 'cement calculator pakistan', 'how many cement bags for slab', 'cement sand crush calculator', '1:2:4 concrete calculator', 'plaster cement calculator', 'cement for lenter', 'cement bags for 5 marla house', 'cement for one room'],
    heading: 'Cement Bags Calculator',
    intro:
      "Pick the job — a roof (lenter), plaster for a room, a floor, columns and beams, brickwork or a whole house — and see the cement bags, sand and crush it takes on today's rates. Send the list to your supplier on WhatsApp.",
  },
  'area-unit-converter': {
    path: '/tools/area-unit-converter',
    name: 'Area Unit Converter',
    title: 'Area Converter Online — Square Feet to Marla, Kanal & Acres',
    description: 'Free online area converter: convert square feet to marla, kanal, square yards and acres, or any area to square feet. Area size converter for Pakistani plots.',
    keywords: ['area converter', 'online area converter', 'area converter square feet to marla', 'convert area to acres', 'convert area to square feet', 'area size converter', 'marla to square feet', 'kanal to marla'],
    heading: 'Area Converter — Square Feet to Marla, Kanal & Acres',
    intro: 'A free online area size converter: convert square feet to marla, marla to kanal, any area to acres or to square feet — on the marla your area actually uses.',
  },
  'price-per-marla-calculator': {
    path: '/tools/price-per-marla-calculator',
    name: 'Price per Marla Calculator',
    title: 'Price per Marla Calculator — Compare Plot Rates per Marla, Sq Ft & Sq Yd',
    description: desc('price-per-marla-calculator'),
    keywords: [],
    heading: 'Price per Marla Calculator',
    intro: "See any plot's real rate — per marla, square foot and square yard — and compare up to three to find the better buy.",
  },
  'home-loan-calculator': {
    path: '/tools/home-loan-calculator',
    name: 'Home Loan Calculator',
    title: 'Home Loan Calculator Pakistan — Monthly Instalment & Interest',
    description: desc('home-loan-calculator'),
    keywords: [],
    heading: 'Home Loan Calculator',
    intro: 'Your monthly instalment, the interest you pay over the loan and the income a bank will expect — for any price, down payment, rate and term.',
  },
  'installment-plan-calculator': {
    path: '/tools/installment-plan-calculator',
    name: 'Installment Plan Calculator',
    title: 'Plot Installment Plan Calculator — Down Payment, Balloon & Possession',
    description: desc('installment-plan-calculator'),
    keywords: [],
    heading: 'Plot Installment Plan Calculator',
    intro: 'Lay out a society plot or house instalment plan: down payment, monthly, quarterly or half-yearly instalments, balloon payments and the amount due on possession.',
  },
  'rental-yield-calculator': {
    path: '/tools/rental-yield-calculator',
    name: 'Rental Yield Calculator',
    title: 'Rental Yield Calculator — Annual Rental Yield & Rental Income Yield',
    description: 'Free rental yield calculator for Pakistan: work out annual rental yield, gross and net rental income yield and ROI — and see how to calculate rental yield step by step.',
    keywords: ['rental yield calculator', 'how to calculate rental yield', 'annual rental yield', 'rental income yield', 'net rental yield', 'gross rental yield', 'rental yield pakistan'],
    heading: 'Rental Yield Calculator',
    intro:
      'See what a property really earns: annual rental yield, gross and net rental income yield, how many years the rent takes to pay for it, and the total return with price growth — compared with a bank deposit.',
  },
};

/** {year} in the admin's text becomes the current year, so a title stays fresh. */
export const fillYear = (s: string) => s.replace(/\{year\}/gi, String(new Date().getFullYear()));

/** A page's heading and intro: the admin's, else the built-in. */
export function toolPageText(slug: string, saved: ToolPageText | null | undefined) {
  const d = TOOL_PAGE_DEFAULTS[slug];
  return {
    heading: saved?.heading ? fillYear(saved.heading) : d?.heading,
    intro: saved?.intro ? fillYear(saved.intro) : d?.intro,
  };
}

/** A page's metadata: the admin's SEO over the built-in. */
export function toolPageMetadata(slug: string, saved: ToolPageText | null | undefined): Metadata {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
  const d = TOOL_PAGE_DEFAULTS[slug]!;
  const url = `${base}${d.path}`;
  const title = saved?.metaTitle ? fillYear(saved.metaTitle) : d.title;
  const description = saved?.metaDescription ? fillYear(saved.metaDescription) : d.description;
  const keywords = saved?.keywords
    ? saved.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    : d.keywords;
  const image = saved?.ogImage ? (saved.ogImage.startsWith('/') ? `${base}${saved.ogImage}` : saved.ogImage) : undefined;
  return {
    title,
    description,
    ...(keywords.length ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', ...(image ? { images: [{ url: image }] } : {}) },
    ...(image ? { twitter: { card: 'summary_large_image', title, description, images: [image] } } : {}),
    ...(saved?.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
