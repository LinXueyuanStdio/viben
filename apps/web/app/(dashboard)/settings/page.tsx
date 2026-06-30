import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProfileSettingsForm } from '@/components/profile/profile-settings-form';
import { ProfileSettingsHeader } from '@/components/profile/profile-settings-header';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
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

      <ProfileSettingsForm
        user={{
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          email: user.email,
          avatarUrl: user.avatarUrl,
          websiteUrl: user.websiteUrl,
          createdAt: user.createdAt,
        }}
      />
    </div>
  );
}
