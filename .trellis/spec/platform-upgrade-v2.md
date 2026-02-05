# Platform Upgrade v2.0 - Comprehensive Planning Document

> A major platform upgrade to support MCP Marketplace, Skills Marketplace, Workspaces, and unified management system.

---

## Executive Summary

This document outlines the comprehensive upgrade plan to transform Viben from a single-purpose academic search tool into a full-featured **AI Tool Platform** with:

1. **User System** - Authentication, identity, developer accounts
2. **MCP Marketplace** - Browse, search, publish, and manage MCP servers
3. **Skills Marketplace** - Browse, search, publish, and manage AI Skills
4. **Upload/Download System** - Package distribution for developers
5. **Workspace System** - Project-scoped configuration of MCPs and Skills
6. **Global Management** - Unified monitoring, logging, and lifecycle control

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Tool Platform                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Clients                                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │  Desktop App (Tauri)    │  │  Web App (Next.js SSR)  │              │
│  │  - Consumes REST API    │  │  - Server Components    │              │
│  │  - Local MCP management │  │  - Full marketplace UI  │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
│              │                           │                              │
│              └───────────┬───────────────┘                              │
│                          ▼                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  apps/web (Next.js Full-Stack - Deployed on Vercel)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  app/api/                      (API Routes - REST Endpoints)     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │  /auth   │ │  /mcp    │ │ /skills  │ │/packages │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │   │
│  │  │  /users  │ │  /orgs   │ │/workspace│                        │   │
│  │  └──────────┘ └──────────┘ └──────────┘                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  lib/                          (Business Logic Layer)            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │   auth   │ │    db    │ │ storage  │ │ services │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  backend/browse-mcp (MCP Server - Python/FastMCP)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │  MCP Tools  │ │   Plugin    │ │   Data      │                       │
│  │  (search)   │ │   System    │ │  Sources    │                       │
│  └─────────────┘ └─────────────┘ └─────────────┘                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │  PostgreSQL │ │    Local    │ │  Remote     │                       │
│  │   (Neon)    │ │   Files     │ │  Storage    │ ← HuggingFace/R2/etc  │
│  └─────────────┘ └─────────────┘ └─────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  apps/web (Next.js)                                        │  │
│  │  - Server Components (SSR)                                 │  │
│  │  - API Routes → /api/*                                     │  │
│  │  - Edge Functions (auth middleware)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Neon PostgreSQL (Serverless)                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Desktop App (Tauri) - Local Installation                        │
│  - Calls Vercel-hosted API                                       │
│  - Manages local MCP servers                                     │
│  - Local workspace configuration                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Package Responsibilities

| Package | Location | Technology | Responsibility |
|---------|----------|------------|----------------|
| **web** | `apps/web/` | Next.js 15 | Full-stack platform (API + Web UI) |
| **desktop** | `apps/desktop/` | Tauri + React | Desktop client, local MCP management |
| **browse-mcp** | `backend/browse-mcp/` | Python/FastMCP | MCP protocol server |
| **plugins** | `backend/plugins/` | Python | Additional MCP data sources |

**Key Separation**:
- `apps/web` is the **platform backend + web frontend** (deployed on Vercel)
- `apps/desktop` is the **desktop client** (consumes Vercel API)
- `backend/browse-mcp` provides **MCP tools** (Python, runs locally)

---

## Module 0: User System (Foundation)

### 0.1 Feature Overview

| Feature | Description |
|---------|-------------|
| **Registration** | Email + password, OAuth (GitHub, Google) |
| **Authentication** | JWT-based auth, refresh tokens |
| **Profile** | Developer profile with avatar, bio, links |
| **API Keys** | Personal access tokens for CLI/API access |
| **Organizations** | Team accounts for shared package publishing |

### 0.2 User Roles

| Role | Permissions |
|------|-------------|
| **Anonymous** | Browse, search, download public packages |
| **User** | + Favorites, comments, ratings, collections |
| **Developer** | + Upload packages, manage own packages |
| **Org Admin** | + Manage org members, org packages |
| **Platform Admin** | + Moderate content, manage users |

### 0.3 Data Models

```python
@dataclass
class User:
    id: str                          # UUID
    email: str                       # Unique
    username: str                    # Unique, URL-safe
    display_name: str
    avatar_url: Optional[str]
    bio: Optional[str]
    website_url: Optional[str]
    github_username: Optional[str]

    # Auth
    password_hash: str               # bcrypt
    email_verified: bool

    # Role
    role: Literal["user", "developer", "admin"]

    # Metadata
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]

@dataclass
class ApiKey:
    id: str
    user_id: str
    name: str                        # User-friendly name
    key_hash: str                    # Hashed API key
    key_prefix: str                  # First 8 chars for identification
    scopes: List[str]                # ["read", "write", "delete"]
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    created_at: datetime

@dataclass
class Organization:
    id: str
    slug: str                        # URL-safe identifier
    name: str
    description: Optional[str]
    avatar_url: Optional[str]
    website_url: Optional[str]

    # Ownership
    owner_id: str                    # User ID

    created_at: datetime
    updated_at: datetime

@dataclass
class OrgMember:
    org_id: str
    user_id: str
    role: Literal["member", "admin", "owner"]
    joined_at: datetime

@dataclass
class Session:
    id: str
    user_id: str
    refresh_token_hash: str
    user_agent: str
    ip_address: str
    expires_at: datetime
    created_at: datetime
```

### 0.4 Authentication Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │  FastAPI │      │ Database │
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │
     │  POST /auth/login                 │
     │  {email, password}                │
     │────────────────>│                 │
     │                 │  Verify creds   │
     │                 │────────────────>│
     │                 │<────────────────│
     │                 │                 │
     │  {access_token, refresh_token}    │
     │<────────────────│                 │
     │                 │                 │
     │  GET /api/v1/...                  │
     │  Authorization: Bearer {token}    │
     │────────────────>│                 │
     │                 │  Validate JWT   │
     │                 │                 │
     │  Response       │                 │
     │<────────────────│                 │
```

### 0.5 API Design

```
# Authentication
POST   /auth/register              # Create account
POST   /auth/login                 # Login, get tokens
POST   /auth/logout                # Invalidate session
POST   /auth/refresh               # Refresh access token
POST   /auth/forgot-password       # Request password reset
POST   /auth/reset-password        # Reset with token
GET    /auth/verify-email/:token   # Verify email

# OAuth
GET    /auth/oauth/github          # Redirect to GitHub
GET    /auth/oauth/github/callback # OAuth callback
GET    /auth/oauth/google          # Redirect to Google
GET    /auth/oauth/google/callback # OAuth callback

# Profile
GET    /api/v1/users/me            # Current user profile
PUT    /api/v1/users/me            # Update profile
GET    /api/v1/users/:username     # Public profile

# API Keys
GET    /api/v1/api-keys            # List user's API keys
POST   /api/v1/api-keys            # Create API key
DELETE /api/v1/api-keys/:id        # Revoke API key

# Organizations
GET    /api/v1/orgs                # List user's orgs
POST   /api/v1/orgs                # Create org
GET    /api/v1/orgs/:slug          # Get org details
PUT    /api/v1/orgs/:slug          # Update org
DELETE /api/v1/orgs/:slug          # Delete org
GET    /api/v1/orgs/:slug/members  # List members
POST   /api/v1/orgs/:slug/members  # Add member
DELETE /api/v1/orgs/:slug/members/:user_id  # Remove member
```

---

## Module 1: MCP Marketplace

### 1.1 Feature Overview

| Feature | Description |
|---------|-------------|
| **Browse** | Grid/list view of all available MCPs with filtering |
| **Search** | Full-text search by name, description, tags |
| **Collections** | User-created groupings of related MCPs |
| **CRUD** | Create, read, update, delete MCP packages |
| **Social** | Favorites, ratings, comments, download counts |
| **Upload/Download** | Sync with HuggingFace Datasets for hosting |

### 1.2 Data Models

```python
# MCP Package - Core entity
@dataclass
class McpPackage:
    id: str                          # UUID
    name: str                        # Display name
    slug: str                        # URL-safe identifier
    version: str                     # Semver (e.g., "1.2.0")
    description: str                 # Short description
    long_description: str            # Markdown content
    author: Author                   # Author info
    repository_url: Optional[str]    # GitHub/GitLab URL
    homepage_url: Optional[str]      # Project homepage
    license: str                     # SPDX identifier

    # Technical
    transport: Literal["stdio", "sse", "http"]
    entry_point: str                 # Command or URL
    config_schema: Optional[Dict]    # JSON Schema for configuration
    dependencies: List[str]          # Required packages

    # Metadata
    tags: List[str]                  # Category tags
    category: str                    # Primary category
    created_at: datetime
    updated_at: datetime

    # Social
    favorites_count: int
    downloads_count: int
    rating_avg: float
    rating_count: int

# MCP Collection - User-created groupings
@dataclass
class McpCollection:
    id: str
    name: str
    description: str
    owner_id: str
    is_public: bool
    items: List[McpCollectionItem]
    favorites_count: int
    created_at: datetime
    updated_at: datetime

@dataclass
class McpCollectionItem:
    collection_id: str
    mcp_id: str
    added_at: datetime
    note: Optional[str]              # User's note about this MCP

# Social entities
@dataclass
class McpComment:
    id: str
    mcp_id: str
    user_id: str
    content: str
    parent_id: Optional[str]         # For threaded comments
    created_at: datetime
    updated_at: datetime

@dataclass
class McpFavorite:
    user_id: str
    mcp_id: str
    created_at: datetime

@dataclass
class McpRating:
    user_id: str
    mcp_id: str
    score: int                       # 1-5 stars
    created_at: datetime
```

### 1.3 API Design

```
# MCP Packages
GET    /api/v1/mcp                    # List all MCPs (paginated)
GET    /api/v1/mcp/search             # Search MCPs
GET    /api/v1/mcp/:id                # Get MCP details
POST   /api/v1/mcp                    # Create new MCP
PUT    /api/v1/mcp/:id                # Update MCP
DELETE /api/v1/mcp/:id                # Delete MCP

# Collections
GET    /api/v1/mcp/collections        # List collections
GET    /api/v1/mcp/collections/:id    # Get collection details
POST   /api/v1/mcp/collections        # Create collection
PUT    /api/v1/mcp/collections/:id    # Update collection
DELETE /api/v1/mcp/collections/:id    # Delete collection
POST   /api/v1/mcp/collections/:id/items/:mcp_id   # Add MCP to collection
DELETE /api/v1/mcp/collections/:id/items/:mcp_id   # Remove MCP from collection

# Social
POST   /api/v1/mcp/:id/favorite       # Toggle favorite
GET    /api/v1/mcp/:id/comments       # Get comments
POST   /api/v1/mcp/:id/comments       # Add comment
POST   /api/v1/mcp/:id/rating         # Add/update rating

# HuggingFace Sync
POST   /api/v1/mcp/:id/publish        # Upload to HuggingFace
POST   /api/v1/mcp/import             # Import from HuggingFace
```

### 1.4 Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| MCP Marketplace | `/mcp` | Grid view with filters, search |
| MCP Detail | `/mcp/:id` | Full details, comments, ratings |
| My Collections | `/mcp/collections` | User's collections list |
| Collection Detail | `/mcp/collections/:id` | Collection contents |
| Publish MCP | `/mcp/publish` | Upload/publish wizard |

---

## Module 2: Skills Marketplace

### 2.1 Feature Overview

| Feature | Description |
|---------|-------------|
| **Browse** | Grid/list view of all available Skills |
| **Search** | Full-text search by name, description, tags |
| **Collections** | User-created skill bundles |
| **CRUD** | Create, read, update, delete Skills |
| **Social** | Favorites, ratings, comments |
| **Upload/Download** | Sync with HuggingFace Datasets |

### 2.2 Data Models

```python
# Skill Package - Core entity
@dataclass
class SkillPackage:
    id: str
    name: str                        # e.g., "commit-staged"
    slug: str                        # URL-safe identifier
    version: str
    description: str                 # Short description
    long_description: str            # Markdown content
    author: Author

    # Technical
    skill_type: Literal["command", "prompt", "agent"]
    trigger_patterns: List[str]      # Activation patterns
    content: str                     # Skill content (markdown/code)
    config_schema: Optional[Dict]    # Configuration options
    dependencies: List[str]          # Required MCPs or other skills

    # Metadata
    tags: List[str]
    category: str                    # e.g., "git", "code-review", "documentation"
    compatibility: List[str]         # Compatible agents/platforms
    created_at: datetime
    updated_at: datetime

    # Social
    favorites_count: int
    downloads_count: int
    rating_avg: float
    rating_count: int

# Skill Collection
@dataclass
class SkillCollection:
    id: str
    name: str
    description: str
    owner_id: str
    is_public: bool
    items: List[SkillCollectionItem]
    favorites_count: int
    created_at: datetime
    updated_at: datetime
```

### 2.3 API Design

```
# Skills
GET    /api/v1/skills                 # List all skills
GET    /api/v1/skills/search          # Search skills
GET    /api/v1/skills/:id             # Get skill details
POST   /api/v1/skills                 # Create skill
PUT    /api/v1/skills/:id             # Update skill
DELETE /api/v1/skills/:id             # Delete skill

# Collections (same pattern as MCP)
GET    /api/v1/skills/collections
...

# Social (same pattern as MCP)
POST   /api/v1/skills/:id/favorite
...

# HuggingFace Sync
POST   /api/v1/skills/:id/publish
POST   /api/v1/skills/import
```

---

## Module 3: Global Management

### 3.1 Feature Overview

| Feature | Description |
|---------|-------------|
| **Enable/Disable** | Toggle MCPs, Skills, Agents globally |
| **MCP Server Management** | Start, stop, restart MCP servers |
| **Log Monitoring** | Real-time logs from all running servers |
| **Agent Installation** | Install MCPs/Skills to specific agents |
| **Status Dashboard** | Overview of all running services |

### 3.2 Data Models

```python
# Global Enable/Disable State
@dataclass
class EnabledEntity:
    entity_type: Literal["mcp", "skill", "agent"]
    entity_id: str
    enabled: bool
    scope: Literal["global", "workspace"]
    scope_id: Optional[str]          # workspace_id if scope is workspace
    enabled_at: datetime

# MCP Server Instance
@dataclass
class McpServerInstance:
    id: str
    mcp_id: str                      # Reference to McpPackage
    name: str
    status: Literal["stopped", "starting", "running", "error"]
    pid: Optional[int]
    transport: Literal["stdio", "sse", "http"]
    endpoint: Optional[str]          # URL for sse/http transports
    config: Dict                     # Runtime configuration
    started_at: Optional[datetime]
    last_error: Optional[str]

# Server Log Entry
@dataclass
class ServerLogEntry:
    id: str
    server_id: str
    level: Literal["debug", "info", "warning", "error"]
    message: str
    timestamp: datetime
    metadata: Optional[Dict]

# Agent Configuration
@dataclass
class AgentConfig:
    id: str
    name: str                        # e.g., "Claude Code", "Cursor"
    type: str                        # Agent type identifier
    config_path: str                 # Path to agent's config file
    enabled_mcps: List[str]          # MCP IDs installed to this agent
    enabled_skills: List[str]        # Skill IDs installed to this agent
```

### 3.3 API Design

```
# Global Enable/Disable
GET    /api/v1/global/enabled         # List all enabled entities
POST   /api/v1/global/enabled         # Enable entity
DELETE /api/v1/global/enabled/:type/:id  # Disable entity

# MCP Server Management
GET    /api/v1/servers                # List all server instances
GET    /api/v1/servers/:id            # Get server status
POST   /api/v1/servers/:id/start      # Start server
POST   /api/v1/servers/:id/stop       # Stop server
POST   /api/v1/servers/:id/restart    # Restart server
GET    /api/v1/servers/:id/logs       # Get server logs (with streaming support)

# Agent Management
GET    /api/v1/agents                 # List configured agents
GET    /api/v1/agents/:id             # Get agent config
PUT    /api/v1/agents/:id             # Update agent config
POST   /api/v1/agents/:id/install/:type/:entity_id  # Install MCP/Skill to agent
DELETE /api/v1/agents/:id/uninstall/:type/:entity_id
```

---

## Module 4: Data Browse Enhancement

### 4.1 Feature Overview

Enhance the existing Data Browse (academic search) with:

| Feature | Description |
|---------|-------------|
| **Data Source Collections** | Group related data sources |
| **CRUD for Sources** | Add/modify/remove data sources |
| **Social** | Favorites, comments for data sources |

### 4.2 Data Models

```python
# Data Source (enhanced from existing PaperSource)
@dataclass
class DataSource:
    id: str
    name: str
    slug: str
    description: str
    plugin_id: str                   # Which plugin provides this
    source_class: str                # Python class path

    # Configuration
    requires_api_key: bool
    config_schema: Optional[Dict]

    # Metadata
    category: str                    # e.g., "preprint", "journal", "database"
    tags: List[str]
    website_url: str
    documentation_url: Optional[str]

    # Social
    favorites_count: int
    rating_avg: float
    created_at: datetime
    updated_at: datetime

# Data Source Collection
@dataclass
class DataSourceCollection:
    id: str
    name: str
    description: str
    owner_id: str
    is_public: bool
    items: List[DataSourceCollectionItem]
    favorites_count: int
    created_at: datetime
    updated_at: datetime
```

### 4.3 API Design

```
# Data Sources
GET    /api/v1/datasources            # List all data sources
GET    /api/v1/datasources/:id        # Get source details
POST   /api/v1/datasources            # Register new source
PUT    /api/v1/datasources/:id        # Update source
DELETE /api/v1/datasources/:id        # Remove source

# Collections
GET    /api/v1/datasources/collections
...

# Social
POST   /api/v1/datasources/:id/favorite
...
```

---

## Module 5: CodeInterpreter MCP & Workspaces

### 5.1 Feature Overview

| Feature | Description |
|---------|-------------|
| **Workspace** | Project-scoped environment configuration |
| **MCP Assignment** | Assign specific MCPs to workspace |
| **Skill Assignment** | Assign specific Skills to workspace |
| **Agent Config** | Per-workspace agent enable/disable |

### 5.2 Data Models

```python
# Workspace
@dataclass
class Workspace:
    id: str
    name: str
    project_dir: str                 # Absolute path to project
    description: Optional[str]

    # Enabled entities (workspace-scoped)
    enabled_mcps: List[WorkspaceMcp]
    enabled_skills: List[WorkspaceSkill]
    enabled_agents: List[WorkspaceAgent]

    # Metadata
    created_at: datetime
    updated_at: datetime
    last_accessed_at: datetime

@dataclass
class WorkspaceMcp:
    workspace_id: str
    mcp_id: str
    enabled: bool
    config: Optional[Dict]           # Workspace-specific config overrides
    added_at: datetime

@dataclass
class WorkspaceSkill:
    workspace_id: str
    skill_id: str
    enabled: bool
    config: Optional[Dict]
    added_at: datetime

@dataclass
class WorkspaceAgent:
    workspace_id: str
    agent_id: str
    enabled: bool
    config: Optional[Dict]           # Agent-specific workspace config
    added_at: datetime
```

### 5.3 API Design

```
# Workspaces
GET    /api/v1/workspaces             # List workspaces
GET    /api/v1/workspaces/:id         # Get workspace details
POST   /api/v1/workspaces             # Create workspace
PUT    /api/v1/workspaces/:id         # Update workspace
DELETE /api/v1/workspaces/:id         # Delete workspace

# Workspace MCPs
GET    /api/v1/workspaces/:id/mcps    # List workspace MCPs
POST   /api/v1/workspaces/:id/mcps/:mcp_id       # Add MCP to workspace
PUT    /api/v1/workspaces/:id/mcps/:mcp_id       # Update MCP config
DELETE /api/v1/workspaces/:id/mcps/:mcp_id       # Remove MCP

# Workspace Skills
GET    /api/v1/workspaces/:id/skills
POST   /api/v1/workspaces/:id/skills/:skill_id
PUT    /api/v1/workspaces/:id/skills/:skill_id
DELETE /api/v1/workspaces/:id/skills/:skill_id

# Workspace Agents
GET    /api/v1/workspaces/:id/agents
POST   /api/v1/workspaces/:id/agents/:agent_id
PUT    /api/v1/workspaces/:id/agents/:agent_id
DELETE /api/v1/workspaces/:id/agents/:agent_id
```

---

## Module 6: Package Upload/Download System (Developer Feature)

> This module is **developer-facing** - for MCP/Skill authors to publish and distribute their packages.

### 6.1 Feature Overview

| Feature | Description |
|---------|-------------|
| **Upload** | Publish MCP/Skill packages to marketplace |
| **Download** | Install packages from marketplace |
| **Versioning** | Semantic versioning, version history |
| **Release Management** | Draft, publish, deprecate releases |
| **Package Validation** | Schema validation, security checks |

### 6.2 Architecture: Storage Backend Abstraction

```
┌─────────────────────────────────────────────────────────────────┐
│                      Package Service                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   StorageBackend (ABC)                     │  │
│  │  - upload(package_id, files) -> storage_ref               │  │
│  │  - download(storage_ref) -> files                         │  │
│  │  - delete(storage_ref)                                    │  │
│  │  - get_download_url(storage_ref) -> URL                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│           ▲                    ▲                    ▲            │
│           │                    │                    │            │
│  ┌────────┴───────┐ ┌─────────┴────────┐ ┌────────┴────────┐   │
│  │ HuggingFace    │ │ LocalFileSystem  │ │    S3/R2        │   │
│  │ Backend        │ │ Backend          │ │    Backend      │   │
│  │ (Default)      │ │ (Dev/Test)       │ │    (Future)     │   │
│  └────────────────┘ └──────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Principle**: The API layer never exposes storage backend details. Users interact with FastAPI endpoints; HuggingFace (or any other storage) is an implementation detail.

### 6.3 Data Models

```python
# Package Release - versioned snapshot of a package
@dataclass
class PackageRelease:
    id: str
    package_type: Literal["mcp", "skill"]
    package_id: str                  # Reference to McpPackage or SkillPackage
    version: str                     # Semver (e.g., "1.2.0")

    # Release info
    release_notes: str               # Markdown changelog
    status: Literal["draft", "published", "deprecated"]

    # Storage (abstracted)
    storage_ref: str                 # Opaque reference to stored files
    file_size: int                   # Total size in bytes
    checksum: str                    # SHA256 of package archive

    # Metadata
    published_by: str                # User ID
    published_at: Optional[datetime]
    created_at: datetime

    # Stats
    downloads_count: int

# Package File manifest
@dataclass
class PackageManifest:
    name: str
    version: str
    description: str
    author: str
    license: str

    # For MCP
    transport: Optional[str]
    entry_point: Optional[str]

    # For Skill
    skill_type: Optional[str]
    trigger_patterns: Optional[List[str]]

    # Common
    dependencies: List[str]
    files: List[str]                 # List of files in package

# Download record for analytics
@dataclass
class DownloadRecord:
    id: str
    package_type: Literal["mcp", "skill"]
    package_id: str
    release_id: str
    user_id: Optional[str]           # None for anonymous
    ip_hash: str                     # Hashed for privacy
    user_agent: str
    downloaded_at: datetime

# Storage Backend Configuration (internal)
@dataclass
class StorageConfig:
    backend_type: Literal["huggingface", "local", "s3"]

    # HuggingFace specific (encrypted)
    hf_token: Optional[str]
    hf_namespace: Optional[str]      # Default org/user

    # S3 specific (future)
    s3_bucket: Optional[str]
    s3_region: Optional[str]
    s3_access_key: Optional[str]
    s3_secret_key: Optional[str]
```

### 6.4 Upload Flow (Developer Workflow)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Developer   │     │   FastAPI    │     │   Package    │     │   Storage    │
│   Client     │     │   Server     │     │   Service    │     │   Backend    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  POST /api/v1/packages/upload           │                    │
       │  {manifest.json + files.zip}            │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │  Validate auth     │                    │
       │                    │  (JWT/API Key)     │                    │
       │                    │                    │                    │
       │                    │  validate_package()│                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │  upload(files)     │
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │                    │                    │  storage_ref       │
       │                    │                    │<───────────────────│
       │                    │                    │                    │
       │                    │  Create release    │                    │
       │                    │  record in DB      │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │  {release_id, status: "draft"}          │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
       │  POST /api/v1/packages/:id/releases/:version/publish        │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │  {status: "published", download_url}    │                    │
       │<───────────────────│                    │                    │
```

### 6.5 Download Flow (User Workflow)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │   FastAPI    │     │   Package    │     │   Storage    │
│   Client     │     │   Server     │     │   Service    │     │   Backend    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  GET /api/v1/packages/:id/download      │                    │
       │  ?version=1.2.0                         │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │  get_release()     │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │  get_download_url()│
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │                    │                    │  signed_url        │
       │                    │                    │<───────────────────│
       │                    │                    │                    │
       │                    │  record_download() │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │  302 Redirect to signed_url             │                    │
       │  (or stream directly)                   │                    │
       │<───────────────────│                    │                    │
```

### 6.6 API Design

```
# Package Upload (Authenticated - Developer)
POST   /api/v1/packages/upload              # Upload new package
       Content-Type: multipart/form-data
       Body: { manifest: JSON, archive: File }

# Release Management (Authenticated - Package Owner)
GET    /api/v1/packages/:type/:id/releases           # List all releases
GET    /api/v1/packages/:type/:id/releases/:version  # Get release details
POST   /api/v1/packages/:type/:id/releases/:version/publish   # Publish draft
POST   /api/v1/packages/:type/:id/releases/:version/deprecate # Deprecate
DELETE /api/v1/packages/:type/:id/releases/:version  # Delete draft release

# Package Download (Public or Authenticated)
GET    /api/v1/packages/:type/:id/download           # Download latest
GET    /api/v1/packages/:type/:id/download/:version  # Download specific version

# CLI Helper Endpoints
GET    /api/v1/packages/:type/:id/manifest           # Get manifest.json
GET    /api/v1/packages/:type/:id/versions           # List available versions

# Analytics (Authenticated - Package Owner)
GET    /api/v1/packages/:type/:id/stats              # Download stats
GET    /api/v1/packages/:type/:id/stats/downloads    # Download history
```

### 6.7 Package Format Specification

```
package.zip
├── manifest.json        # Required: Package metadata
├── README.md            # Required: Documentation
├── LICENSE              # Required: License file
├── CHANGELOG.md         # Optional: Version history
│
├── src/                 # MCP: Source code
│   ├── __init__.py
│   ├── server.py
│   └── ...
│
├── skill.md             # Skill: Skill content
├── config.schema.json   # Optional: Configuration schema
└── examples/            # Optional: Usage examples
```

**manifest.json Schema**:

```json
{
  "$schema": "https://browse-mcp.dev/schemas/manifest.v1.json",
  "name": "my-awesome-mcp",
  "version": "1.0.0",
  "type": "mcp",
  "description": "Short description",
  "author": {
    "name": "Developer Name",
    "email": "dev@example.com",
    "url": "https://github.com/developer"
  },
  "license": "MIT",
  "repository": "https://github.com/user/repo",
  "keywords": ["search", "api", "tool"],

  "mcp": {
    "transport": "stdio",
    "entry_point": "python -m my_mcp",
    "config_schema": "config.schema.json"
  },

  "dependencies": {
    "python": ">=3.10",
    "packages": ["httpx>=0.24", "pydantic>=2.0"]
  }
}
```

### 6.8 Storage Backend Interface

```python
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional
from dataclasses import dataclass

@dataclass
class StorageResult:
    storage_ref: str          # Opaque reference
    checksum: str             # SHA256
    size: int                 # Bytes

class StorageBackend(ABC):
    """Abstract storage backend interface."""

    @abstractmethod
    async def upload(
        self,
        package_id: str,
        version: str,
        archive: BinaryIO,
    ) -> StorageResult:
        """Upload package archive to storage."""
        pass

    @abstractmethod
    async def download(
        self,
        storage_ref: str,
    ) -> BinaryIO:
        """Download package archive from storage."""
        pass

    @abstractmethod
    async def get_download_url(
        self,
        storage_ref: str,
        expires_in: int = 3600,
    ) -> str:
        """Get a signed/temporary download URL."""
        pass

    @abstractmethod
    async def delete(
        self,
        storage_ref: str,
    ) -> None:
        """Delete package from storage."""
        pass

    @abstractmethod
    async def exists(
        self,
        storage_ref: str,
    ) -> bool:
        """Check if package exists in storage."""
        pass


class HuggingFaceBackend(StorageBackend):
    """HuggingFace Datasets implementation (default)."""

    def __init__(self, token: str, namespace: str):
        self.token = token
        self.namespace = namespace
        # Uses huggingface_hub internally

    async def upload(self, package_id: str, version: str, archive: BinaryIO) -> StorageResult:
        # Implementation hidden from API consumers
        # Uploads to HF dataset: {namespace}/mcp-packages
        ...


class LocalFileBackend(StorageBackend):
    """Local filesystem implementation (for development/testing)."""

    def __init__(self, base_path: str):
        self.base_path = Path(base_path)

    async def upload(self, package_id: str, version: str, archive: BinaryIO) -> StorageResult:
        # Store in local directory structure
        ...
```

### 6.9 CLI Integration

For developers using CLI to publish:

```bash
# Login and get API key
$ browse-mcp auth login
> Opening browser for authentication...
> API key saved to ~/.browse-mcp/credentials

# Validate package before upload
$ browse-mcp package validate ./my-mcp
> Validating manifest.json... OK
> Checking required files... OK
> Validating dependencies... OK
> Package is valid!

# Upload package
$ browse-mcp package publish ./my-mcp
> Uploading my-awesome-mcp v1.0.0...
> Package uploaded as draft
>
> To publish, visit: https://browse-mcp.dev/packages/mcp/my-awesome-mcp/releases/1.0.0
> Or run: browse-mcp package release my-awesome-mcp 1.0.0

# Download package
$ browse-mcp package install some-mcp
> Downloading some-mcp v2.1.0...
> Installed to ~/.browse-mcp/packages/some-mcp/
```

---

## Database Schema (Drizzle ORM + PostgreSQL)

### Schema Definition (`apps/web/lib/db/schema.ts`)

```typescript
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  json,
  primaryKey,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===========================================
// User System Tables
// ===========================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  username: text('username').unique().notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  websiteUrl: text('website_url'),
  githubUsername: text('github_username'),

  // Auth
  passwordHash: text('password_hash'),  // NULL if OAuth-only
  emailVerified: boolean('email_verified').default(false),

  // Role
  role: text('role').default('user'),  // 'user' | 'developer' | 'admin'

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  usernameIdx: index('idx_users_username').on(table.username),
}));

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  scopes: json('scopes').$type<string[]>().notNull(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_api_keys_user').on(table.userId),
  prefixIdx: index('idx_api_keys_prefix').on(table.keyPrefix),
}));

export const oauthConnections = pgTable('oauth_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),  // 'github' | 'google'
  providerUserId: text('provider_user_id').notNull(),
  accessToken: text('access_token'),  // Encrypted
  refreshToken: text('refresh_token'),  // Encrypted
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  providerUnique: unique().on(table.provider, table.providerUserId),
  userIdx: index('idx_oauth_user').on(table.userId),
}));

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  websiteUrl: text('website_url'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orgMembers = pgTable('org_members', {
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').default('member'),  // 'member' | 'admin' | 'owner'
  joinedAt: timestamp('joined_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.orgId, table.userId] }),
}));

// ===========================================
// Package System Tables
// ===========================================

export const mcpPackages = pgTable('mcp_packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  version: text('version').notNull(),
  description: text('description'),
  longDescription: text('long_description'),
  authorId: text('author_id').references(() => users.id),
  repositoryUrl: text('repository_url'),
  homepageUrl: text('homepage_url'),
  license: text('license'),
  transport: text('transport').notNull(),  // 'stdio' | 'sse' | 'http'
  entryPoint: text('entry_point').notNull(),
  configSchema: json('config_schema'),
  dependencies: json('dependencies').$type<string[]>(),
  tags: json('tags').$type<string[]>(),
  category: text('category'),
  favoritesCount: integer('favorites_count').default(0),
  downloadsCount: integer('downloads_count').default(0),
  ratingAvg: real('rating_avg').default(0),
  ratingCount: integer('rating_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  slugIdx: index('idx_mcp_slug').on(table.slug),
  categoryIdx: index('idx_mcp_category').on(table.category),
  authorIdx: index('idx_mcp_author').on(table.authorId),
}));

export const skillPackages = pgTable('skill_packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  version: text('version').notNull(),
  description: text('description'),
  longDescription: text('long_description'),
  authorId: text('author_id').references(() => users.id),
  skillType: text('skill_type').notNull(),  // 'command' | 'prompt' | 'agent'
  triggerPatterns: json('trigger_patterns').$type<string[]>(),
  content: text('content').notNull(),
  configSchema: json('config_schema'),
  dependencies: json('dependencies').$type<string[]>(),
  tags: json('tags').$type<string[]>(),
  category: text('category'),
  compatibility: json('compatibility').$type<string[]>(),
  favoritesCount: integer('favorites_count').default(0),
  downloadsCount: integer('downloads_count').default(0),
  ratingAvg: real('rating_avg').default(0),
  ratingCount: integer('rating_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  slugIdx: index('idx_skill_slug').on(table.slug),
  categoryIdx: index('idx_skill_category').on(table.category),
  authorIdx: index('idx_skill_author').on(table.authorId),
}));

// ===========================================
// Social Features (Generic)
// ===========================================

export const collections = pgTable('collections', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),  // 'mcp' | 'skill' | 'datasource'
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').references(() => users.id),
  isPublic: boolean('is_public').default(true),
  favoritesCount: integer('favorites_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const collectionItems = pgTable('collection_items', {
  collectionId: text('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  note: text('note'),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.collectionId, table.entityId] }),
}));

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  userId: text('user_id').references(() => users.id),
  content: text('content').notNull(),
  parentId: text('parent_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  entityIdx: index('idx_comments_entity').on(table.entityType, table.entityId),
}));

export const favorites = pgTable('favorites', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.entityType, table.entityId] }),
  entityIdx: index('idx_favorites_entity').on(table.entityType, table.entityId),
}));

export const ratings = pgTable('ratings', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  score: integer('score').notNull(),  // 1-5
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.entityType, table.entityId] }),
  entityIdx: index('idx_ratings_entity').on(table.entityType, table.entityId),
}));

// ===========================================
// Package Releases (Upload/Download)
// ===========================================

export const packageReleases = pgTable('package_releases', {
  id: text('id').primaryKey(),
  packageType: text('package_type').notNull(),  // 'mcp' | 'skill'
  packageId: text('package_id').notNull(),
  version: text('version').notNull(),
  releaseNotes: text('release_notes'),
  status: text('status').default('draft'),  // 'draft' | 'published' | 'deprecated'
  storageRef: text('storage_ref'),
  fileSize: integer('file_size'),
  checksum: text('checksum'),
  publishedBy: text('published_by').references(() => users.id),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  downloadsCount: integer('downloads_count').default(0),
}, (table) => ({
  packageUnique: unique().on(table.packageType, table.packageId, table.version),
  packageIdx: index('idx_releases_package').on(table.packageType, table.packageId),
  statusIdx: index('idx_releases_status').on(table.status),
}));

export const downloadRecords = pgTable('download_records', {
  id: text('id').primaryKey(),
  packageType: text('package_type').notNull(),
  packageId: text('package_id').notNull(),
  releaseId: text('release_id').notNull().references(() => packageReleases.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  downloadedAt: timestamp('downloaded_at').defaultNow(),
}, (table) => ({
  packageIdx: index('idx_downloads_package').on(table.packageType, table.packageId),
  timeIdx: index('idx_downloads_time').on(table.downloadedAt),
}));

// ===========================================
// Workspaces (User's local configuration, synced)
// ===========================================

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  projectDir: text('project_dir').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
});

export const workspaceEntities = pgTable('workspace_entities', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),  // 'mcp' | 'skill' | 'agent'
  entityId: text('entity_id').notNull(),
  enabled: boolean('enabled').default(true),
  config: json('config'),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.entityType, table.entityId] }),
  wsIdx: index('idx_workspace_entities').on(table.workspaceId, table.entityType),
}));

// ===========================================
// Relations
// ===========================================

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  oauthConnections: many(oauthConnections),
  organizations: many(organizations),
  mcpPackages: many(mcpPackages),
  skillPackages: many(skillPackages),
  workspaces: many(workspaces),
}));

export const mcpPackagesRelations = relations(mcpPackages, ({ one, many }) => ({
  author: one(users, {
    fields: [mcpPackages.authorId],
    references: [users.id],
  }),
  releases: many(packageReleases),
}));

export const skillPackagesRelations = relations(skillPackages, ({ one, many }) => ({
  author: one(users, {
    fields: [skillPackages.authorId],
    references: [users.id],
  }),
  releases: many(packageReleases),
}));
```

### Database Client (`apps/web/lib/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.POSTGRES_URL!;
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
```

### Drizzle Config (`apps/web/drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
```

---

## Implementation Roadmap

### Phase 1: Foundation + User System (Core Infrastructure)

**Duration**: Weeks 1-3

| Task | Description | Priority |
|------|-------------|----------|
| Database Setup | SQLite schema, migrations, Alembic | P0 |
| Base API Layer | FastAPI setup, routing, error handling | P0 |
| **User Registration** | Email/password signup, validation | P0 |
| **User Authentication** | JWT tokens, refresh flow | P0 |
| **OAuth Integration** | GitHub OAuth login | P0 |
| **API Key Management** | Create/revoke API keys | P1 |
| Shared Models | Common dataclasses, Pydantic models | P0 |
| Frontend Shell | Navigation, layout, routing | P0 |
| **Login/Register UI** | Auth pages, protected routes | P0 |

**Deliverables**:
- Database migrations working
- User registration and login functional
- GitHub OAuth working
- API server skeleton with auth middleware
- Frontend navigation with auth state

### Phase 2: MCP Marketplace (Core Feature)

**Duration**: Weeks 4-5

| Task | Description | Priority |
|------|-------------|----------|
| MCP CRUD | Package create/read/update/delete | P0 |
| MCP Listing | Grid view, search, filters | P0 |
| MCP Detail Page | Full package info display | P0 |
| Collections | Create/manage collections | P1 |
| Social Features | Favorites, comments, ratings | P1 |

**Deliverables**:
- Functional MCP marketplace
- Collection management
- Basic social features

### Phase 3: Skills Marketplace (Parallel Feature)

**Duration**: Weeks 6-7

| Task | Description | Priority |
|------|-------------|----------|
| Skills CRUD | Package create/read/update/delete | P0 |
| Skills Listing | Grid view, search, filters | P0 |
| Skills Detail Page | Full skill info display | P0 |
| Collections | Create/manage skill collections | P1 |
| Social Features | Favorites, comments, ratings | P1 |

**Deliverables**:
- Functional Skills marketplace
- Skill collection management
- Social features

### Phase 4: Package Upload/Download System (Developer Feature)

**Duration**: Weeks 8-10

| Task | Description | Priority |
|------|-------------|----------|
| **Storage Backend Interface** | Abstract storage layer | P0 |
| **HuggingFace Backend** | Default storage implementation | P0 |
| **Package Upload API** | Multipart upload, validation | P0 |
| **Package Download API** | Signed URLs, streaming | P0 |
| **Release Management** | Draft/publish/deprecate flow | P0 |
| **Package Validation** | Manifest validation, security checks | P1 |
| **CLI Tool** | `browse-mcp` CLI for developers | P1 |
| **Download Analytics** | Track downloads per package | P2 |

**Deliverables**:
- Developers can upload MCP/Skill packages
- Users can download packages
- Storage backend abstracted (HuggingFace hidden)
- Basic CLI for package management

### Phase 5: Global Management (Operations)

**Duration**: Weeks 11-12

| Task | Description | Priority |
|------|-------------|----------|
| Server Management | Start/stop/restart MCP servers | P0 |
| Log Monitoring | Real-time log streaming | P0 |
| Status Dashboard | Overview of all services | P0 |
| Enable/Disable | Global toggle for entities | P1 |
| Agent Installation | Install to specific agents | P1 |

**Deliverables**:
- Server lifecycle management
- Log monitoring UI
- Status dashboard

### Phase 6: Workspace System (Advanced Feature)

**Duration**: Weeks 13-14

| Task | Description | Priority |
|------|-------------|----------|
| Workspace CRUD | Create/manage workspaces | P0 |
| MCP Assignment | Assign MCPs to workspace | P0 |
| Skill Assignment | Assign Skills to workspace | P0 |
| Agent Config | Per-workspace agent settings | P1 |
| Config Export | Export workspace config | P2 |

**Deliverables**:
- Workspace management
- Entity assignment
- Configuration export

### Phase 7: Data Browse Enhancement

**Duration**: Weeks 15-16

| Task | Description | Priority |
|------|-------------|----------|
| Data Source Collections | Group data sources | P1 |
| Social for Sources | Favorites, comments | P1 |
| Source Management | CRUD for sources | P1 |

**Deliverables**:
- Enhanced Data Browse
- Data source collections

---

## Routes Structure

### Web App Routes (`apps/web/app/`)

```
app/
├── page.tsx                           # / - Landing page
├── (auth)/                            # Auth group (no sidebar)
│   ├── login/page.tsx                 # /login
│   ├── register/page.tsx              # /register
│   └── layout.tsx                     # Auth layout
│
├── (dashboard)/                       # Dashboard group (with sidebar)
│   ├── layout.tsx                     # Dashboard layout
│   │
│   ├── mcp/
│   │   ├── page.tsx                   # /mcp - Marketplace
│   │   ├── [id]/
│   │   │   ├── page.tsx               # /mcp/[id] - Detail
│   │   │   └── releases/page.tsx      # /mcp/[id]/releases - Manage
│   │   ├── publish/page.tsx           # /mcp/publish
│   │   └── collections/
│   │       ├── page.tsx               # /mcp/collections
│   │       └── [id]/page.tsx          # /mcp/collections/[id]
│   │
│   ├── skills/
│   │   └── ... (same as mcp)
│   │
│   ├── workspaces/
│   │   ├── page.tsx                   # /workspaces
│   │   └── [id]/page.tsx              # /workspaces/[id]
│   │
│   ├── profile/
│   │   ├── page.tsx                   # /profile
│   │   └── api-keys/page.tsx          # /profile/api-keys
│   │
│   └── orgs/
│       ├── page.tsx                   # /orgs
│       ├── new/page.tsx               # /orgs/new
│       └── [slug]/
│           ├── page.tsx               # /orgs/[slug]
│           └── members/page.tsx       # /orgs/[slug]/members
│
└── api/                               # API Routes
    └── ... (see API Design section)
```

### API Routes (`apps/web/app/api/`)

```
api/
├── auth/
│   ├── github/route.ts                # OAuth redirect
│   ├── github/callback/route.ts       # OAuth callback
│   ├── login/route.ts                 # POST: email/password login
│   ├── register/route.ts              # POST: create account
│   ├── signout/route.ts               # POST: logout
│   └── info/route.ts                  # GET: current user
│
├── users/
│   ├── route.ts                       # GET: list users
│   ├── me/route.ts                    # GET/PUT: current user
│   ├── [username]/route.ts            # GET: public profile
│   └── api-keys/
│       ├── route.ts                   # GET/POST: list/create
│       └── [id]/route.ts              # DELETE: revoke
│
├── orgs/
│   ├── route.ts                       # GET/POST
│   └── [slug]/
│       ├── route.ts                   # GET/PUT/DELETE
│       └── members/route.ts           # GET/POST/DELETE
│
├── mcp/
│   ├── route.ts                       # GET: list, POST: create
│   ├── search/route.ts                # GET: search
│   └── [id]/
│       ├── route.ts                   # GET/PUT/DELETE
│       ├── favorite/route.ts          # POST: toggle
│       ├── comments/route.ts          # GET/POST
│       ├── rating/route.ts            # POST
│       └── releases/
│           ├── route.ts               # GET: list releases
│           └── [version]/
│               ├── route.ts           # GET/PUT/DELETE
│               └── publish/route.ts   # POST: publish
│
├── skills/
│   └── ... (same pattern as mcp)
│
├── packages/
│   ├── upload/route.ts                # POST: upload package
│   └── [type]/[id]/
│       ├── download/route.ts          # GET: latest version
│       └── download/[version]/route.ts # GET: specific version
│
└── workspaces/
    ├── route.ts                       # GET/POST
    └── [id]/
        ├── route.ts                   # GET/PUT/DELETE
        └── entities/route.ts          # GET/POST/DELETE
```

---

## Technology Stack Decisions

### Full-Stack Platform (`apps/web` - Next.js on Vercel)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 15 (App Router) | Full-stack, Vercel-native, SSR/SSG |
| Runtime | Node.js 20 | LTS, Vercel default |
| Database | PostgreSQL (Neon) | Serverless, Vercel integration |
| ORM | Drizzle ORM | Type-safe, lightweight, edge-compatible |
| Auth | JWE (jose) + OAuth | Secure sessions, GitHub/Vercel OAuth |
| State | Jotai | Atomic state management |
| UI | shadcn/ui + Tailwind | Consistent with existing desktop app |
| Storage Backend | HuggingFace Hub (JS SDK) | Package file storage (abstracted) |

### Desktop Client (`apps/desktop`)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Tauri + React | Existing, cross-platform |
| API Client | fetch / TanStack Query | REST API consumption |
| Local Storage | SQLite (via Tauri) | Workspace cache, offline support |

### MCP Server (`backend/browse-mcp` - Python)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| MCP Framework | FastMCP | Standard MCP protocol implementation |
| Plugin System | Stevedore | Entry-point based plugin discovery |
| HTTP Client | httpx | Async HTTP for data sources |

> **Note**: MCP server remains Python because FastMCP is the standard MCP implementation. Desktop app spawns and manages MCP server processes locally.

### Frontend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React 19 | Already in use |
| State | Zustand/TanStack Query | Simple, performant |
| Routing | React Router v7 | Already in use |
| UI | shadcn/ui | Already in use |
| Forms | React Hook Form + Zod | Type-safe validation |

---

## File Structure (New)

```
# Monorepo Root
├── apps/
│   │
│   ├── web/                         # NEW: Next.js Full-Stack (Vercel)
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── drizzle.config.ts        # Drizzle ORM config
│   │   ├── vercel.json              # Vercel deployment config
│   │   │
│   │   ├── app/                     # Next.js App Router
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── page.tsx             # Home page
│   │   │   │
│   │   │   ├── (auth)/              # Auth pages (grouped)
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   │
│   │   │   ├── (dashboard)/         # Dashboard pages (grouped)
│   │   │   │   ├── mcp/
│   │   │   │   │   ├── page.tsx           # MCP marketplace
│   │   │   │   │   ├── [id]/page.tsx      # MCP detail
│   │   │   │   │   └── publish/page.tsx   # Publish MCP
│   │   │   │   ├── skills/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/page.tsx
│   │   │   │   │   └── publish/page.tsx
│   │   │   │   ├── workspaces/
│   │   │   │   ├── profile/
│   │   │   │   └── layout.tsx       # Dashboard layout with sidebar
│   │   │   │
│   │   │   └── api/                 # API Routes (REST endpoints)
│   │   │       ├── auth/
│   │   │       │   ├── github/
│   │   │       │   │   ├── route.ts       # GET: redirect to GitHub
│   │   │       │   │   └── callback/route.ts
│   │   │       │   ├── login/route.ts     # POST: email/password
│   │   │       │   ├── register/route.ts  # POST: create account
│   │   │       │   ├── signout/route.ts   # POST: logout
│   │   │       │   └── info/route.ts      # GET: current user
│   │   │       │
│   │   │       ├── users/
│   │   │       │   ├── route.ts           # GET: list, POST: create
│   │   │       │   ├── me/route.ts        # GET/PUT: current user
│   │   │       │   ├── [username]/route.ts
│   │   │       │   └── api-keys/
│   │   │       │       ├── route.ts       # GET/POST
│   │   │       │       └── [id]/route.ts  # DELETE
│   │   │       │
│   │   │       ├── orgs/
│   │   │       │   ├── route.ts
│   │   │       │   └── [slug]/
│   │   │       │       ├── route.ts
│   │   │       │       └── members/route.ts
│   │   │       │
│   │   │       ├── mcp/
│   │   │       │   ├── route.ts           # GET: list, POST: create
│   │   │       │   ├── search/route.ts    # GET: search
│   │   │       │   └── [id]/
│   │   │       │       ├── route.ts       # GET/PUT/DELETE
│   │   │       │       ├── favorite/route.ts
│   │   │       │       ├── comments/route.ts
│   │   │       │       └── releases/
│   │   │       │           ├── route.ts
│   │   │       │           └── [version]/route.ts
│   │   │       │
│   │   │       ├── skills/
│   │   │       │   └── ... (same pattern as mcp)
│   │   │       │
│   │   │       ├── packages/
│   │   │       │   ├── upload/route.ts    # POST: upload package
│   │   │       │   └── [type]/[id]/
│   │   │       │       ├── download/route.ts
│   │   │       │       └── download/[version]/route.ts
│   │   │       │
│   │   │       └── workspaces/
│   │   │           ├── route.ts
│   │   │           └── [id]/route.ts
│   │   │
│   │   ├── components/              # React components
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── auth/                # Auth components
│   │   │   ├── mcp/                 # MCP components
│   │   │   ├── skills/              # Skills components
│   │   │   └── shared/              # Shared components
│   │   │
│   │   ├── lib/                     # Business logic & utilities
│   │   │   ├── db/
│   │   │   │   ├── index.ts         # Database client (Drizzle)
│   │   │   │   ├── schema.ts        # All table schemas
│   │   │   │   └── migrations/      # Drizzle migrations
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── session.ts       # JWE session management
│   │   │   │   ├── oauth.ts         # OAuth helpers
│   │   │   │   └── middleware.ts    # Auth middleware
│   │   │   │
│   │   │   ├── storage/
│   │   │   │   ├── index.ts         # Storage interface
│   │   │   │   ├── huggingface.ts   # HuggingFace backend
│   │   │   │   └── local.ts         # Local backend (dev)
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── mcp.ts           # MCP business logic
│   │   │   │   ├── skills.ts        # Skills business logic
│   │   │   │   ├── packages.ts      # Upload/download logic
│   │   │   │   └── social.ts        # Comments, favorites
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── encryption.ts    # Data encryption
│   │   │       └── validation.ts    # Zod schemas
│   │   │
│   │   └── public/                  # Static assets
│   │
│   └── desktop/                     # Existing: Tauri Desktop App
│       ├── src/                     # React frontend
│       │   ├── pages/
│       │   ├── components/
│       │   ├── hooks/
│       │   │   └── use-api.ts       # API client hook (calls Vercel)
│       │   └── stores/
│       └── src-tauri/               # Rust backend
│           └── src/
│               └── commands/
│                   └── mcp.rs       # Local MCP server management
│
├── backend/                         # Python packages (MCP only)
│   │
│   ├── browse-mcp/                  # Existing: MCP Server
│   │   └── browse_mcp/
│   │       ├── __main__.py
│   │       ├── types.py
│   │       ├── plugin.py
│   │       └── sources/
│   │
│   └── plugins/                     # MCP plugins
│       ├── browse-mcp-plugin-context7/
│       └── browse-mcp-plugin-social-media/
│
├── packages/                        # Shared packages (optional)
│   └── shared-types/                # Shared TypeScript types
│       ├── package.json
│       └── src/
│           ├── mcp.ts
│           ├── skill.ts
│           └── user.ts
│
└── package.json                     # Root package.json (pnpm workspace)
```

apps/desktop/src/
├── pages/
│   ├── auth/                    # New: Authentication pages
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── profile/                 # New: User profile
│   │   ├── index.tsx
│   │   ├── edit.tsx
│   │   └── api-keys.tsx
│   ├── orgs/                    # New: Organizations
│   │   ├── index.tsx
│   │   ├── new.tsx
│   │   └── [slug]/
│   │       ├── index.tsx
│   │       ├── settings.tsx
│   │       └── members.tsx
│   ├── mcp/                     # MCP marketplace pages
│   │   ├── index.tsx
│   │   ├── [id]/
│   │   │   ├── index.tsx
│   │   │   ├── versions.tsx
│   │   │   ├── releases.tsx     # Developer: manage releases
│   │   │   └── stats.tsx        # Developer: analytics
│   │   ├── collections/
│   │   └── publish.tsx
│   ├── skills/                  # Skills marketplace pages
│   │   ├── index.tsx
│   │   ├── [id]/
│   │   │   ├── index.tsx
│   │   │   ├── versions.tsx
│   │   │   ├── releases.tsx
│   │   │   └── stats.tsx
│   │   ├── collections/
│   │   └── publish.tsx
│   ├── global/                  # Global management
│   │   ├── index.tsx
│   │   ├── servers/
│   │   └── agents/
│   ├── workspaces/              # Workspace management
│   │   ├── index.tsx
│   │   └── [id]/
│   └── browse/                  # Enhanced: Data Browse
│       ├── index.tsx
│       ├── sources/
│       └── collections/
│
├── components/
│   ├── auth/                    # Auth components
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   ├── oauth-buttons.tsx
│   │   └── protected-route.tsx
│   ├── user/                    # User components
│   │   ├── avatar.tsx
│   │   ├── profile-card.tsx
│   │   └── api-key-list.tsx
│   ├── mcp/
│   ├── skills/
│   ├── packages/                # Upload/download components
│   │   ├── upload-wizard.tsx
│   │   ├── release-manager.tsx
│   │   ├── download-button.tsx
│   │   └── version-selector.tsx
│   ├── workspaces/
│   └── shared/
│
├── hooks/
│   ├── use-auth.ts              # Auth state and actions
│   ├── use-user.ts              # Current user
│   ├── use-mcp.ts
│   ├── use-skills.ts
│   ├── use-packages.ts          # Upload/download
│   ├── use-workspaces.ts
│   └── use-servers.ts
│
├── stores/
│   ├── auth-store.ts            # Auth state (tokens, user)
│   ├── mcp-store.ts
│   ├── skills-store.ts
│   └── workspace-store.ts
│
└── lib/
    ├── api-client.ts            # Axios instance with auth
    └── auth.ts                  # Token management
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| MCP Package Count | 50+ packages | Database count |
| Skill Package Count | 100+ skills | Database count |
| User Collections | 10+ per user average | User analytics |
| Server Uptime | 99.9% | Monitoring |
| API Response Time | <200ms p95 | Performance monitoring |
| HF Sync Success Rate | >95% | Sync history |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| HuggingFace API Changes | Medium | High | Abstract HF calls, version lock |
| SQLite Concurrency | Low | Medium | Use WAL mode, connection pooling |
| Process Management Cross-Platform | Medium | Medium | Extensive testing on Win/Mac/Linux |
| Scope Creep | High | High | Strict phase gating, MVP focus |

---

## Next Steps

1. **Review this document** with stakeholders
2. **Prioritize phases** based on business needs
3. **Create detailed task breakdown** for Phase 1
4. **Set up project tracking** (GitHub Issues/Projects)
5. **Begin Phase 1** implementation

---

## Vercel Deployment Configuration

### `apps/web/vercel.json`

```json
{
  "functions": {
    "app/api/packages/upload/route.ts": {
      "maxDuration": 300
    }
  },
  "crons": []
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Neon PostgreSQL connection string |
| `JWE_SECRET` | Yes | 32-byte secret for session encryption |
| `ENCRYPTION_KEY` | Yes | 32-byte key for data encryption |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (e.g., https://browse-mcp.vercel.app) |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |
| `HF_TOKEN` | Yes | HuggingFace API token for storage |
| `HF_NAMESPACE` | No | Default HF namespace for uploads |

### One-Click Deploy Template (`vercel-template.json`)

```json
{
  "name": "browse-mcp-platform",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "envVars": {
    "POSTGRES_URL": {
      "description": "PostgreSQL connection string",
      "required": true,
      "generator": "neon"
    },
    "JWE_SECRET": {
      "description": "Session encryption secret (32 bytes)",
      "required": true,
      "generator": "secret"
    },
    "ENCRYPTION_KEY": {
      "description": "Data encryption key (32 bytes)",
      "required": true,
      "generator": "secret"
    },
    "GITHUB_CLIENT_ID": {
      "description": "GitHub OAuth Client ID",
      "required": true
    },
    "GITHUB_CLIENT_SECRET": {
      "description": "GitHub OAuth Client Secret",
      "required": true
    }
  }
}
```

---

## Key Design Decisions Summary

### 1. Next.js Full-Stack on Vercel

**Why Next.js instead of Python FastAPI?**
- Single codebase for frontend + backend
- Vercel-native deployment (serverless, edge)
- TypeScript end-to-end type safety
- React Server Components for optimal performance
- Reference: `coding-agent-template` proven architecture

### 2. User System First

User authentication and identity is the foundation for all social features (favorites, comments, ratings) and the upload/download system. Build this first.

### 3. Storage Backend Abstraction

The API never exposes HuggingFace or any specific storage provider to clients. This allows:
- Switching backends without API changes
- Different backends for dev/test/prod
- Future migration to other providers (S3, R2, etc.)

### 4. Desktop App as API Consumer

| Concern | Web App | Desktop App |
|---------|---------|-------------|
| Backend API | Hosts it | Consumes it |
| MCP Server Management | N/A | Local process control |
| Database | PostgreSQL (Neon) | SQLite (local cache) |
| Offline Support | No | Yes (limited) |

### 5. Developer vs Consumer Experience

| Feature | Consumer (User) | Developer |
|---------|-----------------|-----------|
| Browse/Search | Yes | Yes |
| Download | Yes | Yes |
| Favorites/Comments | Yes | Yes |
| Upload Packages | No | Yes |
| Manage Releases | No | Yes |
| View Analytics | No | Yes (own packages) |

### 6. Auth Methods

| Use Case | Auth Method |
|----------|-------------|
| Web UI | JWE Session (httpOnly cookie) |
| Desktop App | API Key stored locally |
| CLI Tools | API Key |
| CI/CD Pipelines | API Key |

---

**Document Version**: 3.0.0
**Last Updated**: 2026-02-04
**Author**: AI Assistant (Claude)

**Changelog**:
- v3.0.0: **Major rewrite** - Switched from Python FastAPI to Next.js full-stack
  - Backend now at `apps/web/` (Next.js App Router)
  - Database changed from SQLite to PostgreSQL (Neon) + Drizzle ORM
  - Deployment target: Vercel (serverless)
  - Desktop app consumes Vercel-hosted API
  - Reference implementation: `coding-agent-template`
- v2.1.0: Separated backend into two packages
- v2.0.0: Added User System, storage abstraction
- v1.0.0: Initial planning document
