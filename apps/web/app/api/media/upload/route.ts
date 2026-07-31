import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import sharp from 'sharp';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { mediaAssets } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 上传媒体文件
 * @summary 上传媒体文件
 * @description 上传图片等媒体文件到存储服务，支持 media/avatar/page_cover 三种用途。FormData 格式（非 JSON body），文件限制：PNG/JPEG/WebP/GIF，最大 10MB。avatar 和 page_cover 类型必须传 uid。成功返回 url（代理 URL）、asset_id（资源 ID）、thumbnail_url（缩略图 URL，可能为 null）
 * @body MediaUploadBody — FormData 字段：file（文件）、kind（用途）、user_slug、uid
 * @response 200:MediaUploadResponse:上传成功，返回 url、asset_id、thumbnail_url
 * @response 400:ErrorResponse:文件类型不支持或大小超限
 * @responseSet auth
 * @auth bearer
 * @tag Media
 */
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
    const kind = (formData.get('kind') as string) || 'media';
    const userSlug = (formData.get('user_slug') as string) || session.userSlug;

    if (!userSlug) {
      return NextResponse.json({ error: 'user_slug is required' }, { status: 400 });
    }

    // uid: avatar / page_cover 必传，其余自动生成
    const rawUid = (formData.get('uid') as string) || null;
    if ((kind === 'avatar' || kind === 'page_cover') && !rawUid) {
      return NextResponse.json({ error: 'uid is required for this kind' }, { status: 400 });
    }
    const uid = rawUid || crypto.randomUUID();

    // 统一路径：kind/userSlug/{uid}
    const baseName = kind === 'page_cover'
      ? `page_cover/${userSlug}/${uid}_cover`
      : `${kind}/${userSlug}/${uid}`;
    const key = `${baseName}.${ext}`

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
      const thumbKey = `${baseName}_thumb.${ext}`
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
