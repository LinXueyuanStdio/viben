import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db, mcpPackages, skillPackages, downloadRecords } from '@/lib/db';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import { AnalyticsPageHeader } from '@/components/analytics/analytics-page-header';
import { AnalyticsOverview } from '@/components/analytics/analytics-overview';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { TopPackages } from '@/components/analytics/top-packages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Analytics',
};

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect('/login');
  }

  // Get user's packages
  const [mcps, skills] = await Promise.all([
    db.query.mcpPackages.findMany({
      where: eq(mcpPackages.authorId, session.userId),
      columns: {
        id: true,
        name: true,
        downloadsCount: true,
        favoritesCount: true,
      },
    }),
    db.query.skillPackages.findMany({
      where: eq(skillPackages.authorId, session.userId),
      columns: {
        id: true,
        name: true,
        downloadsCount: true,
        favoritesCount: true,
      },
    }),
  ]);

  // Collect all package IDs (both MCP and Skill)
  const mcpIds = mcps.map((p) => p.id);
  const skillIds = skills.map((p) => p.id);

  // Calculate totals
  const totalDownloads =
    mcps.reduce((sum, p) => sum + p.downloadsCount, 0) +
    skills.reduce((sum, p) => sum + p.downloadsCount, 0);

  const totalFavorites =
    mcps.reduce((sum, p) => sum + p.favoritesCount, 0) +
    skills.reduce((sum, p) => sum + p.favoritesCount, 0);

  // Get downloads over time (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Query downloads for MCP packages
  let mcpDownloads: Array<{ date: string; count: number }> = [];
  if (mcpIds.length > 0) {
    mcpDownloads = await db
      .select({
        date: sql<string>`DATE(${downloadRecords.createdAt})`.as('date'),
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(downloadRecords)
      .where(
        and(
          eq(downloadRecords.entityType, 'mcp'),
          inArray(downloadRecords.entityId, mcpIds),
          gte(downloadRecords.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`DATE(${downloadRecords.createdAt})`)
      .orderBy(sql`DATE(${downloadRecords.createdAt})`);
  }

  // Query downloads for Skill packages
  let skillDownloads: Array<{ date: string; count: number }> = [];
  if (skillIds.length > 0) {
    skillDownloads = await db
      .select({
        date: sql<string>`DATE(${downloadRecords.createdAt})`.as('date'),
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(downloadRecords)
      .where(
        and(
          eq(downloadRecords.entityType, 'skill'),
          inArray(downloadRecords.entityId, skillIds),
          gte(downloadRecords.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`DATE(${downloadRecords.createdAt})`)
      .orderBy(sql`DATE(${downloadRecords.createdAt})`);
  }

  // Merge downloads from both package types by date
  const downloadsMap = new Map<string, number>();
  for (const d of mcpDownloads) {
    downloadsMap.set(d.date, (downloadsMap.get(d.date) || 0) + d.count);
  }
  for (const d of skillDownloads) {
    downloadsMap.set(d.date, (downloadsMap.get(d.date) || 0) + d.count);
  }

  const downloadsOverTime = Array.from(downloadsMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <AnalyticsPageHeader />

      <AnalyticsOverview
        totalPackages={mcps.length + skills.length}
        totalDownloads={totalDownloads}
        totalFavorites={totalFavorites}
      />

      <AnalyticsCharts data={downloadsOverTime} />

      <TopPackages
        mcps={mcps
          .sort((a, b) => b.downloadsCount - a.downloadsCount)
          .slice(0, 5)}
        skills={skills
          .sort((a, b) => b.downloadsCount - a.downloadsCount)
          .slice(0, 5)}
      />
    </div>
  );
}
