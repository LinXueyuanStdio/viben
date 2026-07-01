import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import sharp from 'sharp';
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
    const ext = file.name.split('.').pop()?.toLowerCase() || file.type.split('/')[1] || 'png';
    const kind = (formData.get('kind') as string) || 'page_cover';
    const folder = kind === 'avatar' ? 'avatars' : 'media';
    const key = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    // 获取原图尺寸
    const metadata = await sharp(buffer).metadata();
    const imageWidth = metadata.width ?? null;
    const imageHeight = metadata.height ?? null;

    const result = await getStorage().upload(key, buffer, { contentType: file.type });

    // Use proxy URL for Vercel Blob (private blobs return 403 on direct access)
    const assetUrl = result.pathname
      ? `/api/media/asset?pathname=${encodeURIComponent(result.pathname)}`
      : result.url;

    // 生成缩略图（400px 宽，保持比例，不放大）
    let thumbnailUrl: string | null = null;
    try {
      const thumbKey = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}_thumb.${ext}`;
      const thumbBuffer = await sharp(buffer)
        .resize(400, undefined, { withoutEnlargement: true })
        .toFormat(file.type === 'image/png' ? 'png' : 'jpeg', file.type === 'image/png' ? {} : { quality: 85 })
        .toBuffer();
      const thumbResult = await getStorage().upload(thumbKey, thumbBuffer, { contentType: file.type });
      thumbnailUrl = thumbResult.pathname
        ? `/api/media/asset?pathname=${encodeURIComponent(thumbResult.pathname)}`
        : thumbResult.url;
    } catch (e) {
      // 缩略图生成失败不阻塞上传
      console.warn('Thumbnail generation failed:', e);
    }

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerUserId: session.userId,
        kind,
        source: 'object_storage',
        url: assetUrl,
        thumbnailUrl,
        mimeType: file.type,
        width: imageWidth,
        height: imageHeight,
        sizeBytes: file.size,
      })
      .returning({ id: mediaAssets.id, thumbnailUrl: mediaAssets.thumbnailUrl });

    return NextResponse.json({
      url: assetUrl,
      asset_id: asset.id,
      thumbnail_url: asset.thumbnailUrl,
    });
  } catch (error) {
    console.error('Media upload failed:', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}
