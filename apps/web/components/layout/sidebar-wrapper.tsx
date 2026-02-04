import { getSession, isAdminRole } from '@/lib/auth';
import { countPendingPackages, countOpenReports } from '@/lib/admin/stats';
import { Sidebar } from './sidebar';

/**
 * Server component wrapper for Sidebar that fetches session and admin stats.
 */
export async function SidebarWrapper() {
  const session = await getSession();

  // Only fetch admin stats if user is an admin
  let pendingPackagesCount = 0;
  let pendingReportsCount = 0;

  if (session && isAdminRole(session.role)) {
    [pendingPackagesCount, pendingReportsCount] = await Promise.all([
      countPendingPackages(),
      countOpenReports(),
    ]);
  }

  return (
    <Sidebar
      userRole={session?.role}
      pendingPackagesCount={pendingPackagesCount}
      pendingReportsCount={pendingReportsCount}
    />
  );
}
