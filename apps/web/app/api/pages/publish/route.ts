import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  db,
  mediaAssets,
  publishedPageRecords,
  publishedPages,
  publishedPageVersions,
} from '@/lib/db';
import { ensurePublishedPagesTable } from '@/lib/db/published-pages';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { recordPageUpdateAndNotify } from '@/lib/services/community';
import { and, desc, eq, sql } from 'drizzle-orm';

interface IconPayload {
  type: string;
  value: string;
}

function isIconPayload(value: unknown): value is IconPayload {
  if (!value || typeof value !== 'object') return false;
  const icon = value as Record<string, unknown>;
  return typeof icon.type === 'string' && typeof icon.value === 'string';
}

function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    const {
      uid,
      title,
      icon,
      description,
      html,
      category_id: categoryId,
      cover_asset_id: coverAssetId,
      tags,
      visibility,
      importance,
    } = body;

    if (typeof uid !== 'string' || !uid.trim() || typeof title !== 'string' || !title.trim() || typeof html !== 'string' || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, title, html' },
        { status: 400 }
      );
    }

    if (icon !== undefined && icon !== null && !isIconPayload(icon)) {
      return NextResponse.json(
        { error: 'icon must be an object with string type and value' },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description must be a string' },
        { status: 400 }
      );
    }

    const normalizedTags = Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12)
      : [];
    const normalizedCoverAssetId = typeof coverAssetId === 'string' ? coverAssetId : null;
    const normalizedVisibility =
      visibility === 'unlisted' || visibility === 'private' ? visibility : 'public';
    const normalizedImportance = importance === 'major' ? 'major' : 'normal';

    await ensurePublishedPagesTable();

    if (normalizedCoverAssetId) {
      const coverAsset = await db.query.mediaAssets.findFirst({
        where: and(
          eq(mediaAssets.id, normalizedCoverAssetId),
          eq(mediaAssets.ownerUserId, session.userId)
        ),
      });

      if (!coverAsset) {
        return NextResponse.json(
          { error: 'cover_asset_id is invalid or not owned by the current user' },
          { status: 400 }
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${session.userId}), hashtext(${uid}))`);

      const latestVersion = await tx.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, session.userId),
          eq(publishedPageVersions.uid, uid)
        ),
        orderBy: [desc(publishedPageVersions.version)],
      });

      const nextVersion = (latestVersion?.version ?? 0) + 1;
      const eventType = latestVersion ? 'updated' : 'published';

      await tx
        .insert(publishedPages)
        .values({
          uid,
          userId: session.userId,
          title,
          icon: icon ?? null,
          description: description ?? null,
          html,
          currentVersion: nextVersion,
          categoryId: typeof categoryId === 'string' ? categoryId : null,
          coverAssetId: normalizedCoverAssetId,
          tags: normalizedTags,
          visibility: normalizedVisibility,
          moderationStatus: 'approved',
          publishedAt: sql`now()`,
          lastPublishedAt: sql`now()`,
          versionCount: nextVersion,
        })
        .onConflictDoUpdate({
          target: [publishedPages.userId, publishedPages.uid],
          set: {
            title,
            icon: icon ?? null,
            description: description ?? null,
            html,
            currentVersion: nextVersion,
            categoryId: typeof categoryId === 'string' ? categoryId : null,
            coverAssetId: normalizedCoverAssetId,
            tags: normalizedTags,
            visibility: normalizedVisibility,
            moderationStatus: 'approved',
            lastPublishedAt: sql`now()`,
            versionCount: nextVersion,
            updatedAt: sql`now()`,
          },
        });

      const updatedPublishedPage = await tx.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.userId, session.userId),
          eq(publishedPages.uid, uid)
        ),
      });

      if (!updatedPublishedPage) {
        throw new Error('Published page was not found after upsert');
      }

      await tx.insert(publishedPageVersions).values({
        publishedPageId: updatedPublishedPage.id,
        uid,
        userId: session.userId,
        version: nextVersion,
        title,
        icon: icon ?? null,
        description: description ?? null,
        html,
        categoryId: typeof categoryId === 'string' ? categoryId : null,
        coverAssetId: normalizedCoverAssetId,
        tags: normalizedTags,
        visibility: normalizedVisibility,
        moderationStatus: 'approved',
        publishedAt: new Date(),
      });

      const latestRecord = await tx.query.publishedPageRecords.findFirst({
        where: and(
          eq(publishedPageRecords.userId, session.userId),
          eq(publishedPageRecords.uid, uid)
        ),
        orderBy: [desc(publishedPageRecords.recordNumber)],
      });

      await tx.insert(publishedPageRecords).values({
        publishedPageId: updatedPublishedPage.id,
        uid,
        userId: session.userId,
        recordNumber: (latestRecord?.recordNumber ?? 0) + 1,
        version: nextVersion,
        action: 'publish',
        title,
        icon: icon ?? null,
        description: description ?? null,
      });

      await recordPageUpdateAndNotify(tx, {
        publishedPageId: updatedPublishedPage.id,
        userId: session.userId,
        userSlug: session.userSlug,
        pageId: uid,
        version: nextVersion,
        eventType,
        importance: normalizedImportance,
        title,
        description: description ?? null,
        visibility: normalizedVisibility,
      });
    });

    return NextResponse.json({
      success: true,
      page_uid: uid,
      url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
      read_url: `/read/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
      updated: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Publish page error:', error);
    return NextResponse.json(
      {
        error: 'Failed to publish page',
        details: getErrorDetails(error),
      },
      { status: 500 }
    );
  }
}
