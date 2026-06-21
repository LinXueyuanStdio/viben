import { sql } from 'drizzle-orm';
import { db } from './index';

let ensurePublishedPagesTablePromise: Promise<void> | null = null;

export function ensurePublishedPagesTable(): Promise<void> {
  ensurePublishedPagesTablePromise ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "published_pages" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "uid" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "icon" jsonb,
        "description" text,
        "html" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages"
      DROP CONSTRAINT IF EXISTS "published_pages_uid_unique"
    `);
    await db.execute(sql`
      DROP INDEX IF EXISTS "published_pages_uid_idx"
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_pages_user_id_idx"
      ON "published_pages" USING btree ("user_id")
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "published_pages_user_id_uid_idx"
      ON "published_pages" USING btree ("user_id", "uid")
    `);
  })().catch((error) => {
    ensurePublishedPagesTablePromise = null;
    throw error;
  });

  return ensurePublishedPagesTablePromise;
}
