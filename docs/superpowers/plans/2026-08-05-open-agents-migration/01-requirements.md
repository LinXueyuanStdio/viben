# 01 — 需求清单

## 1. 用户故事

### C 端用户（普通用户）

1. **作为 C 端用户**，我可以在左侧边栏点击"助手"进入对话页面，与 AI Agent 进行编码相关的对话
2. **作为 C 端用户**，我可以在 `/assistant` 查看我的历史会话列表
3. **作为 C 端用户**，我可以通过分享链接查看别人分享的对话内容（只读）

### B 端用户（创作者）

1. **作为 B 端创作者**，我可以创建新的编码会话，选择 GitHub 仓库和分支
2. **作为 B 端创作者**，我可以与 Agent 进行多轮对话，Agent 会读写文件、执行命令
3. **作为 B 端创作者**，我可以实时看到 Agent 的思考过程（Reasoning）和工具调用
4. **作为 B 端创作者**，我可以在对话页浏览工作区文件树，查看代码变更 Diff
5. **作为 B 端创作者**，我可以让 Agent 自动 commit 代码并创建 Pull Request
6. **作为 B 端创作者**，我可以在设置页配置模型偏好、GitHub 连接等
7. **作为 B 端创作者**，我可以查看我的 Token 用量统计和费用估算

## 2. 功能需求（按优先级）

### P0 — 必须可用（核心闭环）

| ID | 功能 | 描述 |
|----|------|------|
| F01 | 会话列表 | `/assistant` 显示用户的所有会话，含标题、状态、更新时间 |
| F02 | 创建会话 | 选择仓库和分支后创建新会话，自动创建第一个对话 |
| F03 | 发送消息 | 在对话中输入文本并发送给 Agent |
| F04 | 流式响应 | 实时接收 Agent 的 SSE 流式输出（文字 + reasoning + tool calls） |
| F05 | 停止生成 | 中途停止 Agent 执行 |
| F06 | 消息历史 | 查看对话中所有历史消息 |
| F07 | 对话切换 | 在不同对话之间切换（sidebar 对话列表） |
| F08 | 助手设置 | `/settings/assistant` 可配置默认模型、GitHub 连接 |
| F09 | 用量概览 | `/settings/usage` 显示 Token 消耗统计 |
| F10 | 认证集成 | 使用 viben 账号登录后可直接使用助手，无需额外登录 |

### P1 — 应该可用（增强体验）

| ID | 功能 | 描述 |
|----|------|------|
| F11 | Thinking 展示 | 折叠/展开 Agent 的 reasoning 内容 |
| F12 | Tool calls 展示 | 查看 Agent 调用了哪些工具及其结果 |
| F13 | Todo 面板 | 查看 Agent 的 Todo 列表 |
| F14 | 文件树 | 浏览工作区文件结构 |
| F15 | 文件查看 | 点击文件查看内容（语法高亮） |
| F16 | Diff 查看 | 查看代码变更，支持 unified 和 split 两种模式 |
| F17 | Git 面板 | 查看 changed files，手动 commit、push |
| F18 | 创建 PR | 在 GitHub 上创建 Pull Request |
| F19 | GitHub 连接 | GitHub App 安装/授权管理 |
| F20 | Sandbox 休眠/恢复 | 不活跃后自动休眠，发送消息时自动恢复 |
| F21 | 仓库克隆 | 创建会话时自动克隆 GitHub 仓库到 Sandbox |
| F22 | 模型选择 | 选择默认主模型和 subagent 模型 |
| F23 | 自动 Commit | 开启/关闭 Agent 完成后自动 commit |
| F24 | 费用估算 | 基于 models.dev 定价估算 Token 费用 |

### P2 — 锦上添花（后续迭代）

| ID | 功能 | 描述 |
|----|------|------|
| F25 | 分享对话 | 生成只读分享链接 |
| F26 | 分叉对话 | 从某条消息处 Fork 新对话 |
| F27 | 语音输入 | ElevenLabs 语音转录 |
| F28 | Slash 命令 | `/` 触发文件/命令建议 |
| F29 | 图片附件 | 上传图片作为对话输入 |
| F30 | 贡献热力图 | 按天显示 Token 消耗热力图 |
| F31 | 用量排行榜 | 公开用量排名 |
| F32 | Dev Server | Sandbox 内启动 Dev Server，预览开发中的项目 |
| F33 | 代码编辑器 | Sandbox 内启动代码编辑器 |
| F34 | 订阅管理 | `/settings/subscription` 查看订阅计划 |

## 3. 技术要求

### 3.1 编译

- `packages/agent` typecheck 通过
- `packages/sandbox` typecheck 通过
- `packages/shared` typecheck 通过
- `apps/web` typecheck 通过

### 3.2 数据库

- 所有 open-agents 表正确生成 migration SQL
- `user_id` 外键引用 viben `users.id`
- 不与 viben 现有表冲突

### 3.3 认证

- 所有 API routes 使用 viben `getSession()` 验证登录态
- 客户端 `useSession` hook 使用 viben `/api/users/me`
- 去掉所有 Better Auth 代码

### 3.4 布局

- Assistant 页面复用 `DashboardShell`（viben 现有 header + sidebar）
- Settings 页面使用 dashboard layout（不额外创建 sidebar）

### 3.5 国际化

- 暂时不做翻译（先全英文），后续迭代补充

### 3.6 路由

- `/assistant` → 会话列表
- `/assistant/[sessionId]/[chatId]` → 对话页
- `/settings/assistant` → 助手设置
- `/settings/usage` → 用量统计
- `/settings/subscription` → 订阅管理
- API 保持 open-agents 原路径不变

## 4. 不做的事

- ❌ 不迁移 Better Auth（用 viben 认证）
- ❌ 不迁移 open-agents landing page
- ❌ 不迁移 open-agents users/accounts 表
- ❌ 不迁移 `@open-agents/tsconfig` 整包
- ❌ 不迁移 open-agents 的 shadcn/ui 组件（27 个，viben 已有）
- ❌ 不修改 viben 现有社区功能
- ❌ 不改变 viben 现有 `/api/github/*` 路由

## 5. 验收标准

### 5.1 每个 Phase 的验收

| Phase | 验收方式 |
|-------|----------|
| Phase 1 | `cd packages/agent && pnpm typecheck` 等三个全部通过 |
| Phase 2 | `pnpm install` 无错误 |
| Phase 3 | `pnpm db:generate` 生成 migration SQL，`pnpm db:push` 成功 |
| Phase 4 | `cd apps/web && pnpm typecheck` 通过 |
| Phase 5 | `cd apps/web && pnpm typecheck` 通过 |
| Phase 6 | `cd apps/web && pnpm typecheck` 通过 |
| Phase 7 | `cd apps/web && pnpm typecheck` 通过 |
| Phase 8 | `cd apps/web && pnpm typecheck` 通过，页面可访问 |
| Phase 9 | P0 功能手动验证通过 |
| Phase 10 | 文档齐全 |

### 5.2 最终验收

```bash
# 1. 全项目编译
cd packages/agent && pnpm typecheck
cd packages/sandbox && pnpm typecheck
cd packages/shared && pnpm typecheck
cd apps/web && pnpm typecheck

# 2. 页面可访问
curl http://localhost:3000/assistant              # → 200
curl http://localhost:3000/settings/assistant      # → 200
curl http://localhost:3000/settings/usage           # → 200

# 3. API 可访问
curl http://localhost:3000/api/models               # → 200 JSON
curl http://localhost:3000/api/sessions             # → 200 JSON (需登录)
curl http://localhost:3000/api/usage                # → 200 JSON (需登录)
```
