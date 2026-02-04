# T19: Analytics UI

> Implement download statistics and analytics pages.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T19 |
| Dependencies | T13 (Packages API), T4 (User API) |
| Effort | 2 points |
| Priority | P2 |

---

## Objectives

1. Create analytics dashboard for package authors
2. Display download statistics
3. Show trends over time
4. Implement package-level analytics

---

## Deliverables

### 1. Analytics Page (`apps/web/app/(dashboard)/analytics/page.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, mcpPackages, skillPackages, downloadLogs } from '@/lib/db';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { AnalyticsOverview } from '@/components/analytics/analytics-overview';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { TopPackages } from '@/components/analytics/top-packages';

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) {
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

  const packageIds = [
    ...mcps.map((p) => p.id),
    ...skills.map((p) => p.id),
  ];

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

  const downloadsOverTime = packageIds.length > 0
    ? await db
        .select({
          date: sql<string>`DATE(${downloadLogs.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(downloadLogs)
        .where(
          and(
            sql`${downloadLogs.packageId} = ANY(ARRAY[${sql.join(packageIds.map(id => sql`${id}`), sql`, `)}]::text[])`,
            gte(downloadLogs.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`DATE(${downloadLogs.createdAt})`)
        .orderBy(sql`DATE(${downloadLogs.createdAt})`)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Track your packages' performance
        </p>
      </div>

      <AnalyticsOverview
        totalPackages={mcps.length + skills.length}
        totalDownloads={totalDownloads}
        totalFavorites={totalFavorites}
      />

      <AnalyticsCharts data={downloadsOverTime} />

      <TopPackages
        mcps={mcps.sort((a, b) => b.downloadsCount - a.downloadsCount).slice(0, 5)}
        skills={skills.sort((a, b) => b.downloadsCount - a.downloadsCount).slice(0, 5)}
      />
    </div>
  );
}
```

### 2. Analytics Overview Cards (`apps/web/components/analytics/analytics-overview.tsx`)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Download, Heart, TrendingUp } from 'lucide-react';

interface AnalyticsOverviewProps {
  totalPackages: number;
  totalDownloads: number;
  totalFavorites: number;
}

export function AnalyticsOverview({
  totalPackages,
  totalDownloads,
  totalFavorites,
}: AnalyticsOverviewProps) {
  const stats = [
    {
      title: 'Total Packages',
      value: totalPackages,
      icon: Package,
      description: 'MCP servers and skills published',
    },
    {
      title: 'Total Downloads',
      value: totalDownloads.toLocaleString(),
      icon: Download,
      description: 'All-time downloads',
    },
    {
      title: 'Total Favorites',
      value: totalFavorites.toLocaleString(),
      icon: Heart,
      description: 'Users who favorited your packages',
    },
    {
      title: 'Avg per Package',
      value: totalPackages > 0
        ? Math.round(totalDownloads / totalPackages).toLocaleString()
        : '0',
      icon: TrendingUp,
      description: 'Average downloads per package',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 3. Analytics Charts (`apps/web/components/analytics/analytics-charts.tsx`)

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsChartsProps {
  data: Array<{
    date: string;
    count: number;
  }>;
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  // Fill in missing dates with 0
  const filledData = fillMissingDates(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Downloads Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No download data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filledData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => {
                  const d = new Date(date);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function fillMissingDates(
  data: Array<{ date: string; count: number }>
): Array<{ date: string; count: number }> {
  if (data.length === 0) return [];

  const result: Array<{ date: string; count: number }> = [];
  const dataMap = new Map(data.map((d) => [d.date, d.count]));

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: dataMap.get(dateStr) || 0,
    });
  }

  return result;
}
```

### 4. Top Packages (`apps/web/components/analytics/top-packages.tsx`)

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Zap, Download, Heart } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  downloadsCount: number;
  favoritesCount: number;
}

interface TopPackagesProps {
  mcps: Package[];
  skills: Package[];
}

export function TopPackages({ mcps, skills }: TopPackagesProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Top MCP Servers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mcps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No MCP servers published yet
            </p>
          ) : (
            <div className="space-y-4">
              {mcps.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      href={`/mcp/${pkg.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {pkg.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {pkg.downloadsCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {pkg.favoritesCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Top Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No skills published yet
            </p>
          ) : (
            <div className="space-y-4">
              {skills.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      href={`/skills/${pkg.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {pkg.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {pkg.downloadsCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {pkg.favoritesCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5. Package Analytics Page (`apps/web/app/(dashboard)/mcp/[id]/analytics/page.tsx`)

```tsx
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, mcpPackages, downloadLogs } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { Download, Heart, Star, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PackageAnalyticsPageProps {
  params: { id: string };
}

export default async function PackageAnalyticsPage({
  params,
}: PackageAnalyticsPageProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const pkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, params.id),
  });

  if (!pkg) {
    notFound();
  }

  // Only author can view analytics
  if (pkg.authorId !== session.userId) {
    redirect(`/mcp/${params.id}`);
  }

  // Get downloads over time
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const downloadsOverTime = await db
    .select({
      date: sql<string>`DATE(${downloadLogs.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(downloadLogs)
    .where(
      and(
        eq(downloadLogs.packageId, params.id),
        gte(downloadLogs.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`DATE(${downloadLogs.createdAt})`)
    .orderBy(sql`DATE(${downloadLogs.createdAt})`);

  // Calculate week-over-week change
  const lastWeek = downloadsOverTime.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const previousWeek = downloadsOverTime.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
  const weekChange = previousWeek > 0
    ? Math.round(((lastWeek - previousWeek) / previousWeek) * 100)
    : lastWeek > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/mcp/${params.id}`}>
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
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
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
              {weekChange >= 0 ? '+' : ''}{weekChange}% from last week
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
```

---

## Required Dependencies

```bash
pnpm add recharts
```

---

## Acceptance Criteria

- [ ] Analytics page shows overview cards
- [ ] Total packages, downloads, favorites displayed
- [ ] Downloads chart shows last 30 days
- [ ] Missing dates filled with 0
- [ ] Top packages listed with rankings
- [ ] Package-specific analytics page works
- [ ] Week-over-week change calculated
- [ ] Only package author can view analytics
- [ ] Empty state shown when no data

---

## Notes

- Uses recharts for data visualization
- Download logs tracked in separate table
- Analytics scoped to author's packages only
- 30-day rolling window for charts
- Week-over-week comparison shows trends
