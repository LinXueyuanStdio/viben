import { PublishedPageList } from '@/components/published-pages/published-page-list';
import { getPublishedPagesForUser } from '@/lib/db/published-page-queries';

interface UserPublishedPagesProps {
  params: Promise<{
    user_id: string;
  }>;
}

export default async function UserPublishedPages({ params }: UserPublishedPagesProps) {
  const { user_id: userId } = await params;
  const pages = await getPublishedPagesForUser(userId);

  return <PublishedPageList userId={userId} pages={pages} />;
}
