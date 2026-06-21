import { PublishedPageList } from '@/components/published-pages/published-page-list';
import { db, users } from '@/lib/db';
import { getPublishedPagesForUser } from '@/lib/db/published-page-queries';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

interface UserPublishedPagesAliasProps {
  params: Promise<{
    user_id: string;
  }>;
}

export default async function UserPublishedPagesAlias({ params }: UserPublishedPagesAliasProps) {
  const { user_id: userId } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    notFound();
  }

  const pages = await getPublishedPagesForUser(userId);

  return <PublishedPageList userSlug={user.userSlug} pages={pages} />;
}
