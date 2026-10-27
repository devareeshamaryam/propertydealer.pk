import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/*
 * Called by the API after every write, so a change shows on the site at once.
 *
 * A path is refreshed three ways, because Next keys its cache two ways:
 *  - the address itself ("/agents/first-capital-…"), which is what a
 *    concrete page like an agent's profile or a listing is cached under;
 *  - the section with everything in it ("/agents" and all pages below it).
 *    The public pages live in the (pages) route group, and a section is only
 *    found under its group name — "/(pages)/agents" — so both are sent.
 * Without the first two, an agent's new cover, photo or bio waited for the
 * 10-minute timer: the old call only reached a section name that no page has.
 *
 * Tags expire at once ({ expire: 0 }): the next visit renders fresh data
 * instead of one more visit of the old page.
 */
const GROUPS = ['(pages)', '(auth)'];

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');

  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tags: string[] = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string' && t) : [];
    const paths: string[] = Array.isArray(body.paths)
      ? body.paths.filter((p: unknown) => typeof p === 'string' && p.startsWith('/'))
      : [];

    for (const tag of [...tags, 'blogs']) {
      revalidateTag(tag, { expire: 0 });
    }

    for (const raw of [...paths, '/blog']) {
      const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
      revalidatePath(path);
      revalidatePath(path, 'layout');
      if (path !== '/') for (const group of GROUPS) revalidatePath(`/${group}${path}`, 'layout');
    }

    return NextResponse.json({
      revalidated: true,
      tags,
      paths,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Revalidation failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
