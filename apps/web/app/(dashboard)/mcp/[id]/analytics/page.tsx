import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db, mcpPackages, downloadRecords } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { Download, Heart, Star, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    redirect(`/mcp/${id}`);
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/mcp/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{pkg.name} Analytics</h1>
          <p className="text-muted-foreground">
            Detailed statistics for your package
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Downloads
            </CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pkg.downloadsCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastWeek}</div>
            <p className="text-xs text-muted-foreground">
              {weekChange >= 0 ? '+' : ''}
              {weekChange}% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorites</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pkg.favoritesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pkg.ratingAvg > 0 ? pkg.ratingAvg.toFixed(1) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {pkg.ratingCount} ratings
            </p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts data={downloadsOverTime} />
    </div>
  );
}
