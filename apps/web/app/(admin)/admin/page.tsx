import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';
import { getAdminStats } from '@/lib/admin/stats';

const AdminDashboardContent = dynamic(
  () => import('@/components/admin/admin-dashboard-content').then(m => ({ default: m.AdminDashboardContent })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: 'Admin Dashboard' };
export default async function Page() {
  const stats = await getAdminStats();
  return <AdminDashboardContent stats={stats} />;
}
