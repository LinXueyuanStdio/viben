import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { AsyncLocalStorage } from "async_hooks";
import { and, eq, desc, sql } from "drizzle-orm";
import { db, publishedPages, publishedPageVersions, publishedPageRecords, users } from "@/lib/db";
import { ensurePublishedPagesTable } from "@/lib/db/published-pages";
import { validateApiKey } from "@/lib/auth/api-key";
import { decryptSession } from "@/lib/auth/jwe";
import { recordPageUpdateAndNotify } from "@/lib/services/community";
import type { Session } from "@/lib/auth/types";

// ── 认证上下文 ────────────────────────────────────────────
const sessionStore = new AsyncLocalStorage<Session | null>();

function requireSession(): Session {
  const session = sessionStore.getStore();
  if (!session) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    throw new Error(
      "Authentication required. Provide an API key via Authorization: Bearer bmcp_xxx header. " +
        `Create one at ${appUrl}/settings/api_keys`,
    );
  }
  return session;
}

// ── 从 Request 提取 Session ──────────────────────────────
async function extractSession(req: Request): Promise<Session | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  // API Key（bmcp_ 前缀）
  if (token.startsWith("bmcp_")) {
    const user = await validateApiKey(token);
    if (!user) return null;
    return {
      userId: user.id,
      username: user.username,
      userSlug: user.userSlug,
      email: user.email,
      role: user.role as Session["role"],
      expiresAt: 0,
    };
  }

  // JWE session token
  return decryptSession(token);
}

