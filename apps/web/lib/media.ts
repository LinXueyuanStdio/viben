import sharp from 'sharp';
import { db, mediaAssets } from '@/lib/db';
import { getStorage } from '@/lib/storage';

/**
 * 下载外部图片并上传到媒体存储。
 * 用于第三方登录时自动迁移外部头像。
 */
export async function uploadImageFromUrl(params: {
  imageUrl: string;
  kind: string;
  userSlug: string;
  userId: string;
  /** avatar / page_cover 时必传 */
  uid?: string;
}): Promise<string | null> {
  const { imageUrl, kind, userSlug, userId, uid } = params;
  const resolvedUid = uid || crypto.randomUUID();

  try {
    // 下载外部图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn('[Media] Failed to fetch external image', { imageUrl, status: response.status });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/png';
    const ext = contentType.split('/')[1] || 'png';

    const baseName = `${kind}/${userSlug}/${resolvedUid}`;
    const key = `${baseName}.${ext}`;

    // 统一转 PNG
    const pngBuffer = await sharp(buffer).png().toBuffer();

    // 获取尺寸
    const metadata = await sharp(buffer).metadata();

    // 上传原图
    const result = await getStorage().upload(key, pngBuffer, { contentType: 'image/png' });
    const assetUrl = result.pathname
      ? `/api/media/asset?pathname=${encodeURIComponent(result.pathname)}`
      : result.url;

    // 缩略图
    let thumbnailUrl: string | null = null;
    try {
      const thumbKey = `${baseName}_thumb.${ext}`;
      const thumbBuffer = await sharp(buffer)
        .resize(400, undefined, { withoutEnlargement: true })
        .png()
        .toBuffer();
      const thumbResult = await getStorage().upload(thumbKey, thumbBuffer, { contentType: 'image/png' });
      thumbnailUrl = thumbResult.pathname
        ? `/api/media/asset?pathname=${encodeURIComponent(thumbResult.pathname)}`
        : thumbResult.url;
    } catch (e) {
      console.warn('[Media] Thumbnail generation failed:', e);
    }

    // 写入 media_assets 表
    await db.insert(mediaAssets).values({
      ownerUserId: userId,
      kind,
      source: 'external_url',
      url: assetUrl,
      thumbnailUrl,
      mimeType: 'image/png',
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      sizeBytes: pngBuffer.length,
    });

    return assetUrl;
  } catch (error) {
    console.error('[Media] Failed to upload image from URL:', error);
    return null;
  }
}
