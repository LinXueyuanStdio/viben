-- ============================================
-- Full-Text Search Migration
-- Adds tsvector column, GIN index, and trigger
-- for published_pages full-text search
-- ============================================

-- 1. Add search_vector column (tsvector type)
ALTER TABLE published_pages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS published_pages_search_vector_idx
  ON published_pages USING GIN (search_vector);

-- 3. Populate search_vector for existing rows
-- Weight: title (A) > description (B) > html content (C)
UPDATE published_pages
SET search_vector =
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(html, '')), 'C')
WHERE search_vector IS NULL;

-- 4. Create trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION update_published_pages_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.html, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_update_published_pages_search_vector ON published_pages;
CREATE TRIGGER trigger_update_published_pages_search_vector
  BEFORE INSERT OR UPDATE ON published_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_published_pages_search_vector();
