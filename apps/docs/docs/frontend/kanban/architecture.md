# Vibe Kanban 架构分析报告

> 生成日期: 2026-02-06

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [前端架构](#4-前端架构)
5. [后端架构](#5-后端架构)
6. [AI 智能体执行器](#6-ai-智能体执行器)
7. [数据流与状态管理](#7-数据流与状态管理)
8. [构建与部署](#8-构建与部署)
9. [代码质量保障](#9-代码质量保障)
10. [关键设计模式](#10-关键设计模式)
11. [架构评估与建议](#11-架构评估与建议)

---

## 1. 项目概述

### 1.1 项目定位

Vibe Kanban 是一个 **AI 编程智能体工作流管理平台**，专为开发者设计，用于：

- 管理和切换多种 AI 编程智能体（Claude Code、Gemini、Codex、Cursor 等）
- 编排多个智能体并行或串行执行任务
- 跟踪智能体任务执行状态
- 集中管理 MCP (Model Context Protocol) 配置
- 通过 Git Worktree 实现隔离的工作环境

### 1.2 核心功能

| 功能模块 | 描述 |
|----------|------|
| 看板管理 | 任务创建、分配、状态跟踪 |
| 工作区管理 | 基于 Git Worktree 的隔离工作环境 |
| 智能体集成 | 支持 9+ 种 AI 编程智能体 |
| 代码审查 | 差异对比、PR 管理 |
| 终端集成 | 内置终端支持 |
| 远程同步 | 云端同步和协作 |

---

## 2. 技术栈

### 2.1 前端技术栈

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Stack                          │
├─────────────────────────────────────────────────────────────┤
│  Framework     │ React 18.2 + TypeScript 5.9                │
│  Build Tool    │ Vite 5.0                                   │
│  Routing       │ React Router DOM 6.8                       │
│  State         │ Zustand 4.x (客户端) + TanStack Query 5.x  │
│  UI Library    │ Radix UI + shadcn/ui                       │
│  Styling       │ Tailwind CSS 4.1                           │
│  Animation     │ Framer Motion                              │
│  Icons         │ Phosphor Icons + Lucide React              │
│  i18n          │ i18next (7 种语言)                         │
│  DnD           │ @dnd-kit + @hello-pangea/dnd               │
│  Editor        │ CodeMirror + Lexical                       │
│  Terminal      │ xterm.js                                   │
│  Analytics     │ PostHog + Sentry                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 后端技术栈

```
┌─────────────────────────────────────────────────────────────┐
│                      Backend Stack                           │
├─────────────────────────────────────────────────────────────┤
│  Language      │ Rust (Edition 2021)                        │
│  Web Framework │ Axum                                       │
│  Database      │ SQLite + SQLx                              │
│  Async Runtime │ Tokio                                      │
│  Serialization │ Serde + ts-rs (类型生成)                   │
│  Error Handling│ thiserror + anyhow                         │
│  Git Ops       │ git2-rs                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 目录结构

### 3.1 顶层结构

```
vibe-kanban/
├── crates/                    # Rust 后端 (Cargo Workspace)
│   ├── server/               # HTTP 服务器入口
│   ├── db/                   # 数据库层
│   ├── executors/            # AI 智能体执行器
│   ├── services/             # 业务逻辑服务
│   ├── git/                  # Git 操作封装
│   ├── utils/                # 工具函数
│   ├── remote/               # 远程服务
│   ├── deployment/           # 部署抽象
│   ├── local-deployment/     # 本地部署实现
│   └── review/               # 代码审查
│
├── frontend/                  # React 前端应用
│   ├── src/
│   │   ├── components/       # UI 组件
│   │   ├── pages/            # 页面组件
│   │   ├── hooks/            # 自定义 Hooks (~90个)
│   │   ├── stores/           # Zustand 状态
│   │   ├── contexts/         # React Context
│   │   ├── lib/              # 工具和 API
│   │   └── i18n/             # 国际化
│   └── public/
│
├── shared/                    # 前后端共享类型
├── remote-frontend/           # 远程前端版本
├── npx-cli/                   # NPM CLI 分发
├── docs/                      # 文档
├── scripts/                   # 构建脚本
└── assets/                    # 静态资源
```

### 3.2 Rust Crates 依赖关系

```
                    ┌──────────────┐
                    │    server    │  (HTTP 入口)
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ services │    │ executors│    │   git    │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
                   ┌──────────┐
                   │    db    │  (数据访问)
                   └────┬─────┘
                        │
                        ▼
                   ┌──────────┐
                   │  utils   │  (基础工具)
                   └──────────┘
```

---

## 4. 前端架构

### 4.1 组件层级

```
frontend/src/components/
├── ui/                      # 基础 UI 组件 (shadcn/ui 风格)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
│
├── ui-new/                  # 新设计系统组件
│   ├── containers/          # 页面容器
│   ├── primitives/          # 原子组件
│   ├── hooks/               # UI hooks
│   └── scope/               # 设计作用域
│
├── tasks/                   # 任务相关组件
├── panels/                  # 面板组件
├── dialogs/                 # 弹窗组件
├── layout/                  # 布局组件
├── diff/                    # 差异对比组件
├── NormalizedConversation/  # 对话展示
├── projects/                # 项目组件
└── settings/                # 设置组件
```

### 4.2 路由设计

**双设计系统路由共存：**

```typescript
// App.tsx 路由结构
<Routes>
  {/* 旧设计路由 (Legacy) */}
  <Route element={<LegacyDesignScope><NormalLayout /></LegacyDesignScope>}>
    <Route path="/" element={<Projects />} />
    <Route path="/local-projects/:projectId" element={<LocalProject />} />
    <Route path="/local-projects/:projectId/tasks" element={<ProjectTasks />} />
    <Route path="/settings/*" element={<SettingsRouter />} />
  </Route>

  {/* 新设计路由 */}
  <Route element={<NewDesignScope><SharedAppLayout /></NewDesignScope>}>
    <Route path="/workspaces" element={<WorkspacesLanding />} />
    <Route path="/workspaces/create" element={<CreateWorkspace />} />
    <Route path="/workspaces/:workspaceId" element={<Workspaces />} />
    <Route path="/projects/:projectId" element={<ProjectKanban />} />
  </Route>
</Routes>
```

### 4.3 样式系统

项目采用 **双 Tailwind 配置** 实现新旧设计系统隔离：

```javascript
// tailwind.new.config.js
module.exports = {
  darkMode: ["class"],
  important: '.new-design',  // CSS 作用域隔离
  theme: {
    extend: {
      colors: {
        high: "hsl(var(--text-high))",
        normal: "hsl(var(--text-normal))",
        low: "hsl(var(--text-low))",
        primary: "hsl(var(--bg-primary))",
        secondary: "hsl(var(--bg-secondary))",
        brand: "hsl(var(--brand))",
      },
      fontFamily: {
        'ibm-plex-sans': ['"IBM Plex Sans"', 'sans-serif'],
        'ibm-plex-mono': ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
};
```

---

## 5. 后端架构

### 5.1 API 路由结构

```rust
// crates/server/src/routes/mod.rs
pub fn router(deployment: DeploymentImpl) -> Router {
    Router::new()
        .route("/health", get(health::health_check))
        .merge(config::router())           // 配置管理
        .merge(containers::router())       // 容器管理
        .merge(projects::router())         // 项目 CRUD
        .merge(tasks::router())            // 任务管理
        .merge(task_attempts::router())    // 任务执行尝试
        .merge(execution_processes::router())  // 执行进程
        .merge(sessions::router())         // 会话管理
        .merge(terminal::router())         // 终端操作
        .merge(events::router())           // SSE 事件流
        .merge(oauth::router())            // OAuth 认证
        .nest("/images", images::routes()) // 图片服务
        .with_state(deployment)
}
```

### 5.2 API 端点清单

| 模块 | 路径前缀 | 功能 |
|------|----------|------|
| projects | `/api/projects` | 项目 CRUD |
| tasks | `/api/tasks` | 任务管理 |
| task_attempts | `/api/task-attempts` | 任务执行记录 |
| execution_processes | `/api/processes` | 进程管理 |
| sessions | `/api/sessions` | 会话管理 |
| terminal | `/api/terminal` | 终端操作 |
| config | `/api/config` | 配置管理 |
| oauth | `/api/oauth` | OAuth 认证 |
| events | `/api/events` | SSE 事件推送 |
| images | `/api/images` | 图片服务 |

### 5.3 数据库设计

**核心表结构：**

```sql
-- 项目表
CREATE TABLE projects (
    id            BLOB PRIMARY KEY,
    name          TEXT NOT NULL,
    git_repo_path TEXT NOT NULL DEFAULT '' UNIQUE,
    setup_script  TEXT DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- 任务表
CREATE TABLE tasks (
    id          BLOB PRIMARY KEY,
    project_id  BLOB NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo','inprogress','done','cancelled','inreview')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 工作区表
CREATE TABLE workspaces (
    id           BLOB PRIMARY KEY,
    name         TEXT NOT NULL,
    project_id   BLOB NOT NULL,
    worktree_path TEXT,
    branch_name  TEXT,
    created_at   TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 5.4 服务层架构

```
crates/services/src/services/
├── container.rs           # 执行进程容器管理
├── worktree_manager.rs    # Git Worktree 管理
├── workspace_manager.rs   # 工作区生命周期
├── file_search.rs         # 文件搜索
├── diff_stream.rs         # 差异流服务
├── events.rs              # SSE 事件推送
├── approvals.rs           # 审批工作流
├── notification.rs        # 系统通知
├── analytics.rs           # 使用分析
└── remote_client.rs       # 远程服务通信
```

---

## 6. AI 智能体执行器

### 6.1 支持的智能体

```rust
// crates/executors/src/executors/mod.rs
#[enum_dispatch(CodingAgent)]
pub enum CodingAgent {
    ClaudeCode,     // Claude Code (Anthropic)
    Amp,            // Amp
    Gemini,         // Google Gemini
    Codex,          // OpenAI Codex
    Opencode,       // Opencode
    CursorAgent,    // Cursor
    QwenCode,       // 通义千问 (Qwen)
    Copilot,        // GitHub Copilot
    Droid,          // Droid
}
```

### 6.2 执行器 Trait 设计

```rust
#[async_trait]
pub trait StandardCodingAgentExecutor {
    /// 启动新的智能体进程
    async fn spawn(
        &self,
        current_dir: &Path,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError>;

    /// 继续已有会话
    async fn spawn_follow_up(
        &self,
        current_dir: &Path,
        prompt: &str,
        session_id: &str,
        reset_to_message_id: Option<&str>,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError>;

    /// 标准化日志输出
    fn normalize_logs(&self, raw_logs: Arc<MsgStore>, worktree_path: &Path);

    /// 默认 MCP 配置路径
    fn default_mcp_config_path(&self) -> Option<PathBuf>;

    /// 获取可用性信息
    fn get_availability_info(&self) -> AvailabilityInfo;
}
```

### 6.3 执行器架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    CodingAgent Enum                          │
│  (enum_dispatch 自动实现 trait 方法分发)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  ClaudeCode   │   │    Gemini     │   │    Codex      │
│  Executor     │   │   Executor    │   │   Executor    │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  StandardCodingAgent    │
              │      Executor Trait     │
              └─────────────────────────┘
```

---

## 7. 数据流与状态管理

### 7.1 状态管理架构

```
┌─────────────────────────────────────────────────────────────┐
│                     State Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │   TanStack      │     │    Zustand      │                │
│  │    Query        │     │    Stores       │                │
│  │  (服务端状态)    │     │  (客户端状态)    │                │
│  └────────┬────────┘     └────────┬────────┘                │
│           │                       │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│                       ▼                                      │
│           ┌─────────────────────┐                           │
│           │   React Context     │                           │
│           │   (依赖注入)         │                           │
│           └─────────────────────┘                           │
│                       │                                      │
│                       ▼                                      │
│           ┌─────────────────────┐                           │
│           │   React Components  │                           │
│           └─────────────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Zustand Store 示例

```typescript
// stores/useUiPreferencesStore.ts
export const useUiPreferencesStore = create<State>()((set, get) => ({
  // 布局状态
  layoutMode: 'workspaces' as LayoutMode,
  isLeftSidebarVisible: true,
  isRightSidebarVisible: true,
  isTerminalVisible: true,

  // 工作区面板状态
  workspacePanelStates: {},

  // 看板过滤状态
  kanbanFilters: DEFAULT_KANBAN_FILTER_STATE,

  // Actions
  toggleLeftSidebar: () =>
    set((s) => ({ isLeftSidebarVisible: !s.isLeftSidebarVisible })),

  setLayoutMode: (mode) => set({ layoutMode: mode }),
}));
```

### 7.3 Context 层级

```typescript
// App.tsx - Provider 嵌套结构
function App() {
  return (
    <BrowserRouter>
      <UserSystemProvider>          {/* 用户系统 */}
        <ClickedElementsProvider>   {/* 点击元素追踪 */}
          <ProjectProvider>         {/* 项目上下文 */}
            <HotkeysProvider>       {/* 快捷键 */}
              <AppContent />
            </HotkeysProvider>
          </ProjectProvider>
        </ClickedElementsProvider>
      </UserSystemProvider>
    </BrowserRouter>
  );
}
```

---

## 8. 构建与部署

### 8.1 构建流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Build Pipeline                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 类型生成                                                 │
│     npm run generate-types                                   │
│     (Rust ts-rs → TypeScript)                               │
│                                                              │
│  2. 前端构建                                                 │
│     cd frontend && pnpm build                               │
│     (Vite → dist/)                                          │
│                                                              │
│  3. 后端构建                                                 │
│     cargo build --release                                   │
│     (Rust → target/release/server)                          │
│                                                              │
│  4. 打包分发                                                 │
│     - NPX CLI (多平台二进制)                                 │
│     - Docker 镜像                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 部署方式

| 方式 | 命令 | 说明 |
|------|------|------|
| NPX | `npx vibe-kanban` | 最简单的安装方式 |
| Docker | `docker run vibe-kanban` | 容器化部署 |
| 源码构建 | `./local-build.sh` | 本地开发构建 |

### 8.3 CI/CD 流水线

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      # Rust 检查
      - run: cargo fmt --all -- --check
      - run: cargo clippy --all --all-targets -- -D warnings
      - run: cargo test --workspace

      # 类型同步检查
      - run: npm run generate-types:check

      # 前端检查
      - run: cd frontend && npm run lint
      - run: cd frontend && npx tsc --noEmit
      - run: cd frontend && npm run format:check
```

---

## 9. 代码质量保障

### 9.1 类型安全

**共享类型自动生成：**

```typescript
// shared/types.ts (由 Rust 自动生成)
export type Project = {
  id: string,
  name: string,
  default_agent_working_dir: string | null,
  remote_project_id: string | null,
  created_at: Date,
  updated_at: Date,
};

export type TaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";
```

### 9.2 代码规范

| 领域 | 工具 | 配置文件 |
|------|------|----------|
| Rust 格式化 | rustfmt | `rustfmt.toml` |
| Rust Lint | Clippy | - |
| TS/JS Lint | ESLint | `.eslintrc.cjs` |
| TS/JS 格式化 | Prettier | `.prettierrc` |
| i18n 检查 | eslint-plugin-i18next | - |

### 9.3 测试策略

| 类型 | 状态 | 说明 |
|------|------|------|
| Rust 单元测试 | ✅ | `cargo test --workspace` |
| Rust Lint | ✅ | Clippy + rustfmt |
| 前端类型检查 | ✅ | TypeScript strict mode |
| 前端 Lint | ✅ | ESLint |
| 前端单元测试 | ❌ | 暂无 |
| E2E 测试 | ❌ | 暂无 |

---

## 10. 关键设计模式

### 10.1 复合组件模式 (Compound Components)

```typescript
// 通过 Context 共享状态的组件组合
function ProjectKanban() {
  return (
    <ProjectProvider>
      <ProjectMutationsRegistration>
        <KanbanBoard />
        <TaskDetailPanel />
      </ProjectMutationsRegistration>
    </ProjectProvider>
  );
}
```

### 10.2 设计作用域隔离

```typescript
// 新旧设计系统共存
function LegacyDesignScope({ children }) {
  return <div className="legacy-design">{children}</div>;
}

function NewDesignScope({ children }) {
  return <div className="new-design">{children}</div>;
}
```

### 10.3 错误边界

```typescript
// Sentry 错误边界
<Sentry.ErrorBoundary
  fallback={<ErrorFallback />}
  showDialog
>
  <App />
</Sentry.ErrorBoundary>
```

### 10.4 Result 类型模式

```typescript
// 类型安全的错误处理
export type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> { ok: true; value: T; }
interface Err<E> { ok: false; error: E; }
```

---

## 11. 架构评估与建议

### 11.1 优势

| 方面 | 评价 |
|------|------|
| **模块化** | Rust Workspace 和前端组件划分清晰 |
| **类型安全** | TypeScript + Rust 强类型，自动类型同步 |
| **可扩展性** | 智能体执行器通过 Trait 实现可插拔 |
| **现代化** | React 18、TanStack Query、Zustand 等主流技术 |
| **国际化** | 支持 7 种语言 |
| **CI/CD** | 完善的 GitHub Actions 自动化 |

### 11.2 待改进

| 方面 | 问题 | 建议 |
|------|------|------|
| **测试** | 缺少前端单元测试 | 添加 Vitest + React Testing Library |
| **设计系统** | 新旧设计并存的技术债务 | 制定迁移计划，逐步统一 |
| **文档** | API 文档不完整 | 添加 OpenAPI/Swagger 文档 |
| **错误处理** | 前端错误处理不一致 | 统一错误处理模式 |

### 11.3 架构成熟度评估

```
┌─────────────────────────────────────────────────────────────┐
│              Architecture Maturity Radar                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    代码质量                                  │
│                       ████████░░  8/10                       │
│                                                              │
│   可维护性                              可扩展性             │
│   ████████░░  8/10              ████████████  9/10          │
│                                                              │
│   测试覆盖                              文档完整性           │
│   ████░░░░░░  4/10              ██████░░░░  6/10            │
│                                                              │
│                    性能优化                                  │
│                       ████████░░  7/10                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录

### A. 关键文件索引

| 文件 | 说明 |
|------|------|
| `crates/server/src/main.rs` | 后端入口 |
| `crates/server/src/routes/mod.rs` | API 路由定义 |
| `crates/executors/src/executors/mod.rs` | 智能体执行器 |
| `crates/db/src/lib.rs` | 数据库服务 |
| `frontend/src/App.tsx` | 前端入口 |
| `frontend/src/main.tsx` | React 根组件 |
| `shared/types.ts` | 共享类型定义 |

### B. 开发命令速查

```bash
# 开发
pnpm dev                    # 启动前后端开发服务器
npm run generate-types      # 生成 TypeScript 类型

# 构建
./local-build.sh           # 本地构建
docker build -t vibe-kanban .  # Docker 构建

# 测试
cargo test --workspace     # Rust 测试
cd frontend && npm run lint    # 前端 Lint
cd frontend && npx tsc --noEmit  # 类型检查
```

---

*报告生成完成*
