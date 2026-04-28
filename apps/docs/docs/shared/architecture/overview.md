# Viben Project Architecture Report

> **Version**: 0.2.0
> **Updated**: 2026-04-28
> **Project Description**: Multi-agent workspace manager with kanban, calendar, timeline, and task management

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Application Analysis](#4-application-analysis)
5. [Shared Packages Analysis](#5-shared-packages-analysis)
6. [Backend Services](#6-backend-services)
7. [Data Flow and Architecture Patterns](#7-data-flow-and-architecture-patterns)
8. [Build and Deployment](#8-build-and-deployment)

---

## 1. Project Overview

### 1.1 Project Positioning

**Viben** is a multi-agent workspace manager. Core products include:

| Product | Description | Technology |
|---------|-------------|------------|
| **Web Application** | MCP/Skill package marketplace, social features | Next.js 15 + PostgreSQL |
| **Desktop Application** | Local agent orchestration and task management | Tauri 2 + React 19 |
| **CLI Tool** | Command-line agent management | TypeScript + Commander |
| **MCP Server** | Academic paper search service (18 data sources) | Python + FastMCP |

### 1.2 Core Architecture

```
+-------------------------------------------------------------------------+
|                        Viben Architecture Overview                      |
+-------------------------------------------------------------------------+
|                                                                         |
|   +---------+     +---------+     +---------+     +---------+           |
|   |   Web   |     | Desktop |     |   CLI   |     |  Docs   |           |
|   | (Next)  |     | (Tauri) |     |  (Node) |     |(Docusr) |           |
|   +----+----+     +----+----+     +----+----+     +---------+           |
|        |               |               |                                |
|        |               +-------+-------+                                |
|        |                       |                                        |
|        |            +----------+----------+                             |
|        |            |   Viben Gateway     |                             |
|        |            |   (Fastify :18790)  |                             |
|        |            +----------+----------+                             |
|        |                       |                                        |
|        +-----------------------+----------------------------------------+
|                                |                                        |
|              +-----------------+-----------------+                      |
|              |          @viben/core              |                      |
|   +----------+----------+------------+----------+----------+            |
|   |          |          |            |          |          |            |
|   | Gateway  | Services | Executors  | Configs  |  GitHub  |            |
|   | (40+API) | (11 svc) | (9 agents) | (YAML)  |  (API)   |            |
|   +----------+----------+------------+----------+----------+            |
|                                                                         |
|   +----------+----------+------------+                                  |
|   |  @viben  |  @viben  |   @viben   |                                  |
|   |   /ui    |  /kanban | /api-client|                                  |
|   +----------+----------+------------+                                  |
|                                                                         |
|   +---------------------------------------------------------+           |
|   |                  Python Backend Services                 |           |
|   |   browse-mcp (Academic Search)                           |           |
|   +---------------------------------------------------------+           |
|                                                                         |
+-------------------------------------------------------------------------+
```

The Desktop and CLI applications communicate with `@viben/core` through the **Viben Gateway**, a Fastify-based HTTP/WebSocket server running on port 18790. The Web application connects to `@viben/core` directly or through the API client. This gateway layer provides a unified interface for agent orchestration, session management, and all workspace operations.

---

## 2. Technology Stack

### 2.1 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | ^19.0.0 / ^19.1.0 | UI framework for all applications |
| **Next.js** | ^15.5.11 | Web application (apps/web) |
| **React Router DOM** | ^7.13.0 | Desktop application routing |
| **Docusaurus** | ^3.7.0 | Documentation site |

### 2.2 Desktop Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tauri** | 2.x | Native desktop application |
| **tauri-plugin-sql** | 2 (SQLite) | Local database |
| **tauri-plugin-fs** | 2.4.5 | File system access |
| **tauri-plugin-shell** | 2.3.4 | Shell command execution |
| **tauri-plugin-deep-link** | 2 | OAuth callback handling |

### 2.3 Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Turborepo** | ^2.3.0 | Monorepo build orchestration |
| **Vite** | ^7.0.4 | Desktop application bundling |
| **tsup** | ^8.0.0 | Package bundling |
| **pnpm** | 9.15.0 | Package manager |

### 2.4 Database and Storage

| Technology | Location | Purpose |
|------------|----------|---------|
| **PostgreSQL + Drizzle ORM** | apps/web | Web application database (Neon serverless) |
| **SQLite** | apps/desktop | Desktop local storage |
| **Zustand** | apps/desktop | Client-side state persistence |

### 2.5 State Management

| Technology | Purpose |
|------------|---------|
| **Zustand** | Desktop application global state + persistence |
| **TanStack Query** | Desktop application async state/cache management |
| **React Context** | Component local state sharing |

### 2.6 Styling Solutions

| Technology | Purpose |
|------------|---------|
| **TailwindCSS** | v3.4 (web), v4.1 (desktop) |
| **Radix UI** | Accessible component primitives |
| **CVA** | Variant style management |
| **tailwind-merge** | Class name merging |
| **Framer Motion** | Animations |

### 2.7 Backend Technologies

| Technology | Language | Purpose |
|------------|----------|---------|
| **Fastify** | TypeScript | Viben Gateway (HTTP/WebSocket API server) |
| **FastMCP** | Python | MCP server implementation |
| **Poetry** | Python | Dependency management |
| **Rust** | Rust | Tauri desktop application backend |

---

## 3. Project Structure

### 3.1 Root Directory Organization

```
viben/
├── apps/                    # Application packages
│   ├── web/                 # Next.js Web application (marketplace)
│   ├── desktop/             # Tauri desktop application
│   └── docs/                # Docusaurus documentation site
│
├── packages/                # Shared TypeScript packages
│   ├── api-client/          # API client library
│   ├── cli/                 # Command-line interface
│   ├── core/                # Core configuration/agent management/Gateway
│   ├── kanban/              # Kanban component library
│   ├── ui/                  # Shared UI component library
│   └── vibe-kanban/         # External kanban component symlink
│
├── backend/                 # Python backend services
│   ├── browse-mcp/          # Academic paper search MCP server
│   └── plugins/             # Plugin system
│
├── homebrew/                # Homebrew tap support
├── scripts/                 # Build/release scripts
├── design-system/           # Design system assets
│
├── package.json             # Root package configuration
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── turbo.json               # Turborepo configuration
```

### 3.2 Monorepo Configuration

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

## 4. Application Analysis

### 4.1 apps/web (@viben/web)

**Positioning**: Web-based marketplace and package registry

**Core Features**:
- MCP package marketplace (search, browse, publish)
- Skill package marketplace
- User authentication (email + GitHub OAuth)
- Workspace management
- Collections (curated package lists)
- Social features (favorites, ratings, comments)
- Admin panel (moderation)

**Directory Structure**:
```
apps/web/
├── app/
│   ├── (admin)/              # Admin routes
│   ├── (auth)/               # Auth routes (login, register)
│   ├── (dashboard)/          # User dashboard
│   └── api/                  # API routes
│       ├── auth/             # Auth endpoints
│       ├── mcp/              # MCP package CRUD
│       ├── skills/           # Skill package CRUD
│       ├── workspaces/       # Workspace management
│       ├── collections/      # Collection management
│       └── admin/            # Admin endpoints
├── components/               # React components
├── lib/
│   └── db/                   # Drizzle schema & migrations
└── hooks/                    # Custom React hooks
```

**Database Schema** Core Tables:

| Table Name | Description |
|------------|-------------|
| `users` | User accounts (roles: user, developer, admin, super_admin, moderator, support) |
| `apiKeys` | API keys (programmatic access) |
| `oauthConnections` | OAuth provider connections |
| `organizations` | Organization accounts |
| `mcpPackages` | MCP package registry |
| `skillPackages` | Skill package registry |
| `collections` | Curated package collections |
| `favorites`, `ratings`, `comments` | Social features |
| `workspaces` | User workspaces |
| `reports`, `moderationLogs` | Admin/moderation |

---

### 4.2 apps/desktop (@viben/desktop)

**Positioning**: Local multi-agent workspace management desktop application

**Core Features**:
- MCP server management (start/stop/monitor)
- Agent configuration and orchestration
- Provider/Model management
- Kanban task management
- AI agent chat interface
- Skills marketplace integration
- Offline caching
- System tray integration
- OAuth authentication flow

**Directory Structure**:
```
apps/desktop/
├── src/
│   ├── components/
│   │   ├── chat/             # Chat UI components
│   │   ├── kanban/           # Kanban
│   │   ├── settings/         # Settings panel
│   │   ├── marketplace/      # Package browser
│   │   ├── workspace/        # Workspace management
│   │   └── ui/               # Base UI components
│   ├── pages/                # Route pages
│   ├── stores/               # Zustand stores
│   ├── hooks/                # Custom hooks
│   ├── db/                   # SQLite database layer
│   ├── i18n/                 # Internationalization
│   └── lib/                  # Utility functions
├── src-tauri/
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands
│   │   └── lib.rs            # Tauri main entry
│   └── Cargo.toml            # Rust dependencies
└── public/                   # Static assets
```

**Tauri IPC Commands** (Core):

| Command Module | Function |
|----------------|----------|
| `commands::mcp` | MCP server lifecycle (start, stop, status) |
| `commands::agents` | Agent configuration read/write |
| `commands::viben_agents` | Viben agent list management |
| `commands::auth` | Credential management, GitHub OAuth |
| `commands::kanban` | Kanban data persistence |
| `commands::sync` | Cloud sync (workspaces, packages) |
| `commands::cache` | Offline cache |

**State Management** (Zustand Store):

```typescript
// apps/desktop/src/stores/app-store.ts
interface AppState {
  selectedPython: string | null;       // Python interpreter selection
  providers: DataProvider[];           // Data source providers (18 academic sources)
  apiKeys: Record<string, string>;     // API key storage
  mcpServers: McpServerState[];        // Multiple MCP server instances
  agentAssignments: Record<string, string>; // Agent-server mapping
  theme: 'light' | 'dark' | 'system';  // UI theme
  language: 'en' | 'zh-CN';            // Language
  shortcuts: Record<string, string>;   // Keyboard shortcuts
  onboardingCompleted: boolean;        // Onboarding completion status
}
```

---

### 4.3 apps/docs (@viben/docs)

**Positioning**: Documentation site

**Core Features**:
- Multi-language support (English, Chinese)
- Mermaid diagram support
- Blog
- API documentation

**Technology**: Docusaurus 3.7.0

---

## 5. Shared Packages Analysis

### 5.1 @viben/core

**Positioning**: Shared core library for configuration, agents, providers, models, Gateway, executors, and services

**Exported Modules**:
```typescript
// Configuration management
export { ConfigManager, getStateDir, getConfigPath, ... }

// Agent management
export { AgentManager, agentManager }

// Provider management
export { ProviderManager, providerManager }

// Model management
export { ModelManager, modelManager, KNOWN_MODELS }

// MCP management
export { McpManager, mcpManager }

// Skills management
export { SkillsManager, skillsManager }

// Executors - AI coding agent executors
export { createExecutor, EXECUTOR_TYPES, spawnChat }

// Gateway - HTTP/WebSocket API gateway
export { startGateway, registerRoutes }

// Services - Background service management
export { ServiceManager, EventService, SessionStoreService, CronService }
```

**Directory Structure**:
```
packages/core/src/
├── agents/       # Agent configuration and management
├── channels/     # Message channel management
├── cli/          # CLI command implementations
├── config/       # Configuration file management
├── db/           # Database models (SQLite)
├── executors/    # AI coding agent executors
├── gateway/      # HTTP/WS API gateway
├── group-chat/   # Group chat functionality
├── mcp/          # MCP server configuration
├── models/       # Model definitions and discovery
├── notifications/ # Notification system
├── providers/    # Provider configuration
├── services/     # Background services
├── skills/       # Skills management
├── team/         # Team functionality
├── telemetry/    # Telemetry and logging
├── types/        # Shared type definitions
├── workspace/    # Workspace management
├── browser.ts    # Browser-safe exports
└── index.ts      # Main exports
```

#### 5.1.1 Executors - AI Coding Agent Executors

The executors module provides a unified interface for spawning and managing multiple AI coding agents. Each executor wraps a specific CLI tool and exposes a common API for availability checks, chat sessions, and process lifecycle management.

| Executor | CLI Tool | Description |
|----------|----------|-------------|
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
// Create an executor instance
const executor = createExecutor("CLAUDE_CODE");
const availability = executor.getAvailabilityInfo();

// Executors that support non-interactive chat
const CHAT_SUPPORTED_EXECUTORS = ["CLAUDE_CODE", "GEMINI", "CODEX"];
```

#### 5.1.2 Gateway - HTTP/WebSocket API Gateway

The Viben Gateway is a Fastify-based server running on port **18790**. It serves as the primary interface between the Desktop/CLI frontends and the `@viben/core` backend, exposing 40+ API routes organized by domain.

| Route Module | Endpoint Prefix | Function |
|-------------|-----------------|----------|
| **health** | `/health` | Health check |
| **agents** | `/api/agent` | Agent CRUD |
| **sessions** | `/api/sessions` | Session management |
| **executors** | `/api/executors` | Executor management |
| **models** | `/api/models` | Model configuration |
| **providers** | `/api/providers` | Provider configuration |
| **channels** | `/api/channels` | Message channels |
| **cron** | `/api/cron` | Scheduled tasks |
| **mcp** | `/api/mcp` | MCP server management |
| **mcp-inspector** | `/api/mcp-inspector` | MCP debugger |
| **workspaces** | `/api/workspaces` | Workspaces |
| **group-chats** | `/api/group-chats` | Group chats |
| **chat-list** | `/api/chat-list` | Chat list |
| **agent-run** | `/api/agent-run` | Agent run (SSE) |
| **agent-ws** | `/api/agent-ws` | Agent WebSocket |
| **files** | `/api/files` | File operations |
| **filesystem** | `/api/filesystem` | Filesystem browsing |
| **terminal** | `/api/terminal` | Terminal sessions |
| **history** | `/api/history` | History records |
| **telemetry** | `/api/telemetry` | Telemetry data |
| **sandbox** | `/api/sandbox` | Sandbox execution |
| **commands** | `/api/commands` | Command execution |
| **python** | `/api/python` | Python environment |
| **service-keys** | `/api/service-keys` | Service keys |
| **usage** | `/api/usage` | Usage statistics |
| **installed-sources** | `/api/installed-sources` | Installed sources |
| **logs** | `/api/logs` | Log viewer |
| **marketplace** | `/api/marketplace` | Marketplace integration |
| **official-registry** | `/api/official-registry` | Official registry |
| **cache** | `/api/cache` | Cache management |
| **tunnel** | `/api/tunnel` | Tunnel service |
| **kanban-data** | `/api/kanban-data` | Kanban data |
| **packages** | `/api/packages` | Package management |
| **github** | `/api/github` | GitHub integration |
| **tasks** | `/api/tasks` | Task management |
| **events** | `/api/events` | Event stream (SSE) |
| **ws** | `/ws` | WebSocket |

#### 5.1.3 Services - Background Services

The services layer provides long-running background capabilities that power the Gateway and agent orchestration. The `ServiceManager` coordinates startup, shutdown, and health monitoring for all services.

| Service | Description |
|---------|-------------|
| **EventService** | Event broadcasting and streaming |
| **SessionStoreService** | File-based session persistence |
| **CronService** | Scheduled task management |
| **ContainerService** | Process spawning and management |
| **HistoryService** | Agent history management |
| **MessageBus** | Channel message routing |
| **ServiceManager** | Background service management (MCP, Gateway, Viben) |
| **BackgroundTaskManager** | Background task management (observer pattern) |
| **AgentService** | Agent session lifecycle, plan approval |
| **SandboxService** | Isolated code execution (multi-provider) |
| **GitHubService** | GitHub integration (auth, repos, issues, PRs, releases) |

#### 5.1.4 GitHub Integration

The GitHub service module provides deep integration with GitHub for workspace-level repository management.

**Capabilities**:

- **Authentication**: gh CLI / Personal Access Token (PAT)
- **Repository management**: Connect, configure, retrieve info
- **Issue management**: List, detail, comments, investigation analysis
- **Pull Requests**: List, create, detail
- **Releases**: List, create, asset management
- **Issue import**: Import issues as spec files

Configuration is stored at `~/.viben/workspaces/{workspace_id}/github.yaml`.

```typescript
interface GitHubConfig {
  auth?: GitHubAuth;                   // Authentication info
  repository?: GitHubRepositoryConfig; // Connected repository
  preferences?: GitHubPreferences;     // User preferences
}
```

---

### 5.2 @viben/api-client

**Positioning**: TypeScript API client for the Viben platform

**Usage Example**:
```typescript
import { VibenClient } from '@viben/api-client';

const client = new VibenClient({
  baseUrl: 'https://viben-web.vercel.app',
  apiKey: 'viben_xxx...',
});

// List MCP packages
const { packages } = await client.mcp.list({ page: 1 });

// Search skills
const { packages: skills } = await client.skill.search('git');
```

---

### 5.3 @viben/kanban

**Positioning**: Feature-rich kanban component library

**Core Components**:

| Component | Description |
|-----------|-------------|
| `KanbanProvider` | Kanban context provider |
| `KanbanBoard` | Main kanban component |
| `KanbanCard` | Task card |
| `PrioritySelector` | Priority selector |
| `AssigneeManager` | Assignee management |
| `DueDatePicker` | Due date picker |
| `TagManager` | Tag system |
| `FilterSystem` | Filter system |
| `SubtaskManager` | Subtask management |
| `BulkActions` | Bulk actions |
| `RelationshipTracker` | Relationship tracker (blocking relationships) |
| `ActivityFeed` | Activity feed |
| `CommentList` | Comment list |

**Dependencies**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@viben/ui`

---

### 5.4 @viben/ui

**Positioning**: Shared UI component library (Radix-based)

**Component List**:
- Avatar, Badge, Breadcrumb
- Button, Card, Dialog
- Dropdown Menu, Input, Label
- Scroll Area, Select, Separator
- Skeleton, Switch, Tabs
- Textarea, Tooltip

**Build Foundation**: Radix UI primitives + TailwindCSS

---

### 5.5 viben (CLI)

**Positioning**: AI agent cluster orchestration CLI

**Dependencies**: `commander`, `chalk`, `yaml`

**Binary**: `viben` (installed globally via npm)

---

## 6. Backend Services

### 6.1 browse-mcp

**Positioning**: Academic paper search Python MCP server

**Supported Data Sources** (18):

| Category | Data Sources |
|----------|--------------|
| **Free** | arXiv, PubMed, PMC, bioRxiv, medRxiv, Google Scholar, Semantic Scholar, CORE, Crossref, IACR |
| **API Key Required** | ScienceDirect, Springer, IEEE Xplore, Scopus |
| **Institutional Access** | ACM, Web of Science, JSTOR, ResearchGate |

**Architecture**: Plugin-based searchers using `stevedore`

---

## 7. Data Flow and Architecture Patterns

### 7.1 Package Dependency Graph

```
                    @viben/core
                        |
          +-------------+-------------+
          |             |             |
      @viben/ui    @viben/api-client  |
          |             |             |
    @viben/kanban       |             |
          |             |             |
          +-------------+-------------+
                        |
          +-------------+-------------+
          |                           |
     @viben/web                 @viben/desktop
```

### 7.2 Data Flow Patterns

**Desktop Application Data Flow**:

```
User Action --> React Component --> Zustand Store --> Tauri Command (IPC)
                    |                                       |
               React Query <----------- Response <----- Rust Backend
                    |
               UI State Update
```

**Web Application Data Flow**:

```
User Action --> React Component --> API Route Handler --> Drizzle ORM --> PostgreSQL
                    |                                                        |
              Server Response <----------------------------------------------+
```

### 7.3 State Management Patterns

**Desktop Application (Zustand + Persistence)**:
```typescript
// apps/desktop/src/stores/app-store.ts
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State with getters/setters
    }),
    {
      name: "viben-storage",
      partialize: (state) => ({ /* Keys to persist */ }),
    }
  )
);
```

**Web Application (Server-side + Drizzle)**:
```typescript
// Database operations via Drizzle ORM
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { workspaces: true }
});
```

### 7.4 API Patterns

**Web API Routes** (Next.js App Router):
```
/api/auth/*           # Authentication
/api/mcp/*            # MCP package CRUD
/api/skill/*          # Skill package CRUD
/api/workspaces/*     # Workspace management
/api/collections/*    # Collections
/api/admin/*          # Admin endpoints
```

**Desktop IPC Commands** (Tauri):
```rust
// Commands exposed via invoke_handler
commands::mcp::start_mcp_server
commands::agents::read_agent_config
commands::viben_agents::viben_list_agents
```

### 7.5 Core Architecture Patterns

| Pattern | Description |
|---------|-------------|
| **Monorepo + Turborepo** | Shared packages, parallel builds, caching |
| **Hybrid Application Architecture** | Web (Next.js) + Desktop (Tauri + Vite) |
| **Shared Core Library** | TypeScript (@viben/core) provides configuration, Gateway, executors, and services |
| **Gateway Layer** | Fastify-based HTTP/WebSocket server decouples frontends from core logic |
| **Plugin Architecture** | browse-mcp uses stevedore for extensible searchers |
| **Offline-First Desktop** | SQLite local storage + cloud sync |
| **Component Library Pattern** | Radix primitives wrapped as @viben/ui |

---

## 8. Build and Deployment

### 8.1 Build Commands

```bash
# Full build
pnpm build

# Type checking
pnpm typecheck

# Development mode
pnpm dev

# Clean
pnpm clean

# Format
pnpm format
```

### 8.2 Application-Specific Commands

**Web Application**:
```bash
cd apps/web
pnpm dev          # Development server
pnpm build        # Production build
pnpm db:push      # Push database schema
pnpm db:studio    # Open Drizzle Studio
```

**Desktop Application**:
```bash
cd apps/desktop
pnpm dev          # Development mode (Vite + Tauri)
pnpm build        # Production build
pnpm tauri dev    # Tauri development mode
pnpm tauri build  # Tauri production build
```

### 8.3 Release Process

- **Web**: Vercel automatic deployment
- **Desktop**: GitHub Actions + Tauri build
- **CLI**: npm publish + Homebrew tap

---

## Appendix

### A. Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root package configuration |
| `pnpm-workspace.yaml` | Workspace definition |
| `turbo.json` | Turborepo task configuration |
| `tsconfig.json` | TypeScript configuration |
| `apps/web/drizzle.config.ts` | Drizzle ORM configuration |
| `apps/desktop/src-tauri/Cargo.toml` | Rust dependencies |
| `apps/desktop/src-tauri/tauri.conf.json` | Tauri configuration |

### B. Environment Variables

**Web Application** (apps/web/.env):
```
DATABASE_URL=           # PostgreSQL connection string
NEXTAUTH_SECRET=        # NextAuth secret
GITHUB_CLIENT_ID=       # GitHub OAuth
GITHUB_CLIENT_SECRET=   # GitHub OAuth
```

**Desktop Application**: Sensitive information managed via Tauri secure storage

### C. Version Information

| Component | Version |
|-----------|---------|
| Node.js | >=20.0.0 |
| pnpm | 9.15.0 |
| React | ^19.0.0 |
| Next.js | ^15.5.11 |
| Tauri | 2.x |
| TailwindCSS | v3.4 (web), v4.1 (desktop) |
