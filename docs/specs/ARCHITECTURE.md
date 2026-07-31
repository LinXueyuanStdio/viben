# Viben 项目架构报告

> **版本**: 0.2.0
> **更新日期**: 2026-03-02
> **项目描述**: Multi-agent workspace manager with kanban, calendar, timeline, and task management

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [应用分析](#4-应用分析)
5. [共享包分析](#5-共享包分析)
6. [后端服务](#6-后端服务)
7. [数据流与架构模式](#7-数据流与架构模式)
8. [构建与部署](#8-构建与部署)

---

## 1. 项目概览

### 1.1 项目定位

**Viben** 是一个多智能体工作区管理器，包含以下核心产品：

| 产品 | 描述 | 技术 |
|------|------|------|
| **Web 应用** | MCP/Skill 包市场，社交功能 | Next.js 15 + PostgreSQL |
| **桌面应用** | 本地智能体编排与任务管理 | Tauri 2 + React 19 |
| **CLI 工具** | 命令行智能体管理 | TypeScript + Commander |
| **MCP 服务器** | 学术论文搜索服务 (18 个数据源) | Python + FastMCP |

### 1.2 核心架构特点

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Viben 架构概览                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│   │   Web   │     │ Desktop │     │   CLI   │     │  Docs   │          │
│   │ (Next)  │     │ (Tauri) │     │  (Node) │     │(Docusr) │          │
│   └────┬────┘     └────┬────┘     └────┬────┘     └─────────┘          │
│        │               │               │                                │
│        │               └───────┬───────┘                                │
│        │                       │                                        │
│        │            ┌──────────┴──────────┐                             │
│        │            │   Viben Gateway     │                             │
│        │            │   (Fastify :18790)  │                             │
│        │            └──────────┬──────────┘                             │
│        │                       │                                        │
│        └───────────────────────┼────────────────────────────────────────│
│                                │                                        │
│              ┌─────────────────┴─────────────────┐                      │
│              │          @viben/core              │                      │
│   ┌──────────┼──────────┬────────────┬──────────┼──────────┐           │
│   │          │          │            │          │          │           │
│   │ Gateway  │ Services │ Executors  │ Configs  │  GitHub  │           │
│   │ (40+API) │ (11 svc) │ (9 agents) │ (YAML)   │  (API)   │           │
│   └──────────┴──────────┴────────────┴──────────┴──────────┘           │
│                                                                         │
│   ┌──────────┬──────────┬────────────┐                                  │
│   │  @viben  │  @viben  │   @viben   │                                  │
│   │   /ui    │  /kanban │ /api-client│                                  │
│   └──────────┴──────────┴────────────┘                                  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────┐           │
│   │                  Python 后端服务                         │           │
│   │   browse-mcp (学术搜索)                                   │           │
│   └─────────────────────────────────────────────────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

### 2.1 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | ^19.0.0 / ^19.1.0 | 所有应用的 UI 框架 |
| **Next.js** | ^15.5.11 | Web 应用 (apps/web) |
| **React Router DOM** | ^7.13.0 | 桌面应用路由 |
| **Docusaurus** | ^3.7.0 | 文档站点 |

### 2.2 桌面框架

| 技术 | 版本 | 用途 |
|------|------|------|
| **Tauri** | 2.x | 原生桌面应用 |
| **tauri-plugin-sql** | 2 (SQLite) | 本地数据库 |
| **tauri-plugin-fs** | 2.4.5 | 文件系统访问 |
| **tauri-plugin-shell** | 2.3.4 | Shell 命令执行 |
| **tauri-plugin-deep-link** | 2 | OAuth 回调处理 |

### 2.3 构建工具

| 工具 | 版本 | 用途 |
|------|------|------|
| **Turborepo** | ^2.3.0 | Monorepo 构建编排 |
| **Vite** | ^7.0.4 | 桌面应用打包 |
| **tsup** | ^8.0.0 | 包打包 |
| **pnpm** | 9.15.0 | 包管理器 |

### 2.4 数据库与存储

| 技术 | 位置 | 用途 |
|------|------|------|
| **PostgreSQL + Drizzle ORM** | apps/web | Web 应用数据库 (Neon serverless) |
| **SQLite** | apps/desktop | 桌面本地存储 |
| **Zustand** | apps/desktop | 客户端状态持久化 |

### 2.5 状态管理

| 技术 | 用途 |
|------|------|
| **Zustand** | 桌面应用全局状态 + 持久化 |
| **TanStack Query** | 桌面应用异步状态/缓存管理 |
| **React Context** | 组件局部状态共享 |

### 2.6 样式方案

| 技术 | 用途 |
|------|------|
| **TailwindCSS** | v3.4 (web), v4.1 (desktop) |
| **Radix UI** | 无障碍组件原语 |
| **CVA** | 变体样式管理 |
| **tailwind-merge** | 类名合并 |
| **Framer Motion** | 动画 |

### 2.7 后端技术

| 技术 | 语言 | 用途 |
|------|------|------|
| **FastMCP** | Python | MCP 服务器实现 |
| **Poetry** | Python | 依赖管理 |
| **Rust** | Rust | Tauri 后端 |

---

## 3. 项目结构

### 3.1 根目录组织

```
viben/
├── apps/                    # 应用包
│   ├── web/                 # Next.js Web 应用 (市场)
│   ├── desktop/             # Tauri 桌面应用
│   └── docs/                # Docusaurus 文档站点
│
├── packages/                # 共享 TypeScript 包
│   ├── api-client/          # API 客户端库
│   ├── cli/                 # 命令行界面
│   ├── core/                # 核心配置/智能体管理/Gateway
│   ├── kanban/              # 看板组件库
│   ├── ui/                  # 共享 UI 组件库
│   └── vibe-kanban/         # 外部看板组件符号链接
│
├── backend/                 # Python 后端服务
│   ├── browse-mcp/          # 学术论文搜索 MCP 服务器
│   └── plugins/             # 插件系统
│
├── homebrew/                # Homebrew tap 支持
├── scripts/                 # 构建/发布脚本
├── design-system/           # 设计系统资源
│
├── package.json             # 根包配置
├── pnpm-workspace.yaml      # pnpm 工作区配置
└── turbo.json               # Turborepo 配置
```

### 3.2 Monorepo 配置

**pnpm-workspace.yaml**:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**turbo.json**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## 4. 应用分析

### 4.1 apps/web (@viben/web)

**定位**: Web 端市场和包注册中心

**核心功能**:
- MCP 包市场 (搜索、浏览、发布)
- Skill 包市场
- 用户认证 (邮箱 + GitHub OAuth)
- 工作区管理
- Collections (精选包列表)
- 社交功能 (收藏、评分、评论)
- 管理面板 (审核)

**目录结构**:
```
apps/web/
├── app/
│   ├── (admin)/              # 管理路由
│   ├── (auth)/               # 认证路由 (登录、注册)
│   ├── (dashboard)/          # 用户仪表盘
│   └── api/                  # API 路由
│       ├── auth/             # 认证端点
│       ├── mcp/              # MCP 包 CRUD
│       ├── skills/           # Skill 包 CRUD
│       ├── workspaces/       # 工作区管理
│       ├── collections/      # Collection 管理
│       └── admin/            # 管理端点
├── components/               # React 组件
├── lib/
│   └── db/                   # Drizzle schema & 迁移
└── hooks/                    # 自定义 React hooks
```

**数据库 Schema** 核心表:

| 表名 | 描述 |
|------|------|
| `users` | 用户账户 (角色: user, developer, admin, super_admin, moderator, support) |
| `apiKeys` | API 密钥 (程序化访问) |
| `oauthConnections` | OAuth 提供商连接 |
| `organizations` | 组织账户 |
| `mcpPackages` | MCP 包注册表 |
| `skillPackages` | Skill 包注册表 |
| `collections` | 精选包合集 |
| `favorites`, `ratings`, `comments` | 社交功能 |
| `workspaces` | 用户工作区 |
| `reports`, `moderationLogs` | 管理/审核 |

---

### 4.2 apps/desktop (@viben/desktop)

**定位**: 本地多智能体工作区管理桌面应用

**核心功能**:
- MCP 服务器管理 (启动/停止/监控)
- 智能体配置与编排
- Provider/Model 管理
- 看板任务管理
- AI 智能体聊天界面
- Skills 市场集成
- 离线缓存
- 系统托盘集成
- OAuth 认证流程

**目录结构**:
```
apps/desktop/
├── src/
│   ├── components/
│   │   ├── chat/             # 聊天 UI 组件
│   │   ├── kanban/           # 看板
│   │   ├── settings/         # 设置面板
│   │   ├── marketplace/      # 包浏览器
│   │   ├── workspace/        # 工作区管理
│   │   └── ui/               # 基础 UI 组件
│   ├── pages/                # 路由页面
│   ├── stores/               # Zustand stores
│   ├── hooks/                # 自定义 hooks
│   ├── db/                   # SQLite 数据库层
│   ├── i18n/                 # 国际化
│   └── lib/                  # 工具函数
├── src-tauri/
│   ├── src/
│   │   ├── commands/         # Tauri IPC 命令
│   │   └── lib.rs            # Tauri 主入口
│   └── Cargo.toml            # Rust 依赖
└── public/                   # 静态资源
```

**Tauri IPC 命令** (核心):

| 命令模块 | 功能 |
|----------|------|
| `commands::mcp` | MCP 服务器生命周期 (启动、停止、状态) |
| `commands::agents` | 智能体配置读写 |
| `commands::viben_agents` | Viben 智能体列表管理 |
| `commands::auth` | 凭证管理, GitHub OAuth |
| `commands::kanban` | 看板数据持久化 |
| `commands::sync` | 云同步 (工作区、包) |
| `commands::cache` | 离线缓存 |

**状态管理** (Zustand Store):

```typescript
// apps/desktop/src/stores/app-store.ts
interface AppState {
  selectedPython: string | null;       // Python 解释器选择
  providers: DataProvider[];           // 数据源提供商 (18 个学术源)
  apiKeys: Record<string, string>;     // API 密钥存储
  mcpServers: McpServerState[];        // 多个 MCP 服务器实例
  agentAssignments: Record<string, string>; // 智能体-服务器映射
  theme: 'light' | 'dark' | 'system';  // UI 主题
  language: 'en' | 'zh-CN';            // 语言
  shortcuts: Record<string, string>;   // 键盘快捷键
  onboardingCompleted: boolean;        // 引导完成状态
}
```

---

### 4.3 apps/docs (@viben/docs)

**定位**: 文档站点

**核心功能**:
- 多语言支持 (英文、中文)
- Mermaid 图表支持
- 博客
- API 文档

**技术**: Docusaurus 3.7.0

---

## 5. 共享包分析

### 5.1 @viben/core

**定位**: 配置、智能体、Provider、Model、Gateway、Services 的共享核心库

**导出模块**:
```typescript
// 配置管理
export { ConfigManager, getStateDir, getConfigPath, ... }

// 智能体管理
export { AgentManager, agentManager }

// Provider 管理
export { ProviderManager, providerManager }

// Model 管理
export { ModelManager, modelManager, KNOWN_MODELS }

// MCP 管理
export { McpManager, mcpManager }

// Skills 管理
export { SkillsManager, skillsManager }

// Executors - AI 编程代理执行器
export { createExecutor, EXECUTOR_TYPES, spawnChat }

// Gateway - HTTP/WebSocket API 网关
export { startGateway, registerRoutes }

// Services - 后台服务管理
export { ServiceManager, EventService, SessionStoreService, CronService }
```

**目录结构**:
```
packages/core/src/
├── agents/       # 智能体配置与管理
├── channels/     # 消息通道管理
├── cli/          # CLI 命令实现
├── config/       # 配置文件管理
├── db/           # 数据库模型 (SQLite)
├── executors/    # AI 编程代理执行器
├── gateway/      # HTTP/WS API 网关
├── group-chat/   # 群聊功能
├── mcp/          # MCP 服务器配置
├── models/       # 模型定义与发现
├── notifications/# 通知系统
├── providers/    # Provider 配置
├── services/     # 后台服务
├── skills/       # Skills 管理
├── team/         # 团队功能
├── telemetry/    # 遥测与日志
├── types/        # 共享类型定义
├── workspace/    # 工作区管理
├── browser.ts    # 浏览器安全导出
└── index.ts      # 主导出
```

#### 5.1.1 Executors - AI 编程代理执行器

支持多种 AI 编程代理的统一执行器接口：

| 执行器 | CLI 工具 | 描述 |
|--------|----------|------|
| **CLAUDE_CODE** | `claude` | Claude Code CLI |
| **AMP** | `amp` | Amp Code Agent |
| **GEMINI** | `gemini` | Google Gemini CLI |
| **CODEX** | `codex` | OpenAI Codex |
| **OPENCODE** | `opencode` | Opencode CLI |
| **CURSOR_AGENT** | `cursor` | Cursor Agent |
| **QWEN_CODE** | `qwen` | Qwen Code |
| **COPILOT** | `copilot` | GitHub Copilot |
| **DROID** | `droid` | Droid Agent |

```typescript
// 创建执行器
const executor = createExecutor("CLAUDE_CODE");
const availability = executor.getAvailabilityInfo();

// 支持非交互式聊天的执行器
const CHAT_SUPPORTED_EXECUTORS = ["CLAUDE_CODE", "GEMINI", "CODEX"];
```

#### 5.1.2 Gateway - HTTP/WebSocket API 网关

运行在端口 **18790** 的 Fastify 网关，提供 40+ API 路由：

| 路由模块 | 端点前缀 | 功能 |
|----------|----------|------|
| **health** | `/health` | 健康检查 |
| **agents** | `/api/agent` | 智能体 CRUD |
| **sessions** | `/api/sessions` | 会话管理 |
| **executors** | `/api/executors` | 执行器管理 |
| **models** | `/api/models` | 模型配置 |
| **providers** | `/api/providers` | Provider 配置 |
| **channels** | `/api/channels` | 消息通道 |
| **cron** | `/api/cron` | 定时任务 |
| **mcp** | `/api/mcp` | MCP 服务器管理 |
| **mcp-inspector** | `/api/mcp-inspector` | MCP 调试器 |
| **workspaces** | `/api/workspaces` | 工作区 |
| **group-chats** | `/api/group-chats` | 群聊 |
| **chat-list** | `/api/chat-list` | 聊天列表 |
| **agent-run** | `/api/agent-run` | 智能体运行 (SSE) |
| **agent-ws** | `/api/agent-ws` | 智能体 WebSocket |
| **files** | `/api/files` | 文件操作 |
| **filesystem** | `/api/filesystem` | 文件系统浏览 |
| **terminal** | `/api/terminal` | 终端会话 |
| **history** | `/api/history` | 历史记录 |
| **telemetry** | `/api/telemetry` | 遥测数据 |
| **sandbox** | `/api/sandbox` | 沙箱执行 |
| **commands** | `/api/commands` | 命令执行 |
| **python** | `/api/python` | Python 环境 |
| **service-keys** | `/api/service-keys` | 服务密钥 |
| **usage** | `/api/usage` | 使用统计 |
| **installed-sources** | `/api/installed-sources` | 已安装源 |
| **logs** | `/api/logs` | 日志查看 |
| **marketplace** | `/api/marketplace` | 市场集成 |
| **official-registry** | `/api/official-registry` | 官方注册表 |
| **cache** | `/api/cache` | 缓存管理 |
| **tunnel** | `/api/tunnel` | 隧道服务 |
| **kanban-data** | `/api/kanban-data` | 看板数据 |
| **packages** | `/api/packages` | 包管理 |
| **github** | `/api/github` | GitHub 集成 |
| **tasks** | `/api/tasks` | 任务管理 |
| **events** | `/api/events` | 事件流 (SSE) |
| **ws** | `/ws` | WebSocket |

#### 5.1.3 Services - 后台服务

| 服务 | 描述 |
|------|------|
| **EventService** | 事件广播与流 |
| **SessionStoreService** | 文件式会话持久化 |
| **CronService** | 定时任务管理 |
| **ContainerService** | 进程派生与管理 |
| **HistoryService** | 智能体历史管理 |
| **MessageBus** | 通道消息路由 |
| **ServiceManager** | 后台服务管理 (MCP、Gateway、Viben) |
| **BackgroundTaskManager** | 后台任务管理 (观察者模式) |
| **AgentService** | 智能体会话生命周期、计划审批 |
| **SandboxService** | 隔离代码执行 (多 Provider) |
| **GitHubService** | GitHub 集成 (认证、仓库、Issue、PR、Release) |

#### 5.1.4 GitHub 集成

新增的 GitHub 服务模块，支持：

- **认证**: gh CLI / Personal Access Token (PAT)
- **仓库管理**: 连接、配置、信息获取
- **Issue 管理**: 列表、详情、评论、调查分析
- **Pull Request**: 列表、创建、详情
- **Release**: 列表、创建、资产管理
- **Issue 导入**: 导入 Issue 为 Spec 文件

配置文件存储在 `~/.viben/workspaces/{workspace_id}/github.yaml`

```typescript
interface GitHubConfig {
  auth?: GitHubAuth;           // 认证信息
  repository?: GitHubRepositoryConfig;  // 连接的仓库
  preferences?: GitHubPreferences;      // 用户偏好
}
```

---

### 5.2 @viben/api-client

**定位**: Viben 平台 TypeScript API 客户端

**使用示例**:
```typescript
import { VibenClient } from '@viben/api-client';

const client = new VibenClient({
  baseUrl: 'https://viben-web.vercel.app',
  apiKey: 'viben_xxx...',
});

// 列出 MCP 包
const { packages } = await client.mcp.list({ page: 1 });

// 搜索 skills
const { packages: skills } = await client.skill.search('git');
```

---

### 5.3 @viben/kanban

**定位**: 功能丰富的看板组件库

**核心组件**:

| 组件 | 描述 |
|------|------|
| `KanbanProvider` | 看板上下文提供者 |
| `KanbanBoard` | 看板主组件 |
| `KanbanCard` | 任务卡片 |
| `PrioritySelector` | 优先级选择器 |
| `AssigneeManager` | 负责人管理 |
| `DueDatePicker` | 截止日期选择 |
| `TagManager` | 标签系统 |
| `FilterSystem` | 过滤系统 |
| `SubtaskManager` | 子任务管理 |
| `BulkActions` | 批量操作 |
| `RelationshipTracker` | 关系追踪 (阻塞关系) |
| `ActivityFeed` | 活动流 |
| `CommentList` | 评论列表 |

**依赖**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@viben/ui`

---

### 5.4 @viben/ui

**定位**: 共享 UI 组件库 (基于 Radix)

**组件列表**:
- Avatar, Badge, Breadcrumb
- Button, Card, Dialog
- Dropdown Menu, Input, Label
- Scroll Area, Select, Separator
- Skeleton, Switch, Tabs
- Textarea, Tooltip

**构建基础**: Radix UI 原语 + TailwindCSS

---

### 5.5 viben (CLI)

**定位**: AI 智能体集群编排 CLI

**依赖**: `commander`, `chalk`, `yaml`

**二进制**: `viben` (通过 npm 全局安装)

---

## 6. 后端服务

### 6.1 browse-mcp

**定位**: 学术论文搜索 Python MCP 服务器

**支持的数据源** (18 个):

| 类别 | 数据源 |
|------|--------|
| **免费** | arXiv, PubMed, PMC, bioRxiv, medRxiv, Google Scholar, Semantic Scholar, CORE, Crossref, IACR |
| **需 API Key** | ScienceDirect, Springer, IEEE Xplore, Scopus |
| **机构访问** | ACM, Web of Science, JSTOR, ResearchGate |

**架构**: 使用 `stevedore` 的插件化搜索器

---

## 7. 数据流与架构模式

### 7.1 包依赖关系图

```
                    @viben/core
                        │
          ┌─────────────┼─────────────┐
          │             │             │
      @viben/ui    @viben/api-client  │
          │             │             │
    @viben/kanban       │             │
          │             │             │
          └─────────────┼─────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
     @viben/web                 @viben/desktop
```

### 7.2 数据流模式

**桌面应用数据流**:
```
用户操作 → React 组件 → Zustand Store → Tauri 命令 (IPC)
                ↓                              ↓
           React Query ←────── 响应 ←──── Rust 后端
                ↓
           UI 状态更新
```

**Web 应用数据流**:
```
用户操作 → React 组件 → API 路由处理器 → Drizzle ORM → PostgreSQL
                ↓                                        ↓
          服务器响应 ←─────────────────────────────────┘
```

### 7.3 状态管理模式

**桌面应用 (Zustand + 持久化)**:
```typescript
// apps/desktop/src/stores/app-store.ts
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 带 getters/setters 的状态
    }),
    {
      name: "viben-storage",
      partialize: (state) => ({ /* 持久化的键 */ }),
    }
  )
);
```

**Web 应用 (服务端 + Drizzle)**:
```typescript
// 通过 Drizzle ORM 进行数据库操作
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { workspaces: true }
});
```

### 7.4 API 模式

**Web API 路由** (Next.js App Router):
```
/api/auth/*           # 认证
/api/mcp/*            # MCP 包 CRUD
/api/skill/*          # Skill 包 CRUD
/api/workspaces/*     # 工作区管理
/api/collections/*    # Collections
/api/admin/*          # 管理端点
```

**桌面 IPC 命令** (Tauri):
```rust
// 通过 invoke_handler 暴露的命令
commands::mcp::start_mcp_server
commands::agents::read_agent_config
commands::viben_agents::viben_list_agents
```

### 7.5 核心架构模式

| 模式 | 描述 |
|------|------|
| **Monorepo + Turborepo** | 共享包、并行构建、缓存 |
| **混合应用架构** | Web (Next.js) + Desktop (Tauri + Vite) |
| **共享核心库** | TypeScript (@viben/core) 提供配置、Gateway、执行器等 |
| **插件架构** | browse-mcp 使用 stevedore 实现可扩展搜索器 |
| **离线优先桌面** | SQLite 本地存储 + 云同步 |
| **组件库模式** | Radix 原语封装为 @viben/ui |

---

## 8. 构建与部署

### 8.1 构建命令

```bash
# 全量构建
pnpm build

# 类型检查
pnpm typecheck

# 开发模式
pnpm dev

# 清理
pnpm clean

# 格式化
pnpm format
```

### 8.2 应用特定命令

**Web 应用**:
```bash
cd apps/web
pnpm dev          # 开发服务器
pnpm build        # 生产构建
pnpm db:push      # 推送数据库 schema
pnpm db:studio    # 打开 Drizzle Studio
```

**桌面应用**:
```bash
cd apps/desktop
pnpm dev          # 开发模式 (Vite + Tauri)
pnpm build        # 生产构建
pnpm tauri dev    # Tauri 开发模式
pnpm tauri build  # Tauri 生产构建
```

### 8.3 发布流程

- **Web**: Vercel 自动部署
- **桌面**: GitHub Actions + Tauri 构建
- **CLI**: npm publish + Homebrew tap

---

## 附录

### A. 关键配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 根包配置 |
| `pnpm-workspace.yaml` | 工作区定义 |
| `turbo.json` | Turborepo 任务配置 |
| `tsconfig.json` | TypeScript 配置 |
| `apps/web/drizzle.config.ts` | Drizzle ORM 配置 |
| `apps/desktop/src-tauri/Cargo.toml` | Rust 依赖 |
| `apps/desktop/src-tauri/tauri.conf.json` | Tauri 配置 |

### B. 环境变量

**Web 应用** (apps/web/.env):
```
DATABASE_URL=           # PostgreSQL 连接字符串
NEXTAUTH_SECRET=        # NextAuth 密钥
GITHUB_CLIENT_ID=       # GitHub OAuth
GITHUB_CLIENT_SECRET=   # GitHub OAuth
```

**桌面应用**: 通过 Tauri 安全存储管理敏感信息

### C. 版本信息

| 组件 | 版本 |
|------|------|
| Node.js | >=20.0.0 |
| pnpm | 9.15.0 |
| React | ^19.0.0 |
| Next.js | ^15.5.11 |
| Tauri | 2.x |
| TailwindCSS | v3.4 (web), v4.1 (desktop) |
