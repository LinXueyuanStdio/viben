#!/usr/bin/env tsx
/**
 * 迁移脚本：将旧的嵌套 pages 结构迁移到新的扁平结构
 *
 * 旧结构:
 *   pages/parent/SKILL.md
 *   pages/parent/child/SKILL.md
 *   pages/.page-order.json
 *
 * 新结构:
 *   pages/0612-parent/PAGE.md
 *   pages/0612-child/PAGE.md
 *   pages/index.json
 *
 * 用法: pnpm tsx scripts/migrate-pages.ts /path/to/workspace
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

const PAGES_DIR = "pages";
const OLD_SKILL_FILE = "SKILL.md";
const NEW_PAGE_FILE = "PAGE.md";
const INDEX_FILE = "index.json";
const OLD_ORDER_FILE = ".page-order.json";

interface PageIndex {
  [parentKey: string]: string[];
}

interface OldPage {
  slug: string;
  path: string;
  name: string;
}

// =============================================================================
// 旧结构扫描
// =============================================================================

function discoverOldPages(dir: string, basePath: string): OldPage[] {
  const pages: OldPage[] = [];
  if (!existsSync(dir)) return pages;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const subDir = join(dir, entry.name);
    const skillPath = join(subDir, OLD_SKILL_FILE);

    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, "utf-8");
      const { data } = matter(content);
      const slug = relative(basePath, subDir).replace(/\\/g, "/");
      pages.push({ slug, path: subDir, name: data.name ?? entry.name });
    }

    // 递归扫描子目录
    pages.push(...discoverOldPages(subDir, basePath));
  }
  return pages;
}

// =============================================================================
// UID 生成
// =============================================================================

function generateUid(slug: string): string {
  const mmdd = new Date().toISOString().slice(5, 10).replace("-", "");
  const lastSegment = slug.split("/").pop()!;
  return `${mmdd}-${lastSegment}`;
}

// =============================================================================
// 迁移逻辑
// =============================================================================

function migrateWorkspace(workspacePath: string): void {
  const pagesDir = join(workspacePath, PAGES_DIR);

  if (!existsSync(pagesDir)) {
    console.log("No pages directory found, skipping.");
    return;
  }

  // 检查是否已迁移
  if (existsSync(join(pagesDir, INDEX_FILE))) {
    console.log("Already migrated (index.json exists), skipping.");
    return;
  }

  const oldPages = discoverOldPages(pagesDir, pagesDir);
  if (oldPages.length === 0) {
    console.log("No pages found to migrate.");
    // 创建空的 index.json
    writeFileSync(join(pagesDir, INDEX_FILE), JSON.stringify({ root: [] }, null, 2) + "\n");
    return;
  }

  console.log(`Found ${oldPages.length} pages to migrate.`);

  // 生成 slug -> uid 映射
  const slugToUid = new Map<string, string>();
  const usedUids = new Set<string>();

  for (const page of oldPages) {
    let uid = generateUid(page.slug);
    // 处理 uid 冲突
    let counter = 2;
    while (usedUids.has(uid)) {
      uid = `${generateUid(page.slug)}-${counter}`;
      counter++;
    }
    slugToUid.set(page.slug, uid);
    usedUids.add(uid);
  }

  // 读取旧的 .page-order.json（如果存在）
  const oldOrderPath = join(pagesDir, OLD_ORDER_FILE);
  let oldOrder: Record<string, string[]> = {};
  if (existsSync(oldOrderPath)) {
    try {
      oldOrder = JSON.parse(readFileSync(oldOrderPath, "utf-8"));
    } catch {
      console.warn("Failed to parse .page-order.json, ignoring.");
    }
  }

  // 构建 index.json
  const index: PageIndex = { root: [] };

  for (const page of oldPages) {
    const uid = slugToUid.get(page.slug)!;
    const parts = page.slug.split("/");

    if (parts.length === 1) {
      index.root.push(uid);
    } else {
      const parentSlug = parts.slice(0, -1).join("/");
      const parentUid = slugToUid.get(parentSlug);
      if (parentUid) {
        index[parentUid] = index[parentUid] ?? [];
        index[parentUid].push(uid);
      } else {
        // 父页面不存在，挂到 root
        index.root.push(uid);
      }
    }
  }

  // 应用旧的排序（如果有）
  for (const [key, orderedSlugs] of Object.entries(oldOrder)) {
    const parentUid = key === "root" ? "root" : slugToUid.get(key);
    if (!parentUid || !index[parentUid]) continue;

    const currentUids = index[parentUid];
    const orderedUids: string[] = [];

    // 按旧顺序排列
    for (const slug of orderedSlugs) {
      const uid = slugToUid.get(slug);
      if (uid && currentUids.includes(uid)) {
        orderedUids.push(uid);
      }
    }

    // 添加不在旧顺序中的 uid
    for (const uid of currentUids) {
      if (!orderedUids.includes(uid)) {
        orderedUids.push(uid);
      }
    }

    index[parentUid] = orderedUids;
  }

  // 创建临时目录存放新结构
  const tempDir = join(pagesDir, ".migrate-temp");
  mkdirSync(tempDir, { recursive: true });

  // 复制页面到新位置
  // 从深层目录开始，避免路径冲突
  const sortedPages = [...oldPages].sort((a, b) => b.slug.length - a.slug.length);

  for (const page of sortedPages) {
    const uid = slugToUid.get(page.slug)!;
    const newDir = join(tempDir, uid);

    // 复制整个目录
    cpSync(page.path, newDir, { recursive: true });

    // 重命名 SKILL.md -> PAGE.md
    const oldSkillPath = join(newDir, OLD_SKILL_FILE);
    const newPagePath = join(newDir, NEW_PAGE_FILE);
    if (existsSync(oldSkillPath)) {
      renameSync(oldSkillPath, newPagePath);
    }

    // 删除子目录中的嵌套页面（它们会被单独迁移）
    for (const child of readdirSync(newDir, { withFileTypes: true })) {
      if (child.isDirectory() && existsSync(join(newDir, child.name, OLD_SKILL_FILE))) {
        rmSync(join(newDir, child.name), { recursive: true, force: true });
      }
      // 也删除已迁移的 PAGE.md 子目录
      if (child.isDirectory() && existsSync(join(newDir, child.name, NEW_PAGE_FILE))) {
        rmSync(join(newDir, child.name), { recursive: true, force: true });
      }
    }

    console.log(`Migrated: ${page.slug} -> ${uid}`);
  }

  // 删除旧页面
  for (const page of sortedPages) {
    if (existsSync(page.path)) {
      rmSync(page.path, { recursive: true, force: true });
    }
  }

  // 移动新页面到 pages/
  for (const entry of readdirSync(tempDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const src = join(tempDir, entry.name);
      const dst = join(pagesDir, entry.name);
      renameSync(src, dst);
    }
  }

  // 清理临时目录
  rmSync(tempDir, { recursive: true, force: true });

  // 写入 index.json
  writeFileSync(join(pagesDir, INDEX_FILE), JSON.stringify(index, null, 2) + "\n");
  console.log("Created index.json");

  // 删除旧的 .page-order.json
  if (existsSync(oldOrderPath)) {
    rmSync(oldOrderPath);
    console.log("Removed .page-order.json");
  }

  console.log("Migration complete!");
}

// =============================================================================
// 主函数
// =============================================================================

function main() {
  const workspacePath = process.argv[2];

  if (!workspacePath) {
    console.error("Usage: pnpm tsx scripts/migrate-pages.ts <workspace-path>");
    process.exit(1);
  }

  if (!existsSync(workspacePath)) {
    console.error(`Workspace not found: ${workspacePath}`);
    process.exit(1);
  }

  try {
    migrateWorkspace(workspacePath);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
