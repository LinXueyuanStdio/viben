# GitHub 集成设计方案

> 生成日期: 2026-02-28
> 参考项目: Auto-Claude

## 概述

在 Viben 工作区设置中增加 GitHub 集成功能，完整移植 Auto-Claude 的所有 GitHub 功能。

### 需求决策

| 决策项 | 选择 |
|-------|------|
| 功能范围 | 完整复制 Auto-Claude 所有 GitHub 功能 |
| 认证方式 | 混合模式：优先 gh CLI，降级 PAT |
| 配置范围 | 仅工作区级别 |
| Issue 处理 | 转化为 AI Spec（跟随 Auto-Claude） |
| 实现方式 | 直接移植，适配 Viben 架构 |

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop App (Frontend)                    │
├─────────────────────────────────────────────────────────────┤
│  WorkspaceSettingsDialog                                     │
│  └── GitHubSection (新增)                                    │
│      ├── GitHubAuth        - 认证状态/OAuth/PAT 输入         │
│      ├── GitHubRepository  - 仓库连接和选择                  │
│      ├── GitHubIssues      - Issue 列表和导入                │
│      ├── GitHubPRs         - PR 管理                         │
│      └── GitHubReleases    - Release 创建                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gateway API (Backend)                     │
├─────────────────────────────────────────────────────────────┤
│  /api/github/*                                               │
│  ├── /auth          - OAuth 流程 / PAT 验证                  │
│  ├── /repos         - 仓库操作                               │
│  ├── /issues        - Issue CRUD                             │
│  ├── /prs           - PR 操作                                │
│  └── /releases      - Release 管理                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage (File-Native)                     │
├─────────────────────────────────────────────────────────────┤
│  ~/.viben/workspaces/{workspace_id}/github.yaml              │
│  内容：token, repo, owner, default_branch 等                 │
└─────────────────────────────────────────────────────────────┘
```

## 文件结构

### 后端 (packages/core)

```
packages/core/src/
├── gateway/routes/
│   └── github.ts                    # 新增 - GitHub API 路由入口
├── services/
│   └── github/                      # 新增 - GitHub 服务模块
│       ├── index.ts                 # 导出
│       ├── auth.ts                  # OAuth / PAT 认证
│       ├── repository.ts            # 仓库操作
│       ├── issues.ts                # Issue 操作
│       ├── investigation.ts         # AI Issue 分析
│       ├── import.ts                # 批量导入
│       ├── pull-requests.ts         # PR 操作
│       ├── releases.ts              # Release 操作
│       └── utils.ts                 # 共享工具函数
└── types/
    └── github.ts                    # 新增 - GitHub 类型定义
```

### 前端 (apps/desktop)

```
apps/desktop/src/
├── components/workspace/
│   ├── workspace-settings-dialog.tsx  # 修改 - 增加 GitHub section
│   └── github/                         # 新增 - GitHub 组件
│       ├── github-section.tsx          # 主容器
│       ├── github-auth.tsx             # 认证 UI
│       ├── github-repository.tsx       # 仓库选择
│       ├── github-issues.tsx           # Issue 列表
│       ├── github-issue-detail.tsx     # Issue 详情/分析
│       ├── github-prs.tsx              # PR 列表
│       └── github-releases.tsx         # Release 管理
├── hooks/
│   └── use-github.ts                   # 新增 - GitHub API hooks
└── lib/
    └── github-client.ts                # 新增 - Gateway GitHub API 客户端
```

## 数据类型和存储

### GitHub 配置文件 (`~/.viben/workspaces/{id}/github.yaml`)

```yaml
# 认证信息
auth:
  type: "gh_cli" | "pat"      # 认证方式
  token: "ghp_xxxx"           # PAT 或 gh CLI 获取的 token
  expires_at: "2024-12-31"    # token 过期时间（可选）

# 仓库信息
repository:
  owner: "LinXueyuanStdio"
  name: "viben"
  full_name: "LinXueyuanStdio/viben"
  default_branch: "main"
  url: "https://github.com/LinXueyuanStdio/viben"

# 偏好设置
preferences:
  auto_sync_issues: false      # 是否自动同步 issue
  issue_labels_filter: []      # 筛选特定标签的 issue
  default_assignee: ""         # 默认指派人
```

### 核心类型定义 (`packages/core/src/types/github.ts`)

```typescript
// 从 Auto-Claude 移植的类型
export interface GitHubConfig {
  auth: {
    type: "gh_cli" | "pat";
    token: string;
    expires_at?: string;
  };
  repository?: {
    owner: string;
    name: string;
    full_name: string;
    default_branch: string;
    url: string;
  };
  preferences?: GitHubPreferences;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  // ... 完整字段从 Auto-Claude 移植
}

export interface GitHubPullRequest { /* ... */ }
export interface GitHubRelease { /* ... */ }
```

## Gateway API 路由

```typescript
// 所有路由需要 workspace_path 参数来定位配置

