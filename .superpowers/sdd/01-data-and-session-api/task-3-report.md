# Task 3 实施报告：登录专用 Page session API 与 unarchive 冲突保护

## 状态

完成。已实现登录专用 `POST /api/page-sessions` get-or-create、Page session 恢复/快照同步/并发 winner 重读、普通 session 防伪、无 sandbox 创建路径，以及归档 Page session 恢复冲突的 409 保护。

## 变更文件

- `apps/web/lib/page-chat/types.ts`
- `apps/web/lib/page-chat/page-session-service.ts`
- `apps/web/app/api/page-sessions/route.ts`
- `apps/web/app/api/page-sessions/route.test.ts`
- `apps/web/app/api/sessions/route.ts`
- `apps/web/app/api/sessions/route.test.ts`
- `apps/web/app/api/sessions/[sessionId]/route.ts`
- `apps/web/app/api/sessions/[sessionId]/route.test.ts`

受保护文件未修改、未暂存：

- `apps/web/components/auth/login-page-content.tsx`
- `apps/web/components/auth/login-page-content.test.tsx`
- `apps/web/lib/i18n/locales/en.json`
- `apps/web/lib/i18n/locales/zh-CN.json`

## RED 摘要

命令：

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run app/api/page-sessions/route.test.ts app/api/sessions/route.test.ts 'app/api/sessions/[sessionId]/route.test.ts'
```

预期失败：Page route 不存在；普通入口未显式持久化 `agentType: "work"`；Page unarchive 仍返回 200。随后针对托管试用仅限制创建、团队页面编辑权限、并发 unarchive 23505、错误页面编辑 helper 结果分别增加测试并观察到对应 RED。

## GREEN 摘要

最终命令：

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run app/api/page-sessions/route.test.ts app/api/sessions/route.test.ts 'app/api/sessions/[sessionId]/route.test.ts' lib/db/sessions.test.ts
cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

结果：4 个测试文件、38 个测试全部通过；`tsc --noEmit` 通过。

## 实现要点

- 只接受 `user_slug` / `page_slug`，空值或 camelCase 输入返回 400。
- 未登录 401；不存在和不可读统一 404 `{ error: "Page not found" }`。
- 复用 BotID、`sessions-create` 用户限流、托管试用 session 数量限制和模型偏好清洗。
- 托管试用数量限制只在需要新建时执行，不阻断已有 Page session 恢复。
- 已有 active session 同步当前标题/slug 快照并恢复最新 chat；归档 session 不被恢复。
- 首次创建使用 `agentType = chat` 的 DB 服务且不 kick sandbox；普通 `/api/sessions` 显式锁定 `agentType = work` 并继续 provisioning。
- Page 首次创建 23505 时重新读取唯一约束 winner 和最新 chat。
- `can_edit` 复用 `findEditablePage()` 支持团队成员，并校验 helper 返回稳定页面 ID。
- Page unarchive 在更新前预检冲突；若并发竞态仍触发 23505，再次读取 winner 并返回 snake_case 409。

## 自审 / Concerns

- 已由独立 reviewer 检查权限、并发、限流、模型和测试；其重要发现均已修复并增加回归测试。
- `findEditablePage()` 目前把团队任意成员视作可编辑者，这是项目既有公共权限语义；本任务未复制或改变权限 SQL。
- 未执行全量 `apps/web build`；Task 3 brief 的门槛是目标测试和 typecheck，最终全应用 build 由总计划集成阶段负责。

## Commit

`feat(web): add page session get-or-create api`（独立提交；最终 hash 以 `git log -1` 和交接回复为准）
