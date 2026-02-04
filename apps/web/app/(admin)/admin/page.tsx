import { Package, Flag, Activity, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/admin/stats-card';
import { RecentActivityList } from '@/components/admin/recent-activity';
import { PendingQueuePreview } from '@/components/admin/pending-queue';
import { getAdminStats } from '@/lib/admin/stats';

export const metadata = {
  title: 'Admin Dashboard',
};

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and moderation queue
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Pending Packages"
          value={stats.pendingPackages}
          icon={<Package className="h-4 w-4" />}
          href="/admin/packages"
        />
        <StatsCard
          title="Open Reports"
          value={stats.openReports}
          icon={<Flag className="h-4 w-4" />}
          href="/admin/reports"
        />
        <StatsCard
          title="Today's Actions"
          value={stats.todayActions}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Recent Activity and Pending Queue */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Moderation</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivityList activities={stats.recentActivity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <PendingQueuePreview items={stats.pendingQueue} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
