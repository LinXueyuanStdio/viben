# Viben Project Architecture Report

> **Version**: 0.1.0
> **Updated**: 2026-03-27
> **Project Description**: Agent Swarm x Code Evolution - AI-driven code iteration and intelligent agent orchestration platform

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

**Viben** is an **Agent Swarm x Code Evolution** platform focused on AI-driven code iteration optimization and intelligent agent cluster orchestration. Core capabilities include:

- **FileEvo (File-based Self-Evolution)** - Feedback-based code iteration optimization system
- **Agent Swarm** - Multi-agent cluster orchestration and collaboration
- **Task System (XState)** - State machine-based task workflow management
- **Idea Generation** - AI-assisted idea generation and knowledge exploration

Core Products:

| Product | Description | Technology |
|---------|-------------|------------|
| **Web Application** | MCP/Skill package marketplace, social features | Next.js 15 + PostgreSQL |
| **Desktop Application** | Agent Swarm orchestration, FileEvo code optimization, task state machine | Tauri 2 + React 19 |
| **CLI Tool** | Command-line agent cluster management and automation | TypeScript + Commander |
| **MCP Server** | Academic paper search service (18 data sources) | Python + FastMCP |

### 1.2 Core Architecture Features

```
┌─────────────────────────────────────────────────────────────────┐
│                    Viben Architecture Overview                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐  │
│   │   Web   │     │ Desktop │     │   CLI   │     │  Docs   │  │
│   │ (Next)  │     │ (Tauri) │     │  (Node) │     │(Docusr) │  │
│   └────┬────┘     └────┬────┘     └────┬────┘     └─────────┘  │
│        │               │               │                        │
│        └───────────────┼───────────────┘                        │
│                        │                                        │
│              ┌─────────┴─────────┐                              │
│              │   Shared Packages │                              │
│   ┌──────────┼──────────┬────────┼──────────┐                   │
│   │          │          │        │          │                   │
│   │  @viben  │  @viben  │ @viben │  @viben  │                   │
│   │  /core   │  /ui     │ /kanban│ /api-cli │                   │
│   │          │          │        │  ent     │                   │
│   └──────────┴──────────┴────────┴──────────┘                   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Python Backend Services                 │   │
│   │   browse-mcp (Academic Search)                           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

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
│   ├── core/                # Core configuration/agent management
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

**Positioning**: Agent Swarm x Code Evolution desktop client

**Core Features**:
- **Agent Swarm** - Intelligent agent cluster orchestration and collaboration
- **FileEvo** - Feedback-based code iteration optimization
- **Task System (XState)** - State machine-driven task workflow
- **Idea Generation** - AI-assisted idea generation
- MCP server management (start/stop/monitor)
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

**Positioning**: Shared core library for configuration, agents, providers, and models

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
```

**Directory Structure**:
```
packages/core/src/
├── agents/       # Agent configuration and management
├── config/       # Configuration file management
├── mcp/          # MCP server configuration
├── models/       # Model definitions
├── providers/    # Provider configuration
├── skills/       # Skills management
├── types/        # Shared type definitions
├── browser.ts    # Browser-safe exports
└── index.ts      # Main exports
```

---

### 5.2 @viben/api-client

**Positioning**: TypeScript API client for Viben platform

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

**Positioning**: Agent Swarm x Code Evolution command-line tool

**Core Capabilities**:
- **Agent Swarm** - Command-line agent cluster management
- **Task System** - Task state machine workflow (`viben task`)
- **Queue System** - Background command execution queue (`viben queue`)
- **FileEvo** - Code iteration optimization automation

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

### 7.2 Data Flow Patterns

**Desktop Application Data Flow**:
```
User Action → React Component → Zustand Store → Tauri Command (IPC)
                ↓                              ↓
           React Query ←────── Response ←──── Rust Backend
                ↓
           UI State Update
```

**Web Application Data Flow**:
```
User Action → React Component → API Route Handler → Drizzle ORM → PostgreSQL
                ↓                                        ↓
          Server Response ←─────────────────────────────┘
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
| **Shared Core Library** | TypeScript (@viben/core) provides unified configuration and service management |
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
