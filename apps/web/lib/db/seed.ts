/**
 * Database seed script — idempotent demo data.
 *
 * Run: npx tsx lib/db/seed.ts   (set POSTGRES_URL first)
 */

import { db } from "./index";
import {
  users,
  publishedPages,
  moments,
  notifications,
  userBrowseHistory,
} from "./schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function seed() {
  console.log("Seeding database...");

  // =========================================================
  // 1. Demo users
  // =========================================================
  const demoUsers = [
    {
      userSlug: "demo-author",
      username: "demo-author",
      displayName: "Demo作者",
      email: "demo@viben.local",
      role: "user" as const,
    },
    {
      userSlug: "alice",
      username: "alice",
      displayName: "Alice",
      email: "alice@viben.local",
      role: "user" as const,
    },
    {
      userSlug: "bob",
      username: "bob",
      displayName: "Bob",
      email: "bob@viben.local",
      role: "user" as const,
    },
  ];

  const createdUsers: (typeof users.$inferSelect)[] = [];

  for (const du of demoUsers) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.userSlug, du.userSlug))
      .limit(1);
    if (existing) {
      console.log(`  Skipping user "${du.userSlug}" — already exists`);
      createdUsers.push(existing);
    } else {
      const now = new Date();
      const [u] = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email: du.email,
          username: du.username,
          userSlug: du.userSlug,
          displayName: du.displayName,
          passwordHash: "$2b$10$placeholder",
          role: du.role,
          emailVerified: false,
          followersCount: 0,
          pageCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      console.log(`  Created user "${du.userSlug}" (${u.id})`);
      createdUsers.push(u);
    }
  }

  const [demoAuthor, alice, bob] = createdUsers;

  // =========================================================
  // 2. Published pages
  // =========================================================
  const demoPages = [
    {
      uid: "seed-page-intro-to-viben",
      userId: demoAuthor.id,
      title: "Viben 智能体协作平台介绍",
      description: "了解 Viben 如何通过多智能体编排提升开发效率。",
      authorName: demoAuthor.displayName,
      authorAvatarUrl: null as string | null,
      visibility: "public" as const,
      moderationStatus: "approved" as const,
      viewCount: 1520,
      likeCount: 89,
      commentCount: 12,
      favoriteCount: 34,
      shareCount: 7,
      lastPublishedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      html: "<h1>Viben 介绍</h1><p>欢迎使用 Viben 智能体协作平台。在这里，你可以通过多智能体编排来提升开发效率。</p>",
    },
    {
      uid: "seed-page-markdown-guide",
      userId: demoAuthor.id,
      title: "Markdown 写作完全指南",
      description: "从基础语法到高级技巧，掌握 Markdown 写作。",
      authorName: demoAuthor.displayName,
      authorAvatarUrl: null as string | null,
      visibility: "public" as const,
      moderationStatus: "approved" as const,
      viewCount: 3400,
      likeCount: 156,
      commentCount: 28,
      favoriteCount: 67,
      shareCount: 15,
      lastPublishedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      html: "<h1>Markdown 指南</h1><p>从基础语法到高级技巧，掌握 Markdown 写作。</p>",
    },
    {
      uid: "seed-page-alice-design",
      userId: alice.id,
      title: "UI 设计系统构建实践",
      description: "从零搭建可扩展的设计系统。",
      authorName: alice.displayName,
      authorAvatarUrl: null as string | null,
      visibility: "public" as const,
      moderationStatus: "approved" as const,
      viewCount: 890,
      likeCount: 45,
      commentCount: 6,
      favoriteCount: 12,
      shareCount: 3,
      lastPublishedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      html: "<h1>设计系统</h1><p>Design tokens、组件库与工程化实践。</p>",
    },
    {
      uid: "seed-page-bob-backend",
      userId: bob.id,
      title: "高性能 API 网关设计",
      description: "百万 QPS 网关架构详解。",
      authorName: bob.displayName,
      authorAvatarUrl: null as string | null,
      visibility: "public" as const,
      moderationStatus: "approved" as const,
      viewCount: 2100,
      likeCount: 102,
      commentCount: 18,
      favoriteCount: 45,
      shareCount: 9,
      lastPublishedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      html: "<h1>API 网关</h1><p>百万 QPS 网关架构详解。</p>",
    },
  ];

  const createdPages: (typeof publishedPages.$inferSelect)[] = [];

  for (const dp of demoPages) {
    const [existing] = await db
      .select()
      .from(publishedPages)
      .where(eq(publishedPages.uid, dp.uid))
      .limit(1);
    if (existing) {
      console.log(`  Skipping page "${dp.title}" — already exists`);
      createdPages.push(existing);
    } else {
      const [p] = await db
        .insert(publishedPages)
        .values({
          id: crypto.randomUUID(),
          uid: dp.uid,
          userId: dp.userId,
          title: dp.title,
          description: dp.description,
          html: dp.html,
          visibility: dp.visibility,
          moderationStatus: dp.moderationStatus,
          viewCount: dp.viewCount,
          likeCount: dp.likeCount,
          commentCount: dp.commentCount,
          favoriteCount: dp.favoriteCount,
          shareCount: dp.shareCount,
          readCount: 0,
          uniqueViewCount: 0,
          repostCount: 0,
          subscriberCount: 0,
          versionCount: 1,
          tags: [],
          coverUrl: null,
          authorName: dp.authorName,
          authorAvatarUrl: dp.authorAvatarUrl,
          sidePageUid: null,
          chaptersJson: null,
          publishedAt: dp.lastPublishedAt,
          lastPublishedAt: dp.lastPublishedAt,
          createdAt: dp.lastPublishedAt,
          updatedAt: dp.lastPublishedAt,
        })
        .returning();
      console.log(`  Created page "${dp.title}" (${p.id})`);
      createdPages.push(p);
    }
  }

  // =========================================================
  // 3. Moments (10, spread across users and past 7 days)
  // =========================================================
  const allUsers = [demoAuthor, alice, bob];
  const momentBodies = [
    "刚发布了新文章，欢迎阅读！",
    "今天学习了新的 AI 框架，收获满满。",
    "感谢大家的支持和反馈！",
    "这个周末准备重构一下项目结构。",
    "分享一个好用的开发工具给大家。",
    "关于性能优化的一些思考...",
    "开源项目收到了第一个 PR，开心！",
    "正在研究多智能体协作模式。",
    "写了一篇关于设计系统的文章。",
    "今天调试了一个很 tricky 的 bug。",
  ];

  const createdMoments: (typeof moments.$inferSelect)[] = [];

  for (let i = 0; i < 10; i++) {
    const uid = `seed-moment-${i + 1}`;
    const [existing] = await db
      .select()
      .from(moments)
      .where(eq(moments.uid, uid))
      .limit(1);
    if (existing) {
      console.log(`  Skipping moment "${uid}" — already exists`);
      createdMoments.push(existing);
    } else {
      const author = allUsers[i % allUsers.length];
      const daysAgo = i < 7 ? i : Math.floor(Math.random() * 7);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
      const kind = i < 6 ? ("post" as const) : i < 8 ? ("repost" as const) : ("post" as const);

      const [m] = await db
        .insert(moments)
        .values({
          id: crypto.randomUUID(),
          uid,
          authorUserId: author.id,
          kind,
          body: momentBodies[i],
          bodyFormat: "plain_text",
          visibility: "public",
          likeCount: Math.floor(Math.random() * 50),
          commentCount: Math.floor(Math.random() * 10),
          repostCount: kind === "repost" ? Math.floor(Math.random() * 5) : 0,
          attachmentCount: 0,
          topicCount: 0,
          isPinned: false,
          isDeleted: false,
          viewCount: Math.floor(Math.random() * 200),
          bookmarkCount: Math.floor(Math.random() * 10),
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      console.log(`  Created moment "${uid}" (${m.kind}) by ${author.displayName}`);
      createdMoments.push(m);
    }
  }

  // =========================================================
  // 4. Notifications (8 — follow, comment, page_published)
  // =========================================================
  const notificationDefs = [
    {
      uid: "seed-notif-1",
      recipientUserId: demoAuthor.id,
      actorUserId: alice.id,
      type: "follow",
      title: "Alice 关注了你",
      body: null as string | null,
      actorName: alice.displayName,
    },
    {
      uid: "seed-notif-2",
      recipientUserId: demoAuthor.id,
      actorUserId: bob.id,
      type: "follow",
      title: "Bob 关注了你",
      body: null as string | null,
      actorName: bob.displayName,
    },
    {
      uid: "seed-notif-3",
      recipientUserId: demoAuthor.id,
      actorUserId: alice.id,
      type: "comment",
      title: "Alice 评论了你的文章",
      body: "写得太好了，学到了很多！",
      actorName: alice.displayName,
    },
    {
      uid: "seed-notif-4",
      recipientUserId: demoAuthor.id,
      actorUserId: bob.id,
      type: "page_published",
      title: "Bob 发布了新文章",
      body: "高性能 API 网关设计",
      actorName: bob.displayName,
    },
    {
      uid: "seed-notif-5",
      recipientUserId: alice.id,
      actorUserId: demoAuthor.id,
      type: "follow",
      title: "Demo作者 关注了你",
      body: null as string | null,
      actorName: demoAuthor.displayName,
    },
    {
      uid: "seed-notif-6",
      recipientUserId: alice.id,
      actorUserId: bob.id,
      type: "comment",
      title: "Bob 评论了你的文章",
      body: "设计系统讲得很清晰！",
      actorName: bob.displayName,
    },
    {
      uid: "seed-notif-7",
      recipientUserId: bob.id,
      actorUserId: alice.id,
      type: "follow",
      title: "Alice 关注了你",
      body: null as string | null,
      actorName: alice.displayName,
    },
    {
      uid: "seed-notif-8",
      recipientUserId: bob.id,
      actorUserId: demoAuthor.id,
      type: "comment",
      title: "Demo作者 评论了你的文章",
      body: "网关架构写得不错，加油！",
      actorName: demoAuthor.displayName,
    },
  ];

  for (const nd of notificationDefs) {
    const existing = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, nd.uid))
      .limit(1);
    if (existing.length > 0) {
      console.log(`  Skipping notification "${nd.uid}" — already exists`);
      continue;
    }
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      recipientUserId: nd.recipientUserId,
      actorUserId: nd.actorUserId,
      type: nd.type,
      title: nd.title,
      body: nd.body,
      readAt: null,
      actorName: nd.actorName,
      actorAvatarUrl: null,
      pageUid: null,
      pageAuthorSlug: null,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 3600 * 1000),
    });
    console.log(`  Created notification "${nd.uid}"`);
  }

  // =========================================================
  // 5. Browse history (15 entries, past 30 days)
  // =========================================================
  const pageEntities = createdPages.map((p) => ({
    entityType: "published_page",
    entityId: p.id,
    title: p.title,
    authorUserId: p.userId,
    authorName: p.authorName ?? null as string | null,
  }));

  let historyIndex = 0;
  for (const user of allUsers) {
    for (let j = 0; j < 5; j++) {
      const page = pageEntities[(historyIndex + j) % pageEntities.length];
      const daysAgo = Math.floor(Math.random() * 30);
      const lastViewed = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
      const firstViewed = new Date(lastViewed.getTime() - Math.floor(Math.random() * 7) * 24 * 3600 * 1000);

      const existing = await db
        .select()
        .from(userBrowseHistory)
        .where(eq(userBrowseHistory.userId, user.id))
        .limit(1);

      const alreadyExists = existing.some(
        (e) => e.entityType === page.entityType && e.entityId === page.entityId
      );
      if (alreadyExists) {
        console.log(`  Skipping browse history for user "${user.displayName}" page "${page.title}" — already exists`);
        continue;
      }

      await db.insert(userBrowseHistory).values({
        id: crypto.randomUUID(),
        userId: user.id,
        entityType: page.entityType,
        entityId: page.entityId,
        lastViewedAt: lastViewed,
        firstViewedAt: firstViewed,
        viewCount: Math.floor(Math.random() * 10) + 1,
        lastSource: "seed",
        lastRoute: "/read",
        snapshotTitle: page.title,
        snapshotAuthorUserId: page.authorUserId,
        snapshotAuthorName: page.authorName,
        createdAt: firstViewed,
        updatedAt: lastViewed,
      });
      console.log(`  Created browse history: ${user.displayName} → "${page.title}"`);
    }
    historyIndex += 5;
  }

  console.log("\nSeed complete!");
}

seed()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
