import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const contentType = file.type || 'application/octet-stream';
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowed.some((t) => contentType.startsWith(t) || t === contentType)) {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 },
      );
    }

    // 25MB soft limit
    if (typeof file.size === 'number' && file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 25MB)' },
        { status: 400 },
      );
    }

    const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';
    const pathname = `datesheets/${Date.now()}-${safeName}`;
    const blob = await put(pathname, file, { access: 'public', contentType });

    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
