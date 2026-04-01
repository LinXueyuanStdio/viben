import { getSession, isAdminRole } from '@/lib/auth';
import { countPendingPackages } from '@/lib/admin/stats';
import { Sidebar } from './sidebar';

/**
 * Server component wrapper for Sidebar that fetches session and admin stats.
 */
export async function SidebarWrapper() {
  const session = await getSession();

  // Only fetch admin stats if user is an admin
  let pendingPackagesCount = 0;

  if (session && isAdminRole(session.role)) {
    pendingPackagesCount = await countPendingPackages();
  }

  return (
    <Sidebar
      userRole={session?.role}
      username={session?.username}
      email={session?.email}
      avatarUrl={session?.avatarUrl}
      pendingPackagesCount={pendingPackagesCount}
    />
  );
}
