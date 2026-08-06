/**
 * Migration script: notes 表 page_id → entity_type + entity_id
 *
 * 运行方式:
 *   cd apps/web && npx tsx scripts/migrate-notes-entity.ts
 *
 * 步骤:
 *   1. 将现有 page_id 数据迁移到 entity_type + entity_id
 *   2. 删除 page_id 列
 *   3. 重建索引
 */

import { config } from "dotenv"
import { resolve } from "path"

// 加载 env 文件（与 drizzle-kit 相同的加载路径）
config({ path: resolve(__dirname, "../.env") })
config({ path: resolve(__dirname, "../.env.local") })

import { db } from "../lib/db"
import { sql } from "drizzle-orm"

async function main() {
  console.log("Starting notes entity migration...\n")

  // Step 1: Backfill entity_type and entity_id from page_id
  console.log("Step 1: Backfilling entity_type + entity_id from page_id...")
  const backfillResult = await db.execute(sql`
    UPDATE notes
    SET entity_type = 'published_page', entity_id = page_id
    WHERE entity_id IS NULL
  `)
  console.log(`  Backfilled ${backfillResult.rowCount ?? 0} rows.\n`)

  // Step 2: Drop page_id column
  console.log("Step 2: Dropping page_id column...")
  await db.execute(sql`ALTER TABLE notes DROP COLUMN IF EXISTS page_id`)
  console.log("  page_id column dropped.\n")

  // Step 3: Drop old index
  console.log("Step 3: Dropping old index notes_page_author_idx...")
  await db.execute(sql`DROP INDEX IF EXISTS notes_page_author_idx`)
  console.log("  Old index dropped.\n")

  // Step 4: Create new index
  console.log("Step 4: Creating new index notes_entity_author_idx...")
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS notes_entity_author_idx
    ON notes(entity_type, entity_id, author_user_id, created_at DESC)
  `)
  console.log("  New index created.\n")

  console.log("✅ Migration complete.")
}

main().catch((err) => {
  console.error("❌ Migration failed:", err)
  process.exit(1)
})
