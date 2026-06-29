import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { db, mcpPackages, downloadRecords } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { McpAnalyticsHeader } from '@/components/mcp/mcp-analytics-header';

interface PackageAnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default async function PackageAnalyticsPage({
  params,
}: PackageAnalyticsPageProps) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.userId) {
    redirect('/login');
  }

  const pkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
  });

  if (!pkg) {
    notFound();
  }

  // Only author can view analytics
  if (pkg.authorId !== session.userId) {
    redirect(`/mcp-market/${id}`);
  }

  // Get downloads over time
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const downloadsOverTime = await db
    .select({
      date: sql<string>`DATE(${downloadRecords.createdAt})`.as('date'),
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(downloadRecords)
    .where(
      and(
        eq(downloadRecords.entityType, 'mcp'),
        eq(downloadRecords.entityId, id),
        gte(downloadRecords.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`DATE(${downloadRecords.createdAt})`)
    .orderBy(sql`DATE(${downloadRecords.createdAt})`);

  // Calculate week-over-week change
  const lastWeek = downloadsOverTime
    .slice(-7)
    .reduce((sum, d) => sum + d.count, 0);
  const previousWeek = downloadsOverTime
    .slice(-14, -7)
    .reduce((sum, d) => sum + d.count, 0);
  const weekChange =
    previousWeek > 0
      ? Math.round(((lastWeek - previousWeek) / previousWeek) * 100)
      : lastWeek > 0
        ? 100
        : 0;

  return (
    <div className="space-y-6">
      <McpAnalyticsHeader
        packageId={id}
        packageName={pkg.name}
        downloadsCount={pkg.downloadsCount}
        weekDownloads={lastWeek}
        weekChange={weekChange}
        favoritesCount={pkg.favoritesCount}
        ratingAvg={pkg.ratingAvg}
        ratingCount={pkg.ratingCount}
      />

      <AnalyticsCharts data={downloadsOverTime} />
    </div>
  );
}
