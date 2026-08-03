import { createMcpHandler, withMcpAuth, protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { z } from "zod";
import { AsyncLocalStorage } from "async_hooks";
import { and, eq, desc, asc, sql } from "drizzle-orm";
import { db, publishedPages, publishedPageVersions, publishedPageRecords, users } from "@/lib/db";
import { ensurePublishedPagesTable } from "@/lib/db/published-pages";
import { validateApiKey } from "@/lib/auth/api-key";
import { decryptSession } from "@/lib/auth/jwe";
import { verifyAccessToken } from "@/lib/auth/oauth";
import { recordPageUpdateAndNotify } from "@/lib/services/community";
import type { Session } from "@/lib/auth/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const sessionStore = new AsyncLocalStorage<Session | null>();

function requireSession(): Session {
  const session = sessionStore.getStore();
  if (!session) {
    throw new Error(
      "Authentication required. Provide an API key via Authorization: Bearer bmcp_xxx header, " +
        `or sign in via OAuth. Create an API key at ${APP_URL}/settings/api_keys`,
    );
  }
  return session;
}

// ── Token verification for withMcpAuth ──────────────────
async function verifyToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;

  // API Key (bmcp_ prefix)
  if (bearerToken.startsWith("bmcp_")) {
    const user = await validateApiKey(bearerToken);
    if (!user) return undefined;
    return { token: bearerToken, userId: user.id, clientId: "api-key", scopes: ["read", "write"] };
  }

  // OAuth access token
  const oauth = await verifyAccessToken(bearerToken);
  if (oauth) {
    return { token: bearerToken, userId: oauth.userId, clientId: "oauth", scopes: oauth.scopes.split(" ") };
  }

  // JWE session token
  const session = await decryptSession(bearerToken);
  if (session) {
    return { token: bearerToken, userId: session.userId, clientId: "jwe", scopes: ["read", "write"] };
  }

  return undefined;
}

