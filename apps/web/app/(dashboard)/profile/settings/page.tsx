import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProfileSettingsForm } from '@/components/profile/profile-settings-form';
import { ProfileSettingsHeader } from '@/components/profile/profile-settings-header';

export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="container max-w-2xl py-8">
      <ProfileSettingsHeader />

      <div className="mt-6 rounded-lg border p-6">
        <ProfileSettingsForm user={user} />
      </div>
    </div>
  );
}