// ===== 认证 =====
GET  /api/github/auth/status?workspace_path=xxx
     → { authenticated: boolean, user?: GitHubUser, auth_type?: string }

POST /api/github/auth/gh-cli?workspace_path=xxx
     → 启动 gh CLI OAuth 流程，返回 device code URL

POST /api/github/auth/pat?workspace_path=xxx
     body: { token: string }
     → 验证 PAT 并保存

DELETE /api/github/auth?workspace_path=xxx
     → 清除认证信息

// ===== 仓库 =====
GET  /api/github/repos?workspace_path=xxx
     → 列出用户有权访问的仓库

GET  /api/github/repos/detect?workspace_path=xxx
     → 从工作区 .git 检测当前仓库

POST /api/github/repos/connect?workspace_path=xxx
     body: { owner: string, name: string }
     → 连接到指定仓库

// ===== Issues =====
GET  /api/github/issues?workspace_path=xxx&state=open&page=1&per_page=20
     → 获取 Issue 列表

GET  /api/github/issues/:number?workspace_path=xxx
     → 获取单个 Issue 详情

POST /api/github/issues/:number/investigate?workspace_path=xxx
     → AI 分析 Issue，生成 Spec

POST /api/github/issues/import?workspace_path=xxx
     body: { issue_numbers: number[] }
     → 批量导入 Issues 为 Specs

// ===== Pull Requests =====
GET  /api/github/prs?workspace_path=xxx&state=open
     → 获取 PR 列表

POST /api/github/prs?workspace_path=xxx
     body: { title, body, head, base }
     → 创建 PR

// ===== Releases =====
GET  /api/github/releases?workspace_path=xxx
     → 获取 Release 列表

POST /api/github/releases?workspace_path=xxx
     body: { tag_name, name, body, draft, prerelease }
     → 创建 Release
```

## 认证流程

### 混合认证流程

```
┌─────────────────────────────────────────────────────────────┐
│                    用户打开 GitHub 设置                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ 检测 gh CLI 是否 │
                    │     已安装       │
                    └─────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │ 已安装                         │ 未安装
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ 检测 gh 是否已   │             │ 显示 PAT 输入框  │
    │ 登录 (gh auth   │             │ 和获取链接       │
    │     status)     │             └─────────────────┘
    └─────────────────┘                       │
              │                               ▼
      ┌───────┴───────┐             ┌─────────────────┐
      │ 已登录         │ 未登录      │ 用户输入 PAT     │
      ▼               ▼             └─────────────────┘
┌───────────┐  ┌───────────┐                  │
│ 直接获取   │  │ 启动 OAuth │                  ▼
│ token     │  │ Device    │        ┌─────────────────┐
│ 保存配置   │  │ Flow      │        │ 验证 PAT 有效性  │
└───────────┘  └───────────┘        │ (调用 /user)    │
                    │               └─────────────────┘
                    ▼                         │
           ┌─────────────────┐                │
           │ 打开浏览器       │                │
           │ 用户授权        │                │
           │ 轮询等待完成     │                │
           └─────────────────┘                │
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │ 保存到 github.yaml       │
                    │ 返回认证成功             │
                    └─────────────────────────┘
```

### 错误处理策略

| 错误场景 | 处理方式 |
|---------|---------|
| gh CLI 未安装 | 降级显示 PAT 输入，提示可安装 gh |
| PAT 无效/过期 | 提示重新输入，显示 token 创建链接 |
| OAuth 超时 | 显示超时提示，允许重试 |
| Rate Limit | 显示剩余配额，建议等待或使用 PAT |
| 仓库无权限 | 提示权限不足，建议检查 token scope |
| 网络错误 | 显示重试按钮，保留上次状态 |

## UI 组件设计

### 工作区设置中的 GitHub Section

```
┌─ 工作区设置 ──────────────────────────────────────────────┐
│                                                            │
│  [常规] [执行器] [智能体] [MCP] [技能] [GitHub] [关于]       │
│                                      ^^^^^^^^              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ GitHub 集成                                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  认证状态: ✓ 已连接 (gh CLI)     [断开连接]         │   │
│  │  用户: @LinXueyuanStdio                             │   │
│  │                                                     │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │                                                     │   │
│  │  仓库: LinXueyuanStdio/viben    [更换仓库]          │   │
│  │  默认分支: main                                     │   │
│  │                                                     │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │                                                     │   │
│  │  [Issues]  [Pull Requests]  [Releases]              │   │
│  │                                                     │   │
│  │  ┌─ Open Issues (12) ─────────────────────────┐    │   │
│  │  │ #156 添加 GitHub 集成功能        bug       │    │   │
│  │  │ #155 优化 Kanban 性能           enhance   │    │   │
│  │  │ #154 修复 MCP 连接问题          bug       │    │   │
│  │  │ ...                                        │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  │                                                     │   │
│  │  [导入选中] [AI 分析] [刷新]                        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 组件职责

