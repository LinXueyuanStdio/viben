import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db, publishedPages } from '@/lib/db';

export async function getPublishedPagesForUser(userId: string) {
  return db.query.publishedPages.findMany({
    where: and(
      eq(publishedPages.userId, userId),
      eq(publishedPages.visibility, 'public'),
      eq(publishedPages.moderationStatus, 'approved'),
      // Exclude scheduled pages that haven't reached their scheduled time
      or(
        isNull(publishedPages.scheduledAt),
        sql`${publishedPages.scheduledAt} <= now()`,
      ),
    ),
    orderBy: [desc(publishedPages.updatedAt)],
  });
}
