/**
 * Admin Media Assets API
 *
 * GET /api/admin/media - List all media assets for management
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, mediaAssets, users } from '@/lib/db';
import { eq, desc, count, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listMediaQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  kind: z.string().optional(),
  source: z.enum(['external_url', 'object_storage', 'generated', 'all']).default('all'),
  mime_type: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listMediaQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, kind, source, mime_type } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (kind) {
      conditions.push(eq(mediaAssets.kind, kind));
    }
    if (source !== 'all') {
      conditions.push(eq(mediaAssets.source, source));
    }
    if (mime_type) {
      conditions.push(eq(mediaAssets.mimeType, mime_type));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(mediaAssets)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const assetList = await db
      .select({
        id: mediaAssets.id,
        ownerUserId: mediaAssets.ownerUserId,
        kind: mediaAssets.kind,
        source: mediaAssets.source,
        url: mediaAssets.url,
        thumbnailUrl: mediaAssets.thumbnailUrl,
        mimeType: mediaAssets.mimeType,
        width: mediaAssets.width,
        height: mediaAssets.height,
        sizeBytes: mediaAssets.sizeBytes,
        altText: mediaAssets.altText,
        metadata: mediaAssets.metadata,
        createdAt: mediaAssets.createdAt,
        ownerUsername: users.username,
        ownerDisplayName: users.displayName,
        ownerAvatarUrl: users.avatarUrl,
      })
      .from(mediaAssets)
      .leftJoin(users, eq(mediaAssets.ownerUserId, users.id))
      .where(whereClause)
      .orderBy(desc(mediaAssets.createdAt))
      .limit(limit)
      .offset(offset);

    const assets = assetList.map((a) => ({
      id: a.id,
      kind: a.kind,
      source: a.source,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      sizeBytes: a.sizeBytes,
      altText: a.altText,
      metadata: a.metadata,
      createdAt: a.createdAt,
      owner: a.ownerUserId
        ? {
            id: a.ownerUserId,
            username: a.ownerUsername,
            displayName: a.ownerDisplayName,
            avatarUrl: a.ownerAvatarUrl,
          }
        : null,
    }));

    return NextResponse.json({
      assets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List admin media assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