// ── MCP Handler ──────────────────────────────────────────
const mcpHandler = createMcpHandler((server) => {
  // ── search_pages ──
  server.tool(
    "search_pages",
    "搜索 viben 上已发布的公开页面。匹配标题、页面 ID 和描述，支持按作者过滤。",
    {
      query: z.string().min(1).describe("搜索关键词"),
      author_slug: z.string().optional().describe("按作者 slug 过滤"),
      limit: z.number().int().min(1).max(50).optional().describe("返回数量，默认 20"),
    },
    async ({ query, author_slug, limit = 20 }) => {
      const conditions: ReturnType<typeof sql>[] = [
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved"),
        sql`(${publishedPages.title} ILIKE ${`%${query}%`} OR ${publishedPages.uid} ILIKE ${`%${query}%`} OR COALESCE(${publishedPages.description}, '') ILIKE ${`%${query}%`})`,
      ];
      if (author_slug) {
        conditions.push(eq(publishedPages.authorSlug, author_slug));
      }

      const pages = await db
        .select({
          uid: publishedPages.uid,
          title: publishedPages.title,
          author_slug: publishedPages.authorSlug,
          description: publishedPages.description,
          tags: publishedPages.tags,
          published_at: publishedPages.publishedAt,
        })
        .from(publishedPages)
        .where(and(...conditions))
        .orderBy(desc(publishedPages.lastPublishedAt))
        .limit(limit);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ pages }) }],
      };
    },
  );

  // ── get_page ──
  server.tool(
    "get_page",
    "获取指定页面的完整内容，包括 HTML、元数据和作者信息。",
    {
      author_slug: z.string().min(1).describe("页面作者的 slug"),
      page_uid: z.string().min(1).describe("页面唯一标识符（uid）"),
    },
    async ({ author_slug, page_uid }) => {
      const page = await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.authorSlug, author_slug),
          eq(publishedPages.uid, page_uid),
        ),
      });

      if (!page) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "Page not found" }) },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              uid: page.uid,
              title: page.title,
              html: page.html,
              description: page.description,
              tags: page.tags,
              visibility: page.visibility,
              cover_url: page.coverUrl,
              published_at: page.publishedAt,
              version: page.currentVersion,
              author: {
                display_name: page.authorDisplayName,
                avatar_url: page.authorAvatarUrl,
                slug: page.authorSlug,
              },
            }),
          },
        ],
      };
    },
  );

  // ── create_page ──
  server.tool(
    "create_page",
    "发布新页面到 viben。需要认证（API Key）。如果 uid 已存在则更新内容。",
    {
      uid: z.string().min(1).max(200).describe("页面唯一标识符"),
      title: z.string().min(1).max(500).describe("页面标题"),
      html: z.string().min(1).describe("页面 HTML 内容"),
      description: z.string().max(2000).optional().describe("页面描述"),
      tags: z.array(z.string()).max(12).optional().describe("标签列表（最多 12 个）"),
      visibility: z
        .enum(["public", "unlisted", "private"])
        .optional()
        .describe("可见性，默认 public"),
      cover_url: z.string().optional().describe("封面图片 URL"),
    },
    async ({ uid, title, html, description, tags, visibility = "public", cover_url }) => {
      const session = requireSession();
      await ensurePublishedPagesTable();

      // 获取用户信息用于反范式化
      const author = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { displayName: true, avatarUrl: true },
      });
      const authorDisplayName = author?.displayName ?? session.username;
      const authorAvatarUrl = author?.avatarUrl ?? session.avatarUrl ?? null;

      // 计算版本号
      const latestVersion = await db.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, session.userId),
          eq(publishedPageVersions.uid, uid),
        ),
        orderBy: [desc(publishedPageVersions.version)],
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;
      const eventType = latestVersion ? "updated" : "published";

      const normalizedCoverUrl = cover_url?.trim() || null;
      const normalizedTags = tags?.slice(0, 12) ?? [];

      await db
        .insert(publishedPages)
        .values({
          uid,
          userId: session.userId,
          title,
          icon: null,
          description: description ?? null,
          html,
          currentVersion: nextVersion,
          coverUrl: normalizedCoverUrl,
          tags: normalizedTags,
          visibility,
          moderationStatus: "approved",
          authorSlug: session.userSlug,
          authorDisplayName,
          authorAvatarUrl,
          publishedAt: sql`now()`,
          lastPublishedAt: sql`now()`,
          versionCount: nextVersion,
        })
        .onConflictDoUpdate({
          target: [publishedPages.userId, publishedPages.uid],
          set: {
            title,
            description: description ?? null,
            html,
            currentVersion: nextVersion,
            coverUrl: normalizedCoverUrl,
            tags: normalizedTags,
            visibility,
            authorSlug: session.userSlug,
            authorDisplayName,
            authorAvatarUrl,
            lastPublishedAt: sql`now()`,
            versionCount: nextVersion,
            updatedAt: sql`now()`,
          },
        });

      // 获取 upsert 后的页面
      const updatedPage = await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.userId, session.userId),
          eq(publishedPages.uid, uid),
        ),
      });

      if (!updatedPage) {
        throw new Error("Published page was not found after upsert");
      }

      // 创建版本记录
      await db.insert(publishedPageVersions).values({
        publishedPageId: updatedPage.id,
        uid,
        userId: session.userId,
        version: nextVersion,
        title,
        icon: null,
        description: description ?? null,
        html,
        coverUrl: normalizedCoverUrl,
        tags: normalizedTags,
        visibility,
        moderationStatus: "approved",
        publishedAt: new Date(),
      });

      // 创建发布记录
      const latestRecord = await db.query.publishedPageRecords.findFirst({
        where: and(
          eq(publishedPageRecords.userId, session.userId),
          eq(publishedPageRecords.uid, uid),
        ),
        orderBy: [desc(publishedPageRecords.recordNumber)],
      });

      await db.insert(publishedPageRecords).values({
        publishedPageId: updatedPage.id,
        uid,
        userId: session.userId,
        recordNumber: (latestRecord?.recordNumber ?? 0) + 1,
        version: nextVersion,
        action: "publish",
        title,
        icon: null,
        description: description ?? null,
      });

      // 通知订阅者
      await recordPageUpdateAndNotify(db, {
        publishedPageId: updatedPage.id,
        userId: session.userId,
        userSlug: session.userSlug,
        pageId: uid,
        version: nextVersion,
        eventType,
        importance: "normal",
        title,
        description: description ?? null,
        visibility,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              page_uid: uid,
              url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
              read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
              updated: eventType === "updated",
            }),
          },
        ],
      };
    },
  );

  // ── update_page ──
  server.tool(
    "update_page",
    "更新已有页面的内容或元数据。需要认证（API Key），仅页面作者可操作。",
    {
      uid: z.string().min(1).describe("要更新的页面唯一标识符"),
      title: z.string().min(1).max(500).optional().describe("新标题"),
      html: z.string().min(1).optional().describe("新 HTML 内容"),
      description: z.string().max(2000).optional().describe("新描述"),
      tags: z.array(z.string()).max(12).optional().describe("新标签列表"),
      visibility: z
        .enum(["public", "unlisted", "private"])
        .optional()
        .describe("新可见性设置"),
      cover_url: z.string().optional().describe("新封面图片 URL"),
    },
    async ({ uid, title, html, description, tags, visibility, cover_url }) => {
      const session = requireSession();
      await ensurePublishedPagesTable();

      // 检查页面是否存在且属于当前用户
      const existing = await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.userId, session.userId),
          eq(publishedPages.uid, uid),
        ),
      });

      if (!existing) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Page not found or you do not have permission to update it",
              }),
            },
          ],
          isError: true,
        };
      }

      // 计算新版本号
      const latestVersion = await db.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, session.userId),
          eq(publishedPageVersions.uid, uid),
        ),
        orderBy: [desc(publishedPageVersions.version)],
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // 合并更新字段
      const updatedTitle = title ?? existing.title;
      const updatedHtml = html ?? existing.html;
      const updatedDescription =
        description !== undefined ? description : existing.description;
      const updatedTags = tags ?? existing.tags;
      const updatedVisibility = visibility ?? existing.visibility;
      const updatedCoverUrl =
        cover_url !== undefined ? cover_url.trim() || null : existing.coverUrl;

      await db
        .update(publishedPages)
        .set({
          title: updatedTitle,
          html: updatedHtml,
          description: updatedDescription,
          tags: updatedTags,
          visibility: updatedVisibility,
          coverUrl: updatedCoverUrl,
          currentVersion: nextVersion,
          lastPublishedAt: sql`now()`,
          versionCount: nextVersion,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(publishedPages.userId, session.userId),
            eq(publishedPages.uid, uid),
          ),
        );

      // 创建版本记录
      await db.insert(publishedPageVersions).values({
        publishedPageId: existing.id,
        uid,
        userId: session.userId,
        version: nextVersion,
        title: updatedTitle,
        icon: null,
        description: updatedDescription,
        html: updatedHtml,
        coverUrl: updatedCoverUrl,
        tags: updatedTags,
        visibility: updatedVisibility,
        moderationStatus: "approved",
        publishedAt: new Date(),
      });

      // 通知
      await recordPageUpdateAndNotify(db, {
        publishedPageId: existing.id,
        userId: session.userId,
        userSlug: session.userSlug,
        pageId: uid,
        version: nextVersion,
        eventType: "updated",
        importance: "normal",
        title: updatedTitle,
        description: updatedDescription ?? null,
        visibility: updatedVisibility,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              page_uid: uid,
              url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
              read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
              updated: true,
            }),
          },
        ],
      };
    },
  );
});

// ── 导出 Route Handler ──────────────────────────────────
async function handle(req: Request): Promise<Response> {
  const session = await extractSession(req);
  return sessionStore.run(session, () => mcpHandler(req));
}

export { handle as GET, handle as POST, handle as DELETE };
