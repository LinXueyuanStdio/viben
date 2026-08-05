# Phase 7 — 组件迁移

**目标**：将 open-agents assistant 相关组件复制到 viben `components/assistant/`，适配 UI 组件 import 路径。

## 组件分类

### A类：直接复制到 components/assistant/

| 源文件 | 用途 |
|--------|------|
| `assistant-message-groups.tsx` | 消息分组渲染 |
| `thinking-block.tsx` | Thinking/Reasoning 展示 |
| `message-model-pill.tsx` | 模型标签 |
| `session-list.tsx` | 会话列表 |
| `session-drawer.tsx` | 移动端会话抽屉 |
| `session-starter.tsx` | 新建会话入口 |
| `session-starter-vercel-sync-section.tsx` | Vercel 同步区 |
| `new-session-dialog.tsx` | 新建会话弹窗 |
| `inbox-sidebar.tsx` | 对话侧边栏 |
| `inbox-sidebar-rename.tsx` + test | 对话重命名 |
| `inbox-sidebar-rename-dialog.tsx` | 重命名弹窗 |
| `chat-switcher-dropdown.tsx` | 对话切换下拉 |
| `file-tree.tsx` | 文件树 |
| `workspace-file-viewer.tsx` | 文件查看器 |
| `diff-viewer.tsx` | Diff 查看器 |
| `download-diff-dialog.tsx` | 下载 Diff |
| `repo-selector.tsx` | 仓库选择器 |
| `repo-selector-compact.tsx` | 仓库选择器（紧凑） |
| `repo-selection-screen.tsx` | 仓库选择全屏 |
| `branch-selector.tsx` | 分支选择器 |
| `branch-selector-compact.tsx` | 分支选择器（紧凑） |
| `branch-picker-dialog.tsx` | 分支选择弹窗 |
| `create-repo-dialog.tsx` | 创建仓库弹窗 |
| `github-reconnect-dialog.tsx` | GitHub 重连弹窗 |
| `github-reconnect-gate.tsx` | GitHub 重连拦截 |
| `selection-popover.tsx` | 通用选择弹窗 |
| `model-combobox.tsx` | 模型选择下拉 |
| `model-selector-compact.tsx` | 模型选择器（紧凑） |
| `slash-command-dropdown.tsx` | Slash 命令下拉 |
| `file-suggestions-dropdown.tsx` | 文件建议下拉 |
| `inline-question-input.tsx` | 行内问题输入 |
| `text-attachments-preview.tsx` | 文本附件预览 |
| `image-attachments-preview.tsx` | 图片附件预览 |
| `snippet-chip.tsx` | 代码片段标签 |
| `file-type-icons.tsx` | 文件类型图标 |
| `provider-icons.tsx` | Provider 图标 |
| `contribution-chart.tsx` | 贡献热力图 |
| `home-skeleton.tsx` | 首页骨架屏 |
| `diffs-provider.tsx` | Diffs Context Provider |
| `sandbox-selector-compact.tsx` | Sandbox 选择器 |
| `task-group-view.tsx` | 任务组视图 |
| `tool-calls-summary-bar.tsx` | Tool calls 摘要栏 |
| `pinned-todo-panel.tsx` + test | Todo 面板 |

### B类：Chat 页子组件 → components/assistant/

| 源文件（open-agents `app/sessions/[sessionId]/chats/[chatId]/`） | 目标文件 |
|------|------|
| `chat-sidebar.tsx` | `components/assistant/chat-sidebar.tsx` |
| `chat-tabs.tsx` | `components/assistant/chat-tabs.tsx` |
| `code-editor-menu-items.tsx` | `components/assistant/code-editor-menu-items.tsx` |
| `commit-action-button.tsx` | `components/assistant/commit-action-button.tsx` |
| `dev-server-menu-items.tsx` | `components/assistant/dev-server-menu-items.tsx` |
| `diff-tab-view.tsx` | `components/assistant/diff-tab-view.tsx` |
| `file-tab-view.tsx` | `components/assistant/file-tab-view.tsx` |
| `git-panel.tsx` | `components/assistant/git-panel.tsx` |
| `git-panel-context.tsx` | `components/assistant/git-panel-context.tsx` |
| `commit-dialog.tsx` | `components/assistant/commit-dialog.tsx` |
| `create-pr-dialog.tsx` | `components/assistant/create-pr-dialog.tsx` |
| `close-pr-dialog.tsx` | `components/assistant/close-pr-dialog.tsx` |
| `merge-pr-dialog.tsx` | `components/assistant/merge-pr-dialog.tsx` |
| `merge-pr-dialog-actions.tsx` | `components/assistant/merge-pr-dialog-actions.tsx` |
| `merge-check-runs.tsx` | `components/assistant/merge-check-runs.tsx` |
| `sandbox-create-error-banner.tsx` | `components/assistant/sandbox-create-error-banner.tsx` |
| `session-header.tsx` | `components/assistant/session-header.tsx` |

### C类：Tool Call 组件 → components/assistant/tool-call/

