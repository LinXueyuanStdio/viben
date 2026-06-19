CREATE TABLE IF NOT EXISTS "published_pages" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "uid" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "icon" jsonb,
  "description" text,
  "html" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "published_pages_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_pages_user_id_idx" ON "published_pages" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "published_pages_uid_idx" ON "published_pages" USING btree ("uid");
