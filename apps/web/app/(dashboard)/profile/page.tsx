import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTabs } from '@/components/profile/profile-tabs';

export default async function ProfilePage() {
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
    <div className="container max-w-6xl py-8">
      <ProfileHeader user={user} />
      <div className="mt-8">
        <ProfileTabs userId={user.id} />
      </div>
    </div>
  );
}
