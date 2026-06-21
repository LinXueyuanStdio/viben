import { PublishedPageList } from '@/components/published-pages/published-page-list';
import { getPublishedPagesForUser } from '@/lib/db/published-page-queries';

interface UserPublishedPagesAliasProps {
  params: Promise<{
    user_id: string;
  }>;
}

export default async function UserPublishedPagesAlias({ params }: UserPublishedPagesAliasProps) {
  const { user_id: userId } = await params;
  const pages = await getPublishedPagesForUser(userId);

  return <PublishedPageList userId={userId} pages={pages} />;
}
