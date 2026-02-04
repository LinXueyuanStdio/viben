import { redirect } from 'next/navigation';
import { getSession, isAdminRole } from '@/lib/auth';
import { SidebarWrapper } from '@/components/layout/sidebar-wrapper';
import { Header } from '@/components/layout/header';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Verify admin access
  if (!session || !isAdminRole(session.role)) {
    redirect('/');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarWrapper />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