// ── Resolve Session from AuthInfo + API Key details ─────
async function resolveSession(req: Request): Promise<Session | null> {
  const auth = (req as any).auth;
  if (!auth?.userId) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { id: true, username: true, userSlug: true, email: true, role: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    username: user.username,
    userSlug: user.userSlug,
    email: user.email ?? "",
    role: user.role as Session["role"],
    expiresAt: 0,
  };
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.tool(
      "search_pages",
      "搜索 viben 上已发布的公开页面。匹配标题、页面唯一标识符和描述内容。适合内容发现和文献检索。",
      {
        query: z.string().min(1).describe("搜索关键词"),
        author_slug: z.string().optional().describe("按作者 slug 过滤"),
        tags: z.array(z.string()).max(12).optional().describe("按标签过滤，所有标签必须同时匹配（AND 逻辑）"),
        sort_by: z.enum(["published_at", "title"]).optional().describe("排序字段，默认 published_at"),
        sort_order: z.enum(["desc", "asc"]).optional().describe("排序方向，默认 desc"),
        limit: z.number().int().min(1).max(50).optional().describe("返回数量，默认 20"),
        offset: z.number().int().min(0).optional().describe("分页偏移，默认 0"),
      },
      async ({ query, author_slug, tags, sort_by, sort_order, limit = 20, offset = 0 }) => {
        const conditions: ReturnType<typeof sql>[] = [
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
          sql`(${publishedPages.title} ILIKE ${`%${query}%`} OR ${publishedPages.uid} ILIKE ${`%${query}%`} OR COALESCE(${publishedPages.description}, '') ILIKE ${`%${query}%`})`,
        ];
        if (author_slug) conditions.push(eq(publishedPages.authorSlug, author_slug));
        if (tags && tags.length > 0) {
          conditions.push(sql`${publishedPages.tags} @> ARRAY[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]`);
        }

        const orderColumn = sort_by === "title" ? publishedPages.title : publishedPages.lastPublishedAt;
        const orderFn = sort_order === "asc" ? asc : desc;

        const pages = await db
          .select({
            uid: publishedPages.uid, title: publishedPages.title,
            author_slug: publishedPages.authorSlug, description: publishedPages.description,
            tags: publishedPages.tags, published_at: publishedPages.publishedAt,
          })
          .from(publishedPages)
          .where(and(...conditions))
          .orderBy(orderFn(orderColumn))
          .limit(limit)
          .offset(offset);

        return { content: [{ type: "text" as const, text: JSON.stringify({ pages }) }] };
      },
    );

    server.tool(
      "get_page",
      "获取指定页面的完整内容，包括 HTML 源码、元数据和作者信息。适合深度阅读和内容分析。",
      {
        author_slug: z.string().min(1).describe("页面作者的 slug"),
        page_uid: z.string().min(1).describe("页面唯一标识符"),
      },
      async ({ author_slug, page_uid }) => {
        const page = await db.query.publishedPages.findFirst({
          where: and(eq(publishedPages.authorSlug, author_slug), eq(publishedPages.uid, page_uid)),
        });
        if (!page) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Page not found" }) }], isError: true };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              uid: page.uid, title: page.title, html: page.html,
              description: page.description, tags: page.tags, visibility: page.visibility,
              cover_url: page.coverUrl, published_at: page.publishedAt, version: page.currentVersion,
              author: { display_name: page.authorDisplayName, avatar_url: page.authorAvatarUrl, slug: page.authorSlug },
            }),
          }],
        };
      },
    );

    server.tool(
      "create_page",
      "发布新页面到 viben。如果同一作者下的 uid 已存在则自动更新为最新内容（upsert 语义）。需要 API Key 认证。",
      {
        uid: z.string().min(1).max(200).describe("页面唯一标识符"),
        title: z.string().min(1).max(500).describe("页面标题"),
        html: z.string().min(1).describe("页面 HTML 内容"),
        description: z.string().max(2000).optional().describe("页面描述"),
        tags: z.array(z.string()).max(12).optional().describe("标签列表"),
        visibility: z.enum(["public", "unlisted", "private"]).optional().describe("可见性，默认 public"),
        cover_url: z.string().optional().describe("封面图片 URL"),
      },
      async ({ uid, title, html, description, tags, visibility = "public", cover_url }) => {
        const session = requireSession();
        await ensurePublishedPagesTable();

        const author = await db.query.users.findFirst({
          where: eq(users.id, session.userId),
          columns: { displayName: true, avatarUrl: true },
        });
        const authorDisplayName = author?.displayName ?? session.username;
        const authorAvatarUrl = author?.avatarUrl ?? session.avatarUrl ?? null;

        const latestVersion = await db.query.publishedPageVersions.findFirst({
          where: and(eq(publishedPageVersions.userId, session.userId), eq(publishedPageVersions.uid, uid)),
          orderBy: [desc(publishedPageVersions.version)],
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;
        const eventType = latestVersion ? "updated" : "published";

        const normalizedCoverUrl = cover_url?.trim() || null;
        const normalizedTags = tags?.slice(0, 12) ?? [];

        await db
          .insert(publishedPages)
          .values({
            uid, userId: session.userId, title, icon: null,
            description: description ?? null, html, currentVersion: nextVersion,
            coverUrl: normalizedCoverUrl, tags: normalizedTags, visibility,
            moderationStatus: "approved", authorSlug: session.userSlug,
            authorDisplayName, authorAvatarUrl,
            publishedAt: sql`now()`, lastPublishedAt: sql`now()`, versionCount: nextVersion,
          })
          .onConflictDoUpdate({
            target: [publishedPages.userId, publishedPages.uid],
            set: {
              title, description: description ?? null, html, currentVersion: nextVersion,
              coverUrl: normalizedCoverUrl, tags: normalizedTags, visibility,
              authorSlug: session.userSlug, authorDisplayName, authorAvatarUrl,
              lastPublishedAt: sql`now()`, versionCount: nextVersion, updatedAt: sql`now()`,
            },
          });

        const updatedPage = await db.query.publishedPages.findFirst({
          where: and(eq(publishedPages.userId, session.userId), eq(publishedPages.uid, uid)),
        });
        if (!updatedPage) throw new Error("Page not found after upsert");

        await db.insert(publishedPageVersions).values({
          publishedPageId: updatedPage.id, uid, userId: session.userId,
          version: nextVersion, title, icon: null, description: description ?? null,
          html, coverUrl: normalizedCoverUrl, tags: normalizedTags,
          visibility, moderationStatus: "approved", publishedAt: new Date(),
        });

        const latestRecord = await db.query.publishedPageRecords.findFirst({
          where: and(eq(publishedPageRecords.userId, session.userId), eq(publishedPageRecords.uid, uid)),
          orderBy: [desc(publishedPageRecords.recordNumber)],
        });
        await db.insert(publishedPageRecords).values({
          publishedPageId: updatedPage.id, uid, userId: session.userId,
          recordNumber: (latestRecord?.recordNumber ?? 0) + 1, version: nextVersion,
          action: "publish", title, icon: null, description: description ?? null,
        });

        await recordPageUpdateAndNotify(db, {
          publishedPageId: updatedPage.id, userId: session.userId,
          userSlug: session.userSlug, pageId: uid, version: nextVersion,
          eventType, importance: "normal", title, description: description ?? null, visibility,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true, page_uid: uid,
              url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
              read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
              updated: eventType === "updated",
            }),
          }],
        };
      },
    );

    server.tool(
      "update_page",
      "更新已有页面的内容或元数据。仅更新指定字段，未指定字段保持不变。需要 API Key 认证，仅页面作者可操作。",
      {
        uid: z.string().min(1).describe("页面唯一标识符"),
        title: z.string().min(1).max(500).optional().describe("新标题"),
        html: z.string().min(1).optional().describe("新 HTML 内容"),
        description: z.string().max(2000).optional().describe("新描述"),
        tags: z.array(z.string()).max(12).optional().describe("新标签列表"),
        visibility: z.enum(["public", "unlisted", "private"]).optional().describe("新可见性设置"),
        cover_url: z.string().optional().describe("新封面图片 URL"),
      },
      async ({ uid, title, html, description, tags, visibility, cover_url }) => {
        const session = requireSession();
        await ensurePublishedPagesTable();

        const existing = await db.query.publishedPages.findFirst({
          where: and(eq(publishedPages.userId, session.userId), eq(publishedPages.uid, uid)),
        });
        if (!existing) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Page not found or you do not have permission to update it" }) }],
            isError: true,
          };
        }

        const latestVersion = await db.query.publishedPageVersions.findFirst({
          where: and(eq(publishedPageVersions.userId, session.userId), eq(publishedPageVersions.uid, uid)),
          orderBy: [desc(publishedPageVersions.version)],
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;

        const updatedTitle = title ?? existing.title;
        const updatedHtml = html ?? existing.html;
        const updatedDescription = description !== undefined ? description : existing.description;
        const updatedTags = tags ?? existing.tags;
        const updatedVisibility = visibility ?? existing.visibility;
        const updatedCoverUrl = cover_url !== undefined ? (cover_url.trim() || null) : existing.coverUrl;

        await db
          .update(publishedPages)
          .set({
            title: updatedTitle, html: updatedHtml, description: updatedDescription,
            tags: updatedTags, visibility: updatedVisibility, coverUrl: updatedCoverUrl,
            currentVersion: nextVersion, lastPublishedAt: sql`now()`,
            versionCount: nextVersion, updatedAt: sql`now()`,
          })
          .where(and(eq(publishedPages.userId, session.userId), eq(publishedPages.uid, uid)));

        await db.insert(publishedPageVersions).values({
          publishedPageId: existing.id, uid, userId: session.userId,
          version: nextVersion, title: updatedTitle, icon: null,
          description: updatedDescription, html: updatedHtml,
          coverUrl: updatedCoverUrl, tags: updatedTags,
          visibility: updatedVisibility, moderationStatus: "approved", publishedAt: new Date(),
        });

        await recordPageUpdateAndNotify(db, {
          publishedPageId: existing.id, userId: session.userId,
          userSlug: session.userSlug, pageId: uid, version: nextVersion,
          eventType: "updated", importance: "normal",
          title: updatedTitle, description: updatedDescription ?? null, visibility: updatedVisibility,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true, page_uid: uid,
              url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
              read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
              updated: true,
            }),
          }],
        };
      },
    );
  },
  {
    serverInfo: { name: "viben", version: "1.0.0" },
  },
  { streamableHttpEndpoint: "/api/mcp/v1" },
);

// ── Route handler: OAuth metadata → MCP ────────────────
const corsOptions = metadataCorsOptionsRequestHandler()();
const resourceMetadata = protectedResourceHandler({
  authServerUrls: [APP_URL],
});

// Wrap with OAuth 2.1 Bearer token verification
const protectedHandler = withMcpAuth(
  async (req: Request) => {
    const session = await resolveSession(req);
    return sessionStore.run(session, () => mcpHandler(req));
  },
  verifyToken,
  { required: false, resourceUrl: APP_URL },
);

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // RFC 9728 Protected Resource Metadata
  if (url.pathname === `${new URL(APP_URL).pathname}/api/mcp/v1/.well-known/oauth-protected-resource`) {
    return resourceMetadata(req);
  }

  // CORS preflight for metadata
  if (req.method === "OPTIONS" && url.pathname.includes("/.well-known/")) {
    return corsOptions;
  }

  return protectedHandler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
