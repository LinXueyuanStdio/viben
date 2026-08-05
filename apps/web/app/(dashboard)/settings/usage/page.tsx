import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db, mcpPackages, skillPackages, downloadRecords } from "@/lib/db";
import { eq, and, gte, sql, inArray } from "drizzle-orm";
import { UsagePageContent } from "./usage-page-content";

export const dynamic = "force-dynamic";

async function fetchAnalyticsData(userId: string) {
  const [mcps, skills] = await Promise.all([
    db.query.mcpPackages.findMany({
      where: eq(mcpPackages.authorId, userId),
      columns: { id: true, name: true, downloadsCount: true, bookmarksCount: true },
    }),
    db.query.skillPackages.findMany({
      where: eq(skillPackages.authorId, userId),
      columns: { id: true, name: true, downloadsCount: true, bookmarksCount: true },
    }),
  ]);

  const mcpIds = mcps.map((p) => p.id);
  const skillIds = skills.map((p) => p.id);

  const totalDownloads =
    mcps.reduce((sum, p) => sum + p.downloadsCount, 0) +
    skills.reduce((sum, p) => sum + p.downloadsCount, 0);

  const totalFavorites =
    mcps.reduce((sum, p) => sum + p.bookmarksCount, 0) +
    skills.reduce((sum, p) => sum + p.bookmarksCount, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let mcpDownloads: Array<{ date: string; count: number }> = [];
  if (mcpIds.length > 0) {
    mcpDownloads = await db
      .select({
        date: sql<string>`DATE(${downloadRecords.createdAt})`.as("date"),
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(downloadRecords)
      .where(
        and(
          eq(downloadRecords.entityType, "mcp"),
          inArray(downloadRecords.entityId, mcpIds),
          gte(downloadRecords.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`DATE(${downloadRecords.createdAt})`)
      .orderBy(sql`DATE(${downloadRecords.createdAt})`);
  }

  let skillDownloads: Array<{ date: string; count: number }> = [];
  if (skillIds.length > 0) {
    skillDownloads = await db
      .select({
        date: sql<string>`DATE(${downloadRecords.createdAt})`.as("date"),
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(downloadRecords)
      .where(
        and(
          eq(downloadRecords.entityType, "skill"),
          inArray(downloadRecords.entityId, skillIds),
          gte(downloadRecords.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`DATE(${downloadRecords.createdAt})`)
      .orderBy(sql`DATE(${downloadRecords.createdAt})`);
  }

  const downloadsMap = new Map<string, number>();
  for (const d of mcpDownloads) downloadsMap.set(d.date, (downloadsMap.get(d.date) ?? 0) + d.count);
  for (const d of skillDownloads) downloadsMap.set(d.date, (downloadsMap.get(d.date) ?? 0) + d.count);

  const downloadsOverTime = Array.from(downloadsMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalPackages: mcps.length + skills.length,
    totalDownloads,
    totalFavorites,
    downloadsOverTime,
    topMcps: mcps.sort((a, b) => b.downloadsCount - a.downloadsCount).slice(0, 5),
    topSkills: skills.sort((a, b) => b.downloadsCount - a.downloadsCount).slice(0, 5),
  };
}

export default async function UsagePage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }

  const analyticsData = await fetchAnalyticsData(session.userId);

  return <UsagePageContent analyticsData={analyticsData} />;
}
