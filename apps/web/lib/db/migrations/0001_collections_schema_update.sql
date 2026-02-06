-- Migration: Update collections schema for mixed-type support
-- This migration:
-- 1. Adds new fields to collections table (slug, itemCount, forksCount, forkedFromId)
-- 2. Restructures collection_items table (adds id, itemType, position, renames entityId to itemId)

-- Step 1: Add new columns to collections table
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "item_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "forks_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "forked_from_id" text;

-- Step 2: Backfill slug from name for existing collections
UPDATE "collections"
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-z0-9]+', '-', 'gi'), '^-|-$', '', 'g'))
WHERE "slug" IS NULL;

-- Step 3: Make slug NOT NULL after backfill
ALTER TABLE "collections" ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: Create new collection_items table with proper structure
-- First, backup existing data
CREATE TABLE IF NOT EXISTS "collection_items_backup" AS
SELECT * FROM "collection_items";

-- Step 5: Drop old collection_items table
DROP TABLE IF EXISTS "collection_items";

-- Step 6: Create new collection_items table with proper structure
CREATE TABLE "collection_items" (
  "id" text PRIMARY KEY NOT NULL,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "item_id" text NOT NULL,
  "item_type" text NOT NULL,
  "note" text,
  "position" integer DEFAULT 0 NOT NULL,
  "added_at" timestamp DEFAULT now() NOT NULL
);

-- Step 7: Migrate data from backup (assume entity_type from parent collection)
INSERT INTO "collection_items" ("id", "collection_id", "item_id", "item_type", "note", "position", "added_at")
SELECT
  gen_random_uuid()::text,
  b."collection_id",
  b."entity_id",
  c."entity_type",
  b."note",
  0,
  b."added_at"
FROM "collection_items_backup" b
JOIN "collections" c ON b."collection_id" = c."id";

-- Step 8: Update item_count based on actual items
UPDATE "collections" c
SET "item_count" = (
  SELECT COUNT(*)
  FROM "collection_items" ci
  WHERE ci."collection_id" = c."id"
);

-- Step 9: Drop backup table
DROP TABLE IF EXISTS "collection_items_backup";

-- Step 10: Drop old entity_type column from collections (now handled at item level)
ALTER TABLE "collections" DROP COLUMN IF EXISTS "entity_type";

-- Step 11: Create indexes
CREATE INDEX IF NOT EXISTS "collections_slug_idx" ON "collections" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "collections_owner_slug_idx" ON "collections" USING btree ("owner_id", "slug");
CREATE INDEX IF NOT EXISTS "collection_items_collection_id_idx" ON "collection_items" USING btree ("collection_id");
CREATE UNIQUE INDEX IF NOT EXISTS "collection_items_collection_item_idx" ON "collection_items" USING btree ("collection_id", "item_id");

-- Step 12: Drop old entity_type index from collections
DROP INDEX IF EXISTS "collections_entity_type_idx";
