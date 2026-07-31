import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  db,
  publishedPageRecords,
  publishedPages,
  publishedPageVersions,
  users,
} from '@/lib/db';
import { ensurePublishedPagesTable } from '@/lib/db/published-pages';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { recordPageUpdateAndNotify } from '@/lib/services/community';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

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

/**
 * 发布页面
 * @summary 发布或更新页面
 * @description 发布或更新已发布页面，需登录。支持定时发布（scheduled_at）、合集章节管理（collection_slug/collection_name）、SEO 元数据。自动同步合集内章节信息。成功返回 page_uid、url、read_url、updated 标识
 * @body PublishPageBody
 * @response 200:PublishPageResponse:发布成功，返回页面信息和访问链接
 * @response 400:ErrorResponse:缺少必填字段（uid、title、html）
 * @responseSet auth
 * @auth bearer
 * @tag Pages
 */
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
      cover_url: coverUrl,
      category_id: categoryId,
      tags,
      visibility,
      importance,
      collection_slug: collectionSlug,
      collection_name: collectionName,
      scheduled_at: scheduledAtRaw,
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
    const normalizedVisibility =
      visibility === 'unlisted' || visibility === 'private' ? visibility : 'public';
    const normalizedImportance = importance === 'major' ? 'major' : 'normal';

    // Scheduled publishing support
    let scheduledAt: Date | null = null;
    if (typeof scheduledAtRaw === "string" && scheduledAtRaw.trim()) {
      const parsed = new Date(scheduledAtRaw);
      if (!Number.isNaN(parsed.getTime()) && parsed > new Date()) {
        scheduledAt = parsed;
      }
    }

    // Determine publish timestamps: use NOW() for immediate, scheduled time for scheduled
    const nowOrScheduled = scheduledAt ? scheduledAt : sql`now()`;

    await ensurePublishedPagesTable();

    // Fetch user info for denormalized author fields
    const author = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        displayName: true,
        avatarUrl: true,
      },
    });
    const authorDisplayName = author?.displayName ?? session.username;
    const authorAvatarUrl = author?.avatarUrl ?? session.avatarUrl ?? null;

    const normalizedCoverUrl = typeof coverUrl === 'string' && coverUrl.trim()
      ? coverUrl.trim()
      : null;

    const latestVersion = await db.query.publishedPageVersions.findFirst({
      where: and(
        eq(publishedPageVersions.userId, session.userId),
        eq(publishedPageVersions.uid, uid)
      ),
      orderBy: [desc(publishedPageVersions.version)],
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;
    const eventType = latestVersion ? 'updated' : 'published';

    // Compute chaptersJson for collection sync
    const normalizedCollectionSlug = typeof collectionSlug === 'string' && collectionSlug.trim()
      ? collectionSlug.trim()
      : null;
    const normalizedCollectionName = typeof collectionName === 'string' && collectionName.trim()
      ? collectionName.trim()
      : null;

    let chaptersJson: Record<string, unknown> | null = null;

    if (normalizedCollectionSlug && normalizedCollectionName) {
      // Find existing pages in the same collection (same author)
      const siblingPages = await db.query.publishedPages.findMany({
        where: and(
          eq(publishedPages.userId, session.userId),
          isNotNull(publishedPages.chaptersJson)
        ),
      });

      const collectionPages = siblingPages.filter((p) => {
        try {
          const cj = p.chaptersJson as Record<string, unknown> | null;
          return cj && typeof cj === 'object' && cj.collection_slug === normalizedCollectionSlug;
        } catch {
          return false;
        }
      });

      // Collect existing chapters from sibling pages
      const existingChapters = new Map<number, { number: number; title: string; page_slug: string }>();
      for (const p of collectionPages) {
        const cj = p.chaptersJson as Record<string, unknown> | null;
        const chapters = cj?.chapters as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(chapters)) {
          for (const ch of chapters) {
            if (typeof ch.number === 'number' && typeof ch.title === 'string') {
              existingChapters.set(ch.number, {
                number: ch.number,
                title: ch.title as string,
                page_slug: typeof ch.page_slug === 'string' ? ch.page_slug : '',
              });
            }
          }
        }
      }

      // Add/update current page as a chapter
      existingChapters.set(existingChapters.size + 1, {
        number: existingChapters.size + 1,
        title: title.trim(),
        page_slug: uid,
      });

      const sortedChapters = Array.from(existingChapters.values())
        .sort((a, b) => a.number - b.number)
        .map((ch, idx) => ({
          number: idx + 1,
          title: ch.title,
          page_slug: ch.page_slug,
        }));

      chaptersJson = {
        collection_slug: normalizedCollectionSlug,
        collection_name: normalizedCollectionName,
        chapters: sortedChapters,
      } as unknown as Record<string, unknown>;
    }

    await db
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
        coverUrl: normalizedCoverUrl,
        tags: normalizedTags,
        visibility: normalizedVisibility,
        moderationStatus: 'approved',
        authorSlug: session.userSlug,
        authorDisplayName,
        authorAvatarUrl,
        publishedAt: nowOrScheduled,
        lastPublishedAt: nowOrScheduled,
        versionCount: nextVersion,
        chaptersJson,
        scheduledAt,
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
          coverUrl: normalizedCoverUrl,
          tags: normalizedTags,
          visibility: normalizedVisibility,
          moderationStatus: 'approved',
          authorSlug: session.userSlug,
          authorDisplayName,
          authorAvatarUrl,
          lastPublishedAt: nowOrScheduled,
          versionCount: nextVersion,
          updatedAt: sql`now()`,
          chaptersJson,
          scheduledAt,
        },
      });

    const updatedPublishedPage = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.userId, session.userId),
        eq(publishedPages.uid, uid)
      ),
    });

    if (!updatedPublishedPage) {
      throw new Error('Published page was not found after upsert');
    }

    // Sync chaptersJson to sibling pages in the same collection
    if (chaptersJson) {
      const collectionSlugVal = (chaptersJson as Record<string, unknown>).collection_slug as string;
      if (collectionSlugVal) {
        const siblingPages = await db.query.publishedPages.findMany({
          where: and(
            eq(publishedPages.userId, session.userId),
            isNotNull(publishedPages.chaptersJson),
            // Exclude the page we just upserted
            sql`${publishedPages.id} != ${updatedPublishedPage.id}`
          ),
        });

        for (const sibling of siblingPages) {
          const cj = sibling.chaptersJson as Record<string, unknown> | null;
          if (cj && typeof cj === 'object' && cj.collection_slug === collectionSlugVal && sibling.id !== updatedPublishedPage.id) {
            await db
              .update(publishedPages)
              .set({ chaptersJson })
              .where(eq(publishedPages.id, sibling.id));
          }
        }
      }
    }

    await db.insert(publishedPageVersions).values({
      publishedPageId: updatedPublishedPage.id,
      uid,
      userId: session.userId,
      version: nextVersion,
      title,
      icon: icon ?? null,
      description: description ?? null,
      html,
      categoryId: typeof categoryId === 'string' ? categoryId : null,
      coverUrl: normalizedCoverUrl,
      tags: normalizedTags,
      visibility: normalizedVisibility,
      moderationStatus: 'approved',
      publishedAt: new Date(),
      chaptersJson: chaptersJson as Record<string, unknown> | undefined,
    });

    const latestRecord = await db.query.publishedPageRecords.findFirst({
      where: and(
        eq(publishedPageRecords.userId, session.userId),
        eq(publishedPageRecords.uid, uid)
      ),
      orderBy: [desc(publishedPageRecords.recordNumber)],
    });

    await db.insert(publishedPageRecords).values({
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

    await recordPageUpdateAndNotify(db, {
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

    return NextResponse.json({
      success: true,
      page_uid: uid,
      url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
      read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
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
