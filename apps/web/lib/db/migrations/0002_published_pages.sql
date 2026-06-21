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
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_slug" text;
--> statement-breakpoint
UPDATE "users"
SET "user_slug" = left(
  CASE
    WHEN regexp_replace("username", '[^A-Za-z0-9_-]', '_', 'g') ~ '^[A-Za-z_]'
      THEN regexp_replace("username", '[^A-Za-z0-9_-]', '_', 'g')
    ELSE '_' || regexp_replace("username", '[^A-Za-z0-9_-]', '_', 'g')
  END,
  30
)
WHERE "user_slug" IS NULL;
--> statement-breakpoint
UPDATE "users"
SET "user_slug" = left('user_' || replace("id", '-', ''), 30)
WHERE "user_slug" IS NULL
  OR "user_slug" !~ '^[A-Za-z_][A-Za-z0-9_-]{2,29}$';
--> statement-breakpoint
WITH ranked_user_slugs AS (
  SELECT
    "id",
    "user_slug",
    row_number() OVER (PARTITION BY "user_slug" ORDER BY "created_at", "id") AS slug_rank
  FROM "users"
)
UPDATE "users"
SET "user_slug" = left('user_' || replace("users"."id", '-', ''), 30)
FROM ranked_user_slugs
WHERE "users"."id" = ranked_user_slugs."id"
  AND ranked_user_slugs.slug_rank > 1;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_slug" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_user_slug_unique" ON "users" USING btree ("user_slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_user_slug_idx" ON "users" USING btree ("user_slug");
--> statement-breakpoint
ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_user_slug_format_check";
--> statement-breakpoint
ALTER TABLE "users"
  ADD CONSTRAINT "users_user_slug_format_check"
  CHECK ("user_slug" ~ '^[A-Za-z_][A-Za-z0-9_-]{2,29}$');
--> statement-breakpoint
ALTER TABLE "published_pages" DROP CONSTRAINT IF EXISTS "published_pages_uid_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "published_pages_uid_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_pages_user_id_idx" ON "published_pages" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "published_pages_user_id_uid_idx" ON "published_pages" USING btree ("user_id", "uid");
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_page_versions_page_id_idx" ON "published_page_versions" USING btree ("published_page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_page_versions_user_id_uid_idx" ON "published_page_versions" USING btree ("user_id", "uid");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "published_page_versions_user_id_uid_version_idx" ON "published_page_versions" USING btree ("user_id", "uid", "version");
