ALTER TABLE "sessions" ADD COLUMN "agent_type" text DEFAULT 'work' NOT NULL;
ALTER TABLE "sessions" ADD COLUMN "published_page_id" text;
ALTER TABLE "sessions" ADD COLUMN "page_user_slug" text;
ALTER TABLE "sessions" ADD COLUMN "page_slug" text;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_published_page_id_published_pages_id_fk"
  FOREIGN KEY ("published_page_id") REFERENCES "public"."published_pages"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "sessions_active_page_chat_unique_idx"
  ON "sessions" USING btree ("user_id", "published_page_id")
  WHERE agent_type = 'chat' AND status <> 'archived';