| 组件 | 职责 |
|-----|------|
| `GitHubSection` | 主容器，管理 tab 切换和整体状态 |
| `GitHubAuth` | 认证状态显示、OAuth/PAT 登录、断开连接 |
| `GitHubRepository` | 仓库选择器、自动检测、手动输入 |
| `GitHubIssues` | Issue 列表、筛选、批量选择 |
| `GitHubIssueDetail` | Issue 详情弹窗、AI 分析结果展示 |
| `GitHubPRs` | PR 列表、创建 PR 表单 |
| `GitHubReleases` | Release 列表、创建 Release 表单 |

## AI Issue 分析和 Spec 生成

### Issue 分析流程

```
┌─────────────────┐
│ 用户点击        │
│ [AI 分析] 按钮  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. 获取 Issue 完整内容              │
│    - title, body, comments          │
│    - labels, assignees              │
│    - related PRs, linked issues     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. 构建上下文                       │
│    - 工作区代码结构               │
│    - 相关文件内容                   │
│    - 项目 README/CLAUDE.md          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. AI 分析生成                      │
│    - 复杂度评估 (简单/中等/复杂)    │
│    - 影响范围分析                   │
│    - 实现方案建议                   │
│    - 生成 Spec 文件                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 4. 输出结果                         │
│    - 保存 Spec 到工作区           │
│    - 可选：创建 Agent 任务          │
└─────────────────────────────────────┘
```

### Spec 文件格式 (`.viben/specs/issues/issue-{number}.yaml`)

```yaml
# 从 GitHub Issue #156 生成
source:
  type: "github_issue"
  number: 156
  url: "https://github.com/LinXueyuanStdio/viben/issues/156"
  synced_at: "2024-01-15T10:30:00Z"

analysis:
  complexity: "medium"          # simple | medium | complex
  estimated_files: 8
  affected_areas:
    - "apps/desktop/src/components/workspace"
    - "packages/core/src/gateway/routes"
    - "packages/core/src/services"

spec:
  title: "添加 GitHub 集成功能"
  description: |
    在工作区设置中增加 GitHub 集成，支持...

  requirements:
    - "支持 gh CLI 和 PAT 两种认证方式"
    - "Issue 列表展示和筛选"
    - "AI 分析 Issue 并生成 Spec"

  implementation_hints:
    - "参考 Auto-Claude 的 github-handlers 实现"
    - "使用 Gateway API 而非 IPC"
```

## 实现计划

### 从 Auto-Claude 移植的文件对照

| Auto-Claude 文件 | Viben 目标位置 | 改动说明 |
|-----------------|---------------|---------|
| `github-handlers.ts` | `gateway/routes/github.ts` | IPC → HTTP 路由 |
| `github/oauth-handlers.ts` | `services/github/auth.ts` | 保持逻辑，改调用方式 |
| `github/repository-handlers.ts` | `services/github/repository.ts` | 直接移植 |
| `github/issue-handlers.ts` | `services/github/issues.ts` | 直接移植 |
| `github/investigation-handlers.ts` | `services/github/investigation.ts` | 适配 Viben Agent |
| `github/import-handlers.ts` | `services/github/import.ts` | Spec 路径改为 `specs/issues/` |
| `github/pr-handlers.ts` | `services/github/pull-requests.ts` | 直接移植 |
| `github/release-handlers.ts` | `services/github/releases.ts` | 直接移植 |
| `github/utils.ts` | `services/github/utils.ts` | 直接移植 |

### 实现顺序

```
Phase 1: 基础设施
├── 1.1 类型定义 (types/github.ts)
├── 1.2 配置读写工具 (services/github/utils.ts)
└── 1.3 Gateway 路由骨架 (routes/github.ts)

Phase 2: 认证
├── 2.1 gh CLI 检测和 OAuth
├── 2.2 PAT 验证
└── 2.3 前端 GitHubAuth 组件

Phase 3: 仓库
├── 3.1 仓库检测和列表
├── 3.2 仓库连接
└── 3.3 前端 GitHubRepository 组件

Phase 4: Issues
├── 4.1 Issue 列表和详情
├── 4.2 AI 分析和 Spec 生成
├── 4.3 批量导入
└── 4.4 前端 GitHubIssues 组件

Phase 5: PR & Release
├── 5.1 PR 操作
├── 5.2 Release 操作
└── 5.3 前端组件
```
