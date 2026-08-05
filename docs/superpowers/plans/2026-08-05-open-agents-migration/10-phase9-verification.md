# Phase 9 — 集成验证

**目标**：确认全部代码编译通过，P0 功能可用于手动测试。

## 9.1 编译验证

- [ ] **Step 1: packages typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/packages/agent && pnpm typecheck
cd D:/Document/Github/LinXueyuanStdio/viben/packages/sandbox && pnpm typecheck
cd D:/Document/Github/LinXueyuanStdio/viben/packages/shared && pnpm typecheck
```

预期：三个 package 全部零错误退出。

- [ ] **Step 2: apps/web typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

预期：零错误退出。

## 9.2 数据库验证

- [ ] **Step 3: 确认 migration 存在**

```bash
ls D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/migrations/
```

最新的 `.sql` 文件应包含 11 张新表的 CREATE TABLE 语句。

- [ ] **Step 4: 推送到本地数据库**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm db:push
```

在交互提示中确认 schema 变更。

## 9.3 页面可访问性验证

- [ ] **Step 5: 启动 dev server**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm dev
```

- [ ] **Step 6: 验证页面加载**

| URL | 预期结果 | 通过 |
|-----|---------|------|
| `http://localhost:3000/assistant` | 页面渲染，不报错（即使是空列表） | ☐ |
| `http://localhost:3000/settings/assistant` | 设置页渲染 | ☐ |
| `http://localhost:3000/settings/usage` | 用量页渲染 | ☐ |
| `http://localhost:3000/settings/subscription` | 订阅页渲染 | ☐ |

- [ ] **Step 7: 验证 API 可访问**

```bash
# 无需认证
curl -s http://localhost:3000/api/models | head -c 200

# 需要登录（预期 401）
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/sessions
# → 401

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/usage
# → 401
```

## 9.4 功能验证（P0 项）

登录后逐项验证：

| 功能 | 验证方式 | 通过 |
|------|---------|------|
| ✅ 会话列表 | 访问 `/assistant`，看到会话列表（空或有数据） | ☐ |
| ✅ 创建会话 | 点击"新建会话"，选择仓库分支，创建成功 | ☐ |
| ✅ 发送消息 | 在对话中输入文本，Agent 开始响应 | ☐ |
| ✅ 流式响应 | 看到 Agent 实时输出文字 | ☐ |
| ✅ 停止生成 | 点击停止按钮，Agent 停止 | ☐ |
| ✅ 消息历史 | 刷新页面后仍能看到历史消息 | ☐ |
| ✅ 对话切换 | 左侧对话列表切换对话 | ☐ |
| ✅ 助手设置 | `/settings/assistant` 可修改模型偏好并保存 | ☐ |
| ✅ 用量概览 | `/settings/usage` 显示 token 统计 | ☐ |
| ✅ 认证 | 退出登录后访问 `/assistant` 被重定向 | ☐ |

## 9.5 常见问题排查

| 问题 | 可能原因 | 检查项 |
|------|---------|--------|
| "Module not found" | import 路径未改写 | `grep -r "@open-agents/" apps/web/` |
| "Cannot find module '@/lib/auth/config'" | getServerSession import 旧路径 | 全局搜索 `@/lib/auth/config` |
| "Table does not exist" | migration 未推送 | `pnpm db:push` |
| UI 组件报错 | shadcn API 不兼容 | 对比 open-agents 和 viben 的组件 API |
| "useSession returns null" | /api/users/me 返回格式不对 | 检查 `use-session.ts` 适配逻辑 |

- [ ] **Step 8: 修复所有问题并 Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add -A
git commit -m "fix: 集成验证问题修复"
```
