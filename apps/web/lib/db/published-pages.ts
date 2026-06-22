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
        "current_version" integer,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "current_version" integer
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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "published_page_versions" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "published_page_id" text NOT NULL REFERENCES "published_pages"("id") ON DELETE CASCADE,
        "uid" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "title" text NOT NULL,
        "icon" jsonb,
        "description" text,
        "html" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_page_versions_page_id_idx"
      ON "published_page_versions" USING btree ("published_page_id")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_page_versions_user_id_uid_idx"
      ON "published_page_versions" USING btree ("user_id", "uid")
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "published_page_versions_user_id_uid_version_idx"
      ON "published_page_versions" USING btree ("user_id", "uid", "version")
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "published_page_records" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "published_page_id" text NOT NULL REFERENCES "published_pages"("id") ON DELETE CASCADE,
        "uid" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "record_number" integer NOT NULL,
        "version" integer NOT NULL,
        "action" text NOT NULL,
        "title" text NOT NULL,
        "icon" jsonb,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_page_records_page_id_idx"
      ON "published_page_records" USING btree ("published_page_id")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_page_records_user_id_uid_idx"
      ON "published_page_records" USING btree ("user_id", "uid")
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "published_page_records_user_id_uid_record_number_idx"
      ON "published_page_records" USING btree ("user_id", "uid", "record_number")
    `);
    await db.execute(sql`
      ALTER TABLE "published_page_records"
      DROP CONSTRAINT IF EXISTS "published_page_records_action_check"
    `);
    await db.execute(sql`
      ALTER TABLE "published_page_records"
      ADD CONSTRAINT "published_page_records_action_check"
      CHECK ("action" IN ('publish', 'rollback'))
    `);
  })().catch((error) => {
    ensurePublishedPagesTablePromise = null;
    throw error;
  });

  return ensurePublishedPagesTablePromise;
}
