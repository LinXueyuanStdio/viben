ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "followers_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "category_id" text;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "cover_asset_id" text;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "last_published_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "unique_view_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "read_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "favorite_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "comment_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "share_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "repost_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "subscriber_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "version_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_pages" ADD COLUMN IF NOT EXISTS "stats_updated_at" timestamp;
--> statement-breakpoint
UPDATE "published_pages"
SET "published_at" = "created_at"
WHERE "published_at" IS NULL;
--> statement-breakpoint
UPDATE "published_pages"
SET "last_published_at" = "updated_at"
WHERE "last_published_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_pages_visibility_moderation_idx" ON "published_pages" USING btree ("visibility", "moderation_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_pages_last_published_at_idx" ON "published_pages" USING btree ("last_published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_pages_category_id_idx" ON "published_pages" USING btree ("category_id");
--> statement-breakpoint
ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "category_id" text;
--> statement-breakpoint
ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "cover_asset_id" text;
--> statement-breakpoint
ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_page_versions" ADD COLUMN IF NOT EXISTS "published_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_categories_slug_idx" ON "page_categories" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_categories_active_sort_idx" ON "page_categories" USING btree ("is_active", "sort_order");
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_owner_user_id_idx" ON "media_assets" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_kind_idx" ON "media_assets" USING btree ("kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_stats_daily" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "stat_date" timestamp NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "unique_view_count" integer DEFAULT 0 NOT NULL,
  "read_count" integer DEFAULT 0 NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "favorite_count" integer DEFAULT 0 NOT NULL,
  "comment_count" integer DEFAULT 0 NOT NULL,
  "share_count" integer DEFAULT 0 NOT NULL,
  "repost_count" integer DEFAULT 0 NOT NULL,
  "subscriber_count" integer DEFAULT 0 NOT NULL,
  "unique_viewer_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_stats_daily_entity_date_idx" ON "entity_stats_daily" USING btree ("entity_type", "entity_id", "stat_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_stats_daily_date_idx" ON "entity_stats_daily" USING btree ("stat_date");
--> statement-breakpoint
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
  "favorites_count" integer DEFAULT 0 NOT NULL,
  "comments_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_entities_entity_idx" ON "community_entities" USING btree ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_entities_owner_idx" ON "community_entities" USING btree ("owner_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_entities_visibility_idx" ON "community_entities" USING btree ("entity_type", "status", "visibility");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_reactions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "community_entity_id" text NOT NULL REFERENCES "community_entities"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reaction_type" text DEFAULT 'like' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_reactions_unique_idx" ON "community_reactions" USING btree ("community_entity_id", "user_id", "reaction_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_favorites" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "community_entity_id" text NOT NULL REFERENCES "community_entities"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_favorites_unique_idx" ON "community_favorites" USING btree ("community_entity_id", "user_id");
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_comments_entity_parent_idx" ON "community_comments" USING btree ("community_entity_id", "parent_comment_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "view_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "anonymous_viewer_hash" text,
  "session_id_hash" text,
  "source" text NOT NULL,
  "route" text NOT NULL,
  "referrer_type" text DEFAULT 'unknown' NOT NULL,
  "referrer_url_hash" text,
  "share_link_id" text,
  "repost_id" text,
  "user_agent_hash" text,
  "ip_hash" text,
  "country_code" text,
  "region_code" text,
  "duration_ms" integer,
  "scroll_depth" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "view_events_entity_created_idx" ON "view_events" USING btree ("entity_type", "entity_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_browse_history" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "last_view_event_id" text REFERENCES "view_events"("id") ON DELETE SET NULL,
  "last_viewed_at" timestamp DEFAULT now() NOT NULL,
  "first_viewed_at" timestamp DEFAULT now() NOT NULL,
  "view_count" integer DEFAULT 1 NOT NULL,
  "last_source" text,
  "last_route" text,
  "last_progress" jsonb,
  "snapshot_title" text,
  "snapshot_author_user_id" text,
  "snapshot_cover_asset_id" text,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_browse_history_unique_idx" ON "user_browse_history" USING btree ("user_id", "entity_type", "entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "share_links" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "uid" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "created_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "visibility_snapshot" text NOT NULL,
  "channel" text DEFAULT 'copy_link' NOT NULL,
  "target_url" text NOT NULL,
  "html_direct_url" text,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "open_count" integer DEFAULT 0 NOT NULL,
  "unique_open_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "share_links_uid_idx" ON "share_links" USING btree ("uid");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "share_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "share_link_id" text REFERENCES "share_links"("id") ON DELETE SET NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "anonymous_actor_hash" text,
  "event_type" text NOT NULL,
  "channel" text DEFAULT 'copy_link' NOT NULL,
  "target" text,
  "source_route" text,
  "viewer_hash" text,
  "ip_hash" text,
  "user_agent_hash" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reposts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "moment_id" text,
  "comment" text,
  "visibility" text DEFAULT 'public' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "failure_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moments" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "uid" text NOT NULL,
  "author_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text DEFAULT 'post' NOT NULL,
  "body" text,
  "body_format" text DEFAULT 'plain_text' NOT NULL,
  "visibility" text DEFAULT 'public' NOT NULL,
  "source_event_id" text,
  "source_page_update_event_id" text,
  "repost_of_moment_id" text,
  "reply_to_moment_id" text,
  "like_count" integer DEFAULT 0 NOT NULL,
  "comment_count" integer DEFAULT 0 NOT NULL,
  "repost_count" integer DEFAULT 0 NOT NULL,
  "attachment_count" integer DEFAULT 0 NOT NULL,
  "topic_count" integer DEFAULT 0 NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moments_uid_idx" ON "moments" USING btree ("uid");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moments_page_update_event_unique_idx" ON "moments" USING btree ("author_user_id", "source_page_update_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moments_feed_idx" ON "moments" USING btree ("visibility", "is_deleted", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moment_attachments" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "moment_id" text NOT NULL REFERENCES "moments"("id") ON DELETE CASCADE,
  "attachment_type" text NOT NULL,
  "attachment_id" text NOT NULL,
  "attachment_uid" text,
  "title_snapshot" text NOT NULL,
  "description_snapshot" text,
  "cover_url_snapshot" text,
  "metadata" jsonb,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moment_topics" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "description" text,
  "moment_count" integer DEFAULT 0 NOT NULL,
  "last_moment_at" timestamp,
  "is_featured" boolean DEFAULT false NOT NULL,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moment_topics_slug_idx" ON "moment_topics" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moment_topic_items" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "moment_id" text NOT NULL REFERENCES "moments"("id") ON DELETE CASCADE,
  "topic_id" text NOT NULL REFERENCES "moment_topics"("id") ON DELETE CASCADE,
  "source" text DEFAULT 'body' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "moment_topic_items_unique_idx" ON "moment_topic_items" USING btree ("moment_id", "topic_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "target_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_follows" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "follower_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "followee_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "notify_level" text DEFAULT 'all' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_follows_unique_idx" ON "user_follows" USING btree ("follower_user_id", "followee_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_subscriptions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "published_page_id" text NOT NULL REFERENCES "published_pages"("id") ON DELETE CASCADE,
  "notify_level" text DEFAULT 'all' NOT NULL,
  "last_seen_version" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_subscriptions_unique_idx" ON "page_subscriptions" USING btree ("user_id", "published_page_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_update_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "published_page_id" text NOT NULL REFERENCES "published_pages"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_slug" text NOT NULL,
  "page_id" text NOT NULL,
  "version" integer NOT NULL,
  "event_type" text NOT NULL,
  "importance" text DEFAULT 'normal' NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "change_summary" text,
  "visibility" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_update_events_unique_idx" ON "page_update_events" USING btree ("published_page_id", "version", "event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_update_events_created_idx" ON "page_update_events" USING btree ("created_at", "id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "recipient_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "page_update_event_id" text REFERENCES "page_update_events"("id") ON DELETE CASCADE,
  "published_page_id" text REFERENCES "published_pages"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_event_unique_idx" ON "notifications" USING btree ("recipient_user_id", "page_update_event_id", "type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ranking_snapshots" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "ranking_key" text NOT NULL,
  "entity_type" text NOT NULL,
  "time_window" text DEFAULT '7d' NOT NULL,
  "scope_type" text DEFAULT 'global' NOT NULL,
  "scope_id" text,
  "algorithm_version" text NOT NULL,
  "status" text DEFAULT 'building' NOT NULL,
  "generated_at" timestamp,
  "valid_from" timestamp DEFAULT now() NOT NULL,
  "valid_until" timestamp,
  "source_from" timestamp,
  "source_until" timestamp,
  "item_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ranking_items" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "snapshot_id" text NOT NULL REFERENCES "ranking_snapshots"("id") ON DELETE CASCADE,
  "rank" integer NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "score" real DEFAULT 0 NOT NULL,
  "raw_score" real DEFAULT 0 NOT NULL,
  "decay_factor" real DEFAULT 1 NOT NULL,
  "reason" text NOT NULL,
  "breakdown" jsonb,
  "title" text NOT NULL,
  "description" text,
  "user_id" text,
  "user_slug" text,
  "page_id" text,
  "category_id" text,
  "cover_asset_id" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_at" timestamp,
  "last_published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ranking_items_snapshot_entity_idx" ON "ranking_items" USING btree ("snapshot_id", "entity_type", "entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ranking_items_snapshot_rank_idx" ON "ranking_items" USING btree ("snapshot_id", "rank");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operation_slots" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "uid" text NOT NULL,
  "surface" text NOT NULL,
  "slot_key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "layout_type" text NOT NULL,
  "locale" text DEFAULT 'default' NOT NULL,
  "min_items" integer DEFAULT 0 NOT NULL,
  "max_items" integer DEFAULT 10 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "fallback_strategy" text DEFAULT 'none' NOT NULL,
  "metadata" jsonb,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operation_slots_surface_locale_key_idx" ON "operation_slots" USING btree ("surface", "locale", "slot_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operation_slots_uid_idx" ON "operation_slots" USING btree ("uid");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operation_items" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "uid" text NOT NULL,
  "slot_id" text NOT NULL REFERENCES "operation_slots"("id") ON DELETE CASCADE,
  "item_type" text NOT NULL,
  "target_entity_type" text,
  "target_entity_id" text,
  "target_entity_uid" text,
  "target_url" text,
  "title" text NOT NULL,
  "subtitle" text,
  "description" text,
  "image_asset_id" text,
  "image_url" text,
  "cta_label" text,
  "badge_label" text,
  "locale" text DEFAULT 'default' NOT NULL,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "visibility" text DEFAULT 'draft' NOT NULL,
  "metadata" jsonb,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operation_items_uid_idx" ON "operation_items" USING btree ("uid");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operation_revisions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "uid" text NOT NULL,
  "surface" text NOT NULL,
  "locale" text NOT NULL,
  "revision_number" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "snapshot" jsonb NOT NULL,
  "validation_report" jsonb,
  "published_at" timestamp,
  "published_by" text REFERENCES "users"("id"),
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operation_revisions_number_idx" ON "operation_revisions" USING btree ("surface", "locale", "revision_number");
