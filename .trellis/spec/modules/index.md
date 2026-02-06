# Module Specifications Index

> Detailed specifications for each task in the Platform Upgrade v3.0.
> **Status: ALL CORE MODULES COMPLETED** ✅

---

## Overview

This directory contains detailed specifications for implementing each module of the Viben Platform. Each spec includes:

- Objectives and deliverables
- Code examples and API definitions
- Acceptance criteria
- Implementation notes

---

## Module List

### Phase 0: Foundation

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [project-setup.md](./project-setup.md) | T0: Next.js project initialization | 3 | ✅ Done |

### Phase 1: Core Infrastructure

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [database.md](./database.md) | T1: Drizzle schema and migrations | 3 | ✅ Done |
| [auth.md](./auth.md) | T2: JWE session management | 3 | ✅ Done |
| [ui-shell.md](./ui-shell.md) | T3: Layout, navigation, theming | 2 | ✅ Done |

### Phase 2: User System

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [user-api.md](./user-api.md) | T4: User CRUD, OAuth, API keys | 5 | ✅ Done |
| [auth-ui.md](./auth-ui.md) | T7: Login, register pages | 3 | ✅ Done |
| [profile-ui.md](./profile-ui.md) | T10: Profile page, API key management | 3 | ✅ Done |

### Phase 3: Marketplace Core

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [mcp-api.md](./mcp-api.md) | T5: MCP package CRUD, search | 5 | ✅ Done |
| [skills-api.md](./skills-api.md) | T6: Skills package CRUD, search | 5 | ✅ Done |
| [mcp-ui.md](./mcp-ui.md) | T8: MCP marketplace pages | 5 | ✅ Done |
| [skills-ui.md](./skills-ui.md) | T9: Skills marketplace pages | 5 | ✅ Done |

### Phase 4: Social & Storage

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [social-api.md](./social-api.md) | T11: Favorites, comments, ratings | 3 | ✅ Done |
| [storage.md](./storage.md) | T12: HuggingFace storage backend | 5 | ✅ Done |
| [packages.md](./packages.md) | T13: Upload/download API | 5 | ✅ Done |

### Phase 5: Advanced Features

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [workspace-api.md](./workspace-api.md) | T14: Workspace CRUD | 3 | ✅ Done |
| [collections-api.md](./collections-api.md) | T15: Collections CRUD | 3 | ✅ Done |
| [publish-ui.md](./publish-ui.md) | T16: Package publish wizard | 3 | ✅ Done |
| [workspace-ui.md](./workspace-ui.md) | T17: Workspace management | 3 | ✅ Done |
| [collections-ui.md](./collections-ui.md) | T18: Collection pages | 3 | ✅ Done |
| [analytics-ui.md](./analytics-ui.md) | T19: Download statistics | 2 | ✅ Done |

### Phase 6: Integration & Polish

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [desktop-integration.md](./desktop-integration.md) | T20: Desktop app API client | 3 | ✅ Done |
| [deployment.md](./deployment.md) | T21: Vercel deployment | 5 | ✅ Done |

### Phase 7: Admin System

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [admin-ui.md](./admin-ui.md) | T22: Admin dashboard, package & content moderation | 8 | ✅ Done |

### Cross-Cutting Concerns

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [workspace-management.md](./workspace-management.md) | Multi-workspace MCP/Skills management system | 13 | ✅ Done |
| [kanban-integration.md](./kanban-integration.md) | 工作空间任务看板 (vibe-kanban 集成) | 8 | 📝 Specification |
| [cli-app.md](./cli-app.md) | Bootstrap CLI: config, service, agent/mcp/skill management | 8 | 📝 Specification |
| [desktop-cli-integration.md](./desktop-cli-integration.md) | Desktop-CLI 集成: @viben/core 共享库, UI 页面 | 5 | 📝 Specification |
| [desktop-creator-section.md](./desktop-creator-section.md) | Desktop 创作者章节 (Publish, My Packages, Analytics) | 3 | 📝 Specification |

### Shared Packages

| Package | Description | Priority | Status |
|---------|-------------|----------|--------|
| [package-ui.md](./package-ui.md) | `@viben/ui` - 共享 UI 组件库 | P0 | ✅ Done |
| [package-kanban.md](./package-kanban.md) | `@viben/kanban` - Kanban 核心组件 | P1 | 📝 Specification |

---

## Quick Reference

### Critical Path (COMPLETED)

```
T0 → T1 → T4 → T5 → T11 → T13 → T16 → T21 ✅
```

### Parallel Groups (ALL COMPLETED)

| Group | Tasks | Status |
|-------|-------|--------|
| G1 | T1, T2, T3 | ✅ |
| G2 | T5, T6, T7 | ✅ |
| G3 | T8, T9, T10 | ✅ |
| G4 | T11, T12 | ✅ |
| G5 | T14, T15, T16 | ✅ |
| G6 | T17, T18, T19, T20 | ✅ |

---

## How to Use These Specs

These specs serve as reference documentation for the implemented features:

1. **Understanding architecture**: Read specs to understand design decisions
2. **Maintaining code**: Follow patterns established in specs
3. **Adding features**: Use specs as templates for new modules

---

## Related Documents

- [Platform Upgrade v3.0](../platform-upgrade-v2.md) - Master planning document
- [Task DAG](../task-dag.md) - Task dependency graph
- [Backend Guidelines](../backend/index.md) - Development standards
- [Frontend Guidelines](../frontend/index.md) - UI/UX standards
