import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex gap-8">
        <SettingsSidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