将 open-agents 的 `components/tool-call/` 目录完整复制到 `components/assistant/tool-call/`。

### D类：需改写的组件

**`user-avatar-dropdown.tsx`**：open-agents 版本使用 Better Auth 的 `signOut`。移植后改为 viben 的登出方法。

### E类：不迁移

| 组件 | 原因 |
|------|------|
| `components/auth/*` | Better Auth 认证 UI，用 viben 替代 |
| `components/landing/*` | Landing page，viben 有自己首页 |
| `components/ui/*`（27 个 shadcn 组件） | viben 已有同名 shadcn 组件 |

## 关键适配：UI 组件 import

open-agents 的组件大量引用 `@/components/ui/*`（shadcn 组件）。viben 也有同名组件，但 API 可能有细微差异。需要检查：

**viben 已有的 shadcn 组件 vs open-agents 需要的：**

| 组件 | open-agents 版本 | viben 版本 | 兼容性 |
|------|-----------------|-----------|--------|
| button | `@/components/ui/button` | `@/components/ui/button` | 检查 API |
| dialog | `@/components/ui/dialog` | `@/components/ui/dialog` | 检查 API |
| select | `@/components/ui/select` | `@/components/ui/select` | 检查 API |
| dropdown-menu | `@/components/ui/dropdown-menu` | `@/components/ui/dropdown-menu` | 检查 API |
| popover | `@/components/ui/popover` | `@/components/ui/popover` | 检查 API |
| tooltip | `@/components/ui/tooltip` | `@/components/ui/tooltip` | 检查 API |
| tabs | `@/components/ui/tabs` | `@/components/ui/tabs` | 检查 API |
| avatar | `@/components/ui/avatar` | `@/components/ui/avatar` | 检查 API |
| scroll-area | `@/components/ui/scroll-area` | `@/components/ui/scroll-area` | 检查 API |
| switch | `@/components/ui/switch` | `@/components/ui/switch` | 检查 API |
| skeleton | `@/components/ui/skeleton` | `@/components/ui/skeleton` | 检查 API |
| separator | `@/components/ui/separator` | `@/components/ui/separator` | 检查 API |
| sheet | `@/components/ui/sheet` | `@/components/ui/sheet` | 检查 API |
| input | `@/components/ui/input` | `@/components/ui/input` | 检查 API |
| textarea | `@/components/ui/textarea` | `@/components/ui/textarea` | 检查 API |
| label | `@/components/ui/label` | `@/components/ui/label` | 检查 API |
| card | `@/components/ui/card` | `@/components/ui/card` | 检查 API |
| table | `@/components/ui/table` | `@/components/ui/table` | 检查 API |

**viben 没有的 open-agents UI 组件**（如果被 reference 到需要创建）：

| 组件 | 说明 |
|------|------|
| `button-group` | open-agents 有，viben 可能没有 |
| `command` | cmdk 封装 |
| `calendar` | react-day-picker 封装 |
| `date-range-picker` | 日期范围选择 |
| `drawer` | vaul 封装 |
| `empty` | 空状态 |
| `field` | 表单字段 |
| `input-group` | 输入组 |
| `sidebar` | 侧边栏 |

如果 open-agents 的组件引用了 viben 没有的 UI 组件，需要从 open-agents 复制对应的 UI 组件文件。

## 实施步骤

- [ ] **Step 1: 创建目标目录**

```bash
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/components/assistant/tool-call
```

- [ ] **Step 2: 批量复制 A 类组件**

将 `open-agents/apps/web/components/` 下的 A 类文件复制到 `viben/apps/web/components/assistant/`。

- [ ] **Step 3: 批量复制 B 类组件**

将 open-agents chat 页下的子组件复制到 `components/assistant/`。

- [ ] **Step 4: 复制 C 类 Tool Call 组件**

```bash
cp -r "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/components/tool-call/"* "D:/Document/Github/LinXueyuanStdio/viben/apps/web/components/assistant/tool-call/"
```

- [ ] **Step 5: 检查 UI 组件兼容性**

对比 open-agents 和 viben 的 shadcn 组件 API。对 viben 缺少的 UI 组件，从 open-agents 复制。

- [ ] **Step 6: 全局替换 import 路径**

```bash
grep -rl "@open-agents/" D:/Document/Github/LinXueyuanStdio/viben/apps/web/components/assistant/ | xargs sed -i 's/@open-agents\//@viben\//g'
```

同时替换组件中：
- `@/hooks/use-session` → `@/hooks/assistant/use-session`
- `@/lib/auth/actions` 中的 `signOut` 引用 → viben 对应方法

- [ ] **Step 7: 改写 user-avatar-dropdown.tsx**

将其中的 `signOut` 调用改为 viben 登出方法。

- [ ] **Step 8: 验证 — typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

修正所有 import 路径和 API 不兼容问题。

- [ ] **Step 9: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/components/assistant/
git commit -m "feat: 迁移 open-agents assistant 组件到 components/assistant/"
```
