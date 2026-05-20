 import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * On-demand ISR revalidation webhook.
 *
 * The NestJS API calls this endpoint after every admin write (property
 * approve/reject, blog publish, material-rate update, city/area edit, …).
 * It busts the Next.js fetch cache by `tag` and re-renders affected ISR
 * pages by `path`.
 *
 * Authentication: a shared secret in the `x-revalidate-secret` header. The
 * web app refuses every request without an exact match.
 *
 * NOTE: the request body is intentionally minimal — `tags: string[]` and
 * `paths: string[]`. Both are optional; passing only `tags` revalidates
 * `fetch()` calls, passing `paths` re-renders specific routes. Most callers
 * pass both for safety.
 */

// Always run dynamic; never cache the webhook itself.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PATHS_PER_CALL = 32;
const MAX_TAGS_PER_CALL = 32;

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || expected.length < 16) {
    // Fail-closed: refuse if the secret isn't configured. Avoids accidental
    // open invalidation in production.
    return NextResponse.json(
      { ok: false, error: 'revalidate secret not configured' },
      { status: 503 },
    );
  }

  const provided = request.headers.get('x-revalidate-secret') || '';
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { tags?: unknown; paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? (body.tags.filter((t) => typeof t === 'string' && t.length > 0) as string[]).slice(0, MAX_TAGS_PER_CALL)
    : [];
  const paths = Array.isArray(body.paths)
    ? (body.paths.filter((p) => typeof p === 'string' && p.startsWith('/')) as string[]).slice(0, MAX_PATHS_PER_CALL)
    : [];

  const revalidatedTags: string[] = [];
  const revalidatedPaths: string[] = [];
  const errors: Array<{ kind: 'tag' | 'path'; value: string; message: string }> = [];

  for (const tag of tags) {
    try {
      // Cast to `any` to guard against mismatched Next.js type definitions
      // that incorrectly expect a second argument. The runtime API only ever
      // takes one argument (the tag string).
      (revalidateTag as (tag: string) => void)(tag);
      revalidatedTags.push(tag);
    } catch (err: any) {
      errors.push({ kind: 'tag', value: tag, message: err?.message ?? String(err) });
    }
  }

  for (const p of paths) {
    try {
      // 'page' here means the whole page route, not just one specific URL.
      revalidatePath(p, 'page');
      revalidatedPaths.push(p);
    } catch (err: any) {
      errors.push({ kind: 'path', value: p, message: err?.message ?? String(err) });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    revalidatedTags,
    revalidatedPaths,
    errors,
    now: Date.now(),
  });
}

// GET returns a tiny health payload so an operator can quickly check the
// webhook is reachable without bothering with the secret.
export async function GET() {
  const configured =
    !!process.env.REVALIDATE_SECRET && process.env.REVALIDATE_SECRET.length >= 16;
  return NextResponse.json({
    ok: true,
    configured,
    expectedHeader: 'x-revalidate-secret',
    expects: { tags: 'string[]', paths: 'string[] (must start with /)' },
  });
}