import type { Metadata } from "next";

/**
 * Per-page metadata, with the admin panel able to override it.
 *
 * ## The problem this solves
 *
 * A Next.js page that exports no `metadata` inherits the root layout's — so
 * /properties, /about, /packages and /emap were all serving the home page's
 * title and description verbatim. To a search engine that reads as four more
 * copies of the home page: the wrong page wins for the query, the right one
 * is treated as a duplicate, and the snippet under every result says the same
 * sentence.
 *
 * ## How it works
 *
 * Every route that uses this passes a fallback written for that page. That
 * alone fixes the duplication. On top of it, the route may name a slug in the
 * Static Pages CMS (/dashboard/pages): if a published page exists under that
 * slug, its Meta Title and Meta Description win. So the pages worth tuning are
 * tunable from the admin panel without a deploy, and the ones nobody has
 * touched still carry their own words rather than the home page's.
 *
 * The CMS row is optional by design. Nothing breaks and nothing falls back to
 * the home page when it is missing, when the API is down, or when the build
 * runs with no API at all — which it does.
 */

export interface PageSeo {
  /** Shown in the tab and as the SERP headline. Keep it under ~60 characters. */
  title: string;
  /** The SERP snippet. Around 150–160 characters is what gets shown. */
  description: string;
  /** Canonical path on this site, e.g. "/properties". */
  path: string;
  keywords?: string[];
  /**
   * Keep it out of the index. For pages that exist to be used, not found:
   * sign-in, sign-up, checkout. They are still followed, so the links on them
   * still count.
   */
  noindex?: boolean;
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://propertydealer.pk"
).replace(/\/$/, "");

/** Where the server should call the API — the same rule lib/api.ts uses. */
function apiBase(): string {
  const internal = process.env.INTERNAL_API_URL;
  if (internal) {
    return internal.endsWith("/") ? `${internal}api` : `${internal}/api`;
  }
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicUrl) {
    return publicUrl.endsWith("/") ? `${publicUrl}api` : `${publicUrl}/api`;
  }
  return `${SITE_URL}/api`;
}

interface CmsPage {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  keywords?: string[];
  title?: string;
  excerpt?: string;
}

/**
 * The admin's overrides for one slug, or null.
 *
 * Deliberately quiet: a page must render with correct metadata whether or not
 * the API answers, so every failure here is a fallback, never an error. The
 * build itself calls this with no API running.
 */
async function cmsOverrides(slug: string): Promise<CmsPage | null> {
  try {
    const response = await fetch(`${apiBase()}/page/slug/${encodeURIComponent(slug)}`, {
      // Long enough that this is not a round trip per request, short enough
      // that an edit in the admin panel shows up the same day.
      next: { revalidate: 900 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as CmsPage | null;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/**
 * Build a page's metadata: the route's own words, overridden by the CMS.
 *
 * @param cmsSlug slug in the Static Pages CMS whose Meta Title / Meta
 *   Description should win, or null for a page that is not meant to be
 *   editable from the admin panel.
 */
export async function pageMetadata(
  cmsSlug: string | null,
  fallback: PageSeo,
): Promise<Metadata> {
  const cms = cmsSlug ? await cmsOverrides(cmsSlug) : null;

  const title = cms?.metaTitle?.trim() || fallback.title;
  const description =
    cms?.metaDescription?.trim() || cms?.excerpt?.trim() || fallback.description;

  const canonical = cms?.canonicalUrl?.trim() || `${SITE_URL}${fallback.path}`;
  const keywords =
    cms?.keywords && cms.keywords.length > 0 ? cms.keywords : fallback.keywords;

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "en_PK",
      url: canonical,
      siteName: "Property Dealer",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: fallback.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}
