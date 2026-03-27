---
sidebar_position: 1
---

# Backend Development Guide

> Viben project backend development best practices

---

## Overview

This directory contains backend development guidelines. The backend is built with TypeScript in `packages/core`, serving as the foundation for all frontend applications.

**Important**: `packages/core` is the sole boundary for all apps to access underlying capabilities.

## Architecture

> **Important**: Viben uses a dual-language architecture:

| Component | Language | Purpose |
|-----------|----------|---------|
| `packages/core` | TypeScript | Gateway API, CLI, Agent system, MCP client |
| `backend/browse-mcp` | Python | Academic search MCP server (arXiv, PubMed, etc.) |

**The guidelines in this directory primarily focus on `packages/core` (TypeScript).**

For Python MCP server development, see [Plugin Architecture](./plugin-architecture.md), which documents the stevedore-based plugin system in `backend/browse-mcp`.

---

## Guide Index

### Core Guides

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Done |
| [Plugin Architecture](./plugin-architecture.md) | Python MCP pluggable Provider system | Done |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | Done |
| [Error Handling](./error-handling.md) | Error types, handling strategies | Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Done |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | Done |

### Gateway API

| Guide | Description | Status |
|-------|-------------|--------|
| [Gateway Index](/backend/gateway/) | Gateway module index | Done |
| [Health Check](/backend/gateway/health) | Health check endpoint | Done |
| [Agent API](/backend/gateway/agents) | Agent management API | Done |
| [Model API](/backend/gateway/models) | Model configuration API | Done |
| [Session API](/backend/gateway/sessions) | Session management API | Done |
| [Group Chat API](/backend/gateway/group-chats) | Group chat API | Done |
| [Executor API](/backend/gateway/executors) | Executor execution API | Done |
| [Cron API](/backend/gateway/cron) | Scheduled task API | Done |
| [Channel API](/backend/gateway/channels) | Channel management API | Done |
| [Provider API](/backend/gateway/providers) | Provider configuration API | Done |
| [Task API](/backend/gateway/tasks) | Task management API | Done |
| [Chat List API](/backend/gateway/chat-list) | Chat list aggregation API | Done |
| [Event Stream API](/backend/gateway/events) | SSE event stream | Done |
| [WebSocket](/backend/gateway/websocket) | WebSocket real-time communication | Done |

### Web API

| Guide | Description | Status |
|-------|-------------|--------|
| [MCP API](./api/mcp-api.md) | MCP package API | Done |
| [Skill API](./api/skill-api.md) | Skill package API | Done |
| [User API](./api/user-api.md) | User management API | Done |
| [Social API](./api/social-api.md) | Social features API | Done |
| [Collections API](./api/collections-api.md) | Collections API | Done |
| [Package Management](./api/packages.md) | Common package operations | Done |

### Modules

| Guide | Description | Status |
|-------|-------------|--------|
| [Auth Module](./modules/auth.md) | Authentication system | Done |
| [Database Module](./modules/database.md) | Database configuration | Done |
| [Storage Module](./modules/storage.md) | File storage | Done |
| [Project Setup](./modules/project-setup.md) | Project initialization | Done |

### Deployment

| Guide | Description | Status |
|-------|-------------|--------|
| [Vercel Deployment](./deployment/vercel.md) | Vercel deployment guide | Done |
| [GitHub OAuth](./deployment/github-oauth.md) | GitHub OAuth integration | Done |

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **HTTP Framework**: Hono
- **AI SDK**: Vercel AI SDK
- **Configuration**: YAML (file-native paradigm)
- **Storage**: File-based (`~/.viben/`)
- **Telemetry**: OpenTelemetry

---

## API Naming Convention

**Important**: All Gateway API query parameters use **snake_case** format:

```typescript
// Correct
workspace_path, include_global, session_id

// Incorrect
workspacePath, includeGlobal, sessionId
```

---

**Language**: Documentation in English, code comments in English.
