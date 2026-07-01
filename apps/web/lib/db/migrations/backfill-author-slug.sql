UPDATE published_pages
SET author_slug = (
  SELECT user_slug FROM users WHERE users.id = published_pages.user_id
)
WHERE author_slug IS NULL;
