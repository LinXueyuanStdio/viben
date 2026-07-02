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
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "category_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp DEFAULT now() NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "last_published_at" timestamp DEFAULT now() NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "unique_view_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "read_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "bookmark_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "comment_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "share_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "repost_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "subscriber_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "version_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "stats_updated_at" timestamp
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
      CREATE INDEX IF NOT EXISTS "published_pages_visibility_moderation_idx"
      ON "published_pages" USING btree ("visibility", "moderation_status")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_pages_last_published_at_idx"
      ON "published_pages" USING btree ("last_published_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "published_pages_category_id_idx"
      ON "published_pages" USING btree ("category_id")
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
      ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "category_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "published_at" timestamp DEFAULT now() NOT NULL
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
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "followers_count" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "page_categories" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "icon" jsonb,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "page_categories_slug_idx" ON "page_categories" USING btree ("slug")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "page_categories_active_sort_idx" ON "page_categories" USING btree ("is_active", "sort_order")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "media_assets" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "owner_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
        "kind" text NOT NULL,
        "source" text NOT NULL,
        "url" text NOT NULL,
        "thumbnail_url" text,
        "mime_type" text,
        "width" integer,
        "height" integer,
        "size_bytes" integer,
        "alt_text" text,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "media_assets_owner_user_id_idx" ON "media_assets" USING btree ("owner_user_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "media_assets_kind_idx" ON "media_assets" USING btree ("kind")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "entity_stats_daily" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "entity_type" text NOT NULL,
        "entity_id" text NOT NULL,
        "stat_date" timestamp NOT NULL,
        "view_count" integer DEFAULT 0 NOT NULL,
        "unique_view_count" integer DEFAULT 0 NOT NULL,
        "read_count" integer DEFAULT 0 NOT NULL,
        "like_count" integer DEFAULT 0 NOT NULL,
        "bookmark_count" integer DEFAULT 0 NOT NULL,
        "comment_count" integer DEFAULT 0 NOT NULL,
        "share_count" integer DEFAULT 0 NOT NULL,
        "repost_count" integer DEFAULT 0 NOT NULL,
        "subscriber_count" integer DEFAULT 0 NOT NULL,
        "unique_viewer_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "entity_stats_daily_entity_date_idx" ON "entity_stats_daily" USING btree ("entity_type", "entity_id", "stat_date")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "entity_stats_daily_date_idx" ON "entity_stats_daily" USING btree ("stat_date")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "community_entities" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "entity_type" text NOT NULL,
        "entity_id" text NOT NULL,
        "owner_user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
        "visibility" text DEFAULT 'public' NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "title" text,
        "canonical_path" text,
        "reactions_count" integer DEFAULT 0 NOT NULL,
        "bookmarks_count" integer DEFAULT 0 NOT NULL,
        "comments_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "community_entities_entity_idx" ON "community_entities" USING btree ("entity_type", "entity_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_entities_owner_idx" ON "community_entities" USING btree ("owner_user_id", "created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_entities_visibility_idx" ON "community_entities" USING btree ("entity_type", "status", "visibility")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "community_reactions" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "community_entity_id" text NOT NULL REFERENCES "community_entities"("id") ON DELETE CASCADE,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reaction_type" text DEFAULT 'like' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "community_reactions_unique_idx" ON "community_reactions" USING btree ("community_entity_id", "user_id", "reaction_type")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_reactions_entity_idx" ON "community_reactions" USING btree ("community_entity_id", "reaction_type")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_reactions_user_idx" ON "community_reactions" USING btree ("user_id", "created_at")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "community_bookmarks" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "community_entity_id" text NOT NULL REFERENCES "community_entities"("id") ON DELETE CASCADE,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "community_bookmarks_unique_idx" ON "community_bookmarks" USING btree ("community_entity_id", "user_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_bookmarks_user_idx" ON "community_bookmarks" USING btree ("user_id", "created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_bookmarks_entity_idx" ON "community_bookmarks" USING btree ("community_entity_id", "created_at")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "community_comments" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
        "community_entity_id" text NOT NULL REFERENCES "community_entities"("id") ON DELETE CASCADE,
        "parent_comment_id" text,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "depth" integer DEFAULT 0 NOT NULL,
        "replies_count" integer DEFAULT 0 NOT NULL,
        "reactions_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        "deleted_by_user_id" text REFERENCES "users"("id")
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_comments_entity_parent_idx" ON "community_comments" USING btree ("community_entity_id", "parent_comment_id", "created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_comments_user_idx" ON "community_comments" USING btree ("user_id", "created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "community_comments_status_idx" ON "community_comments" USING btree ("status", "created_at")`);
  })().catch((error) => {
    ensurePublishedPagesTablePromise = null;
    throw error;
  });

  return ensurePublishedPagesTablePromise;
}
