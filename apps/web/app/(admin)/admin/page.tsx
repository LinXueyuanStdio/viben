import { AdminDashboardContent } from '@/components/admin/admin-dashboard-content';
import { getAdminStats } from '@/lib/admin/stats';

export const metadata = {
  title: 'Admin Dashboard',
};

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return <AdminDashboardContent stats={stats} />;
}
