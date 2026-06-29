import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { db, skillPackages, downloadRecords } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { Download, Heart, Star, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SkillAnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SkillAnalyticsPage({
  params,
}: SkillAnalyticsPageProps) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.userId) {
    redirect('/login');
  }

  const skill = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
  });

  if (!skill) {
    notFound();
  }

  // Only author can view analytics
  if (skill.authorId !== session.userId) {
    redirect(`/skill-market/${id}`);
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
        eq(downloadRecords.entityType, 'skill'),
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
          <Link href={`/skill-market/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{skill.name} Analytics</h1>
          <p className="text-muted-foreground">
            Detailed statistics for your skill
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
              {skill.downloadsCount.toLocaleString()}
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
            <div className="text-2xl font-bold">{skill.favoritesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {skill.ratingAvg > 0 ? skill.ratingAvg.toFixed(1) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {skill.ratingCount} ratings
            </p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts data={downloadsOverTime} />
    </div>
  );
}
