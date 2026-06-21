import { desc, eq } from 'drizzle-orm';
import { db, publishedPages } from '@/lib/db';

export async function getPublishedPagesForUser(userId: string) {
  return db.query.publishedPages.findMany({
    where: eq(publishedPages.userId, userId),
    orderBy: [desc(publishedPages.updatedAt)],
  });
}
