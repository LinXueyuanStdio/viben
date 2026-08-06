-- Migrate notes: page_id → entity_type + entity_id
-- Run this AFTER the schema changes (entity_type + entity_id columns already added by db:push)

-- Step 1: Backfill entity_type and entity_id from existing page_id
UPDATE notes SET entity_type = 'published_page', entity_id = page_id WHERE entity_id IS NULL;

-- Step 2: Drop the old page_id column
ALTER TABLE notes DROP COLUMN page_id;

-- Step 3: Drop the old index (references page_id)
DROP INDEX IF EXISTS notes_page_author_idx;

-- Step 4: Create new index using entity_type + entity_id
CREATE INDEX IF NOT EXISTS notes_entity_author_idx ON notes(entity_type, entity_id, author_user_id, created_at DESC);
