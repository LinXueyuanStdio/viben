import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';
import { getAdminStats } from '@/lib/admin/stats';
import type { AdminStats } from '@/lib/admin/stats';

const AdminDashboardContent = dynamic(
  () => import('@/components/admin/admin-dashboard-content').then(m => ({ default: m.AdminDashboardContent })),
  { loading: () => <AdminPageSkeleton /> }
);

const FALLBACK_STATS: AdminStats = {
  pendingPackages: 0,
  openReports: 0,
  todayActions: 0,
  totalUsers: 0,
  totalPublishedPages: 0,
  totalMoments: 0,
  totalPackages: 0,
  newUsersToday: 0,
  newUsersThisWeek: 0,
  totalDownloads: 0,
  totalComments: 0,
  recentActivity: [],
  pendingQueue: [],
};

export const metadata = { title: 'Admin Dashboard' };
export default async function Page() {
  let stats: AdminStats;
  try {
    stats = await getAdminStats();
  } catch (error) {
    console.error('Failed to load admin stats:', error);
    stats = FALLBACK_STATS;
  }
  return <AdminDashboardContent stats={stats} />;
}
