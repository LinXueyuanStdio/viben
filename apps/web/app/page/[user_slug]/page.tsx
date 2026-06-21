import { PublishedPageList } from '@/components/published-pages/published-page-list';
import { getPublishedPagesForUser } from '@/lib/db/published-page-queries';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

interface UserPublishedPagesProps {
  params: Promise<{
    user_slug: string;
  }>;
}

export default async function UserPublishedPages({ params }: UserPublishedPagesProps) {
  const { user_slug: userSlug } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, userSlug),
  });

  if (!user) {
    notFound();
  }

  const pages = await getPublishedPagesForUser(user.id);

  return <PublishedPageList userSlug={userSlug} pages={pages} />;
}
