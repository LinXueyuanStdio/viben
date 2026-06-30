import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { mediaAssets } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'missing_file' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'invalid_file_type' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1] || 'png';
    const key = `media/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const result = await getStorage().upload(key, buffer, { contentType: file.type });

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerUserId: session.userId,
        kind: 'page_cover',
        source: 'object_storage',
        url: result.url,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      .returning({ id: mediaAssets.id });

    return NextResponse.json({ url: result.url, asset_id: asset.id });
  } catch (error) {
    console.error('Media upload failed:', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}
