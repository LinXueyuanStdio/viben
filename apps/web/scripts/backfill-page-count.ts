/**
 * 回填用户 pageCount
 *
 * 用法:
 *   cd apps/web && pnpm tsx scripts/backfill-page-count.ts
 *
 * 只会更新 pageCount 与实际发布数不一致的用户（幂等，可重复执行）
 */

import { db, users, publishedPages } from "../lib/db";
import { eq, and, count, sql } from "drizzle-orm";

async function main() {
  console.log("回填用户 pageCount…");

  // 查询每个用户的公开已审核页面数量
  const rows = await db
    .select({
      userId: publishedPages.userId,
      cnt: count(),
    })
    .from(publishedPages)
    .where(
      and(
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved"),
      ),
    )
    .groupBy(publishedPages.userId);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, row.userId),
      columns: { id: true, pageCount: true },
    });

    if (!user) continue;

    if (user.pageCount === row.cnt) {
      skipped++;
      continue;
    }

    await db
      .update(users)
      .set({ pageCount: row.cnt })
      .where(eq(users.id, row.userId));

    updated++;
  }

  console.log(`完成: ${updated} 个用户已更新, ${skipped} 个跳过 (已一致)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
