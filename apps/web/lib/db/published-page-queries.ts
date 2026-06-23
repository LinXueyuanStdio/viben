import { and, desc, eq } from 'drizzle-orm';
import { db, publishedPages } from '@/lib/db';

export async function getPublishedPagesForUser(userId: string) {
  return db.query.publishedPages.findMany({
    where: and(
      eq(publishedPages.userId, userId),
      eq(publishedPages.visibility, 'public'),
      eq(publishedPages.moderationStatus, 'approved')
    ),
    orderBy: [desc(publishedPages.updatedAt)],
  });
}
