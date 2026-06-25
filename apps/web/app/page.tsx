import { CommunityHome } from './components/community/community-home';
import { getSession } from '@/lib/auth/cookies';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();

  return <CommunityHome session={session} />;
}
