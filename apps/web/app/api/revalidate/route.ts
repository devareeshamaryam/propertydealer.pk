 import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');

  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tags: string[] = body.tags ?? [];
    const paths: string[] = body.paths ?? [];

    for (const tag of tags) {
      revalidateTag(tag);
    }

    for (const path of paths) {
      revalidatePath(path, 'layout');
    }

    // Default — blogs hamesha fresh
    revalidateTag('blogs');
    revalidatePath('/blog', 'layout');

    return NextResponse.json({
      revalidated: true,
      tags,
      paths,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Revalidation failed', message: err.message },
      { status: 500 }
    );
  }
}