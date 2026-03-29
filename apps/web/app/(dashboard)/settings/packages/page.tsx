import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ProfilePackages } from '@/components/profile/profile-packages';

export default async function PackagesPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  return <ProfilePackages userId={session.userId} />;
}
