# Web 社区能力分拆计划与审查结论 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将原单体 Web 社区 plan 拆成 7 个按产品能力边界执行的计划，并记录子agent基于 spec 审出的阻塞项。

**Architecture:** `apps/web` 的社区能力按数据事实边界拆分：发布页目录与统计、通用互动、关注订阅通知、浏览分享转发、Moment、榜单推荐、首页运营。每个子计划独立交付可测试能力，公共约束由本索引统一约定，避免路由冲突、schema 简化和不可验证 UI 验收再次进入执行阶段。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Drizzle ORM, Vitest, Testing Library, Tailwind v4, lucide-react.

---

## 审查结论

4 个子agent已按 spec 审核原 `2026-06-23-web-community.md`，结论为：原 master plan 不可直接执行，必须拆分并修正阻塞项。

### 必须先修正的阻塞项

- 根级动态路由冲突：仓库已有 `apps/web/app/[user_id]/page/page.tsx`，不能再新增同层级 `apps/web/app/[user_slug]/page.tsx`。执行前必须把公开作者页统一到一个根动态段，建议将现有 `[user_id]` 路由迁移为 `[user_slug]`，并把旧 `/{user_slug}/page` 入口重定向到 `/page/{user_slug}`。
- API 动态段冲突：仓库已有 `apps/web/app/api/users/[username]/route.ts`，不能新增另一个同层级 slug 命名动态目录。订阅计划必须把关注接口放在现有 `apps/web/app/api/users/[username]/follow/route.ts` 下，并在 route 内把 `params.username` 当作 `user_slug` 传入服务；如后续统一重命名目录，必须在单独路由迁移任务中完成。
- `/read/{user_slug}/{page_id}` 必须使用统一可见性判断。未登录用户只能访问 `visibility = public` 且 `moderation_status = approved` 的页面；作者本人可以在管理场景访问自己的非公开页面；公开入口不得泄露 hidden、rejected、private 页面状态。
- schema 必须逐项匹配 7 份 spec。原 plan 简化了 ranking、operation、Moment、subscription、history、share、repost、interaction 字段，无法满足 API 契约。
- repost 依赖 Moment。浏览、分享、历史能力可以先交付，`reposts` 的 active 创建与 `moment_id` 写入必须在 Moment 模型可用后接入。
- 所有包含 bracket 动态段的测试命令都必须给路径加引号，包括 `[user_slug]`、`[page_id]`、`[comment_id]`、`[moment_id]`、`[ranking_key]`、`[section_key]`、`[slot_id]`、`[item_id]`、`[revision_id]`，避免 zsh glob 报 `no matches found`。
- UI 验收必须覆盖 subscription、leaderboard、moment 页面，包含登录引导、空态、移动端单列、长标题溢出、icon-only 按钮可访问名称、focus-visible 和底部粘滞栏遮挡检查。

### 执行顺序

1. `2026-06-23-web-community-01-page-directory-stats.md`
2. `2026-06-23-web-community-02-interactions.md`
3. `2026-06-23-web-community-03-subscription-notification.md`
4. `2026-06-23-web-community-05-moment.md`
5. `2026-06-23-web-community-04-history-share-repost.md`
6. `2026-06-23-web-community-06-ranking-recommendation.md`
7. `2026-06-23-web-community-07-operations.md`

Moment 排在 history/share/repost 之前，是因为转发需要创建或关联 Moment。浏览历史与分享链接本身不依赖 Moment，可以在第 5 步中先合并无转发部分，再接入 repost。

## 分拆计划

- [发布页目录化与统计](2026-06-23-web-community-01-page-directory-stats.md)
- [通用互动层](2026-06-23-web-community-02-interactions.md)
- [关注订阅与通知](2026-06-23-web-community-03-subscription-notification.md)
- [浏览历史、分享与转发](2026-06-23-web-community-04-history-share-repost.md)
- [Moment 动态流](2026-06-23-web-community-05-moment.md)
- [榜单与推荐排序](2026-06-23-web-community-06-ranking-recommendation.md)
- [首页运营位与后台配置](2026-06-23-web-community-07-operations.md)

## 全局执行门禁

- 每个子计划执行前运行 `git status --short`，只处理该计划列出的文件，不能回滚用户已有改动。
- 所有新增 API query 参数、body 字段、响应字段使用 `snake_case`。
- TypeScript 类型必须使用顶部 `import type { Name } from "path"`，不能使用 inline import type。
- 不使用 `await import()` 动态导入。
- Drizzle migration 由 `pnpm --filter @viben/web db:generate` 生成后保留 meta journal 一致性，不手动改名破坏 `_journal.json`。
- 每个子计划完成后至少运行对应单测；合并一个完整能力边界后运行 `pnpm --filter @viben/web test:run` 和 `pnpm --filter @viben/web type-check`。
- 涉及 public UI 的子计划必须增加桌面和移动 viewport 的测试或截图验收记录。
