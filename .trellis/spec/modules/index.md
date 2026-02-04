# Module Specifications Index

> Detailed specifications for each task in the Platform Upgrade v3.0.

---

## Overview

This directory contains detailed specifications for implementing each module of the Browse MCP Platform. Each spec includes:

- Objectives and deliverables
- Code examples and API definitions
- Acceptance criteria
- Implementation notes

---

## Module List

### Phase 0: Foundation

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [project-setup.md](./project-setup.md) | T0: Next.js project initialization | 3 | Pending |

### Phase 1: Core Infrastructure

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [database.md](./database.md) | T1: Drizzle schema and migrations | 3 | Pending |
| [auth.md](./auth.md) | T2: JWE session management | 3 | Pending |
| [ui-shell.md](./ui-shell.md) | T3: Layout, navigation, theming | 2 | Pending |

### Phase 2: User System

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [user-api.md](./user-api.md) | T4: User CRUD, OAuth, API keys | 5 | Pending |
| [auth-ui.md](./auth-ui.md) | T7: Login, register pages | 3 | Pending |
| [profile-ui.md](./profile-ui.md) | T10: Profile page, API key management | 3 | Pending |

### Phase 3: Marketplace Core

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [mcp-api.md](./mcp-api.md) | T5: MCP package CRUD, search | 5 | Pending |
| [skills-api.md](./skills-api.md) | T6: Skills package CRUD, search | 5 | Pending |
| [mcp-ui.md](./mcp-ui.md) | T8: MCP marketplace pages | 5 | Pending |
| [skills-ui.md](./skills-ui.md) | T9: Skills marketplace pages | 5 | Pending |

### Phase 4: Social & Storage

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [social-api.md](./social-api.md) | T11: Favorites, comments, ratings | 3 | Pending |
| [storage.md](./storage.md) | T12: HuggingFace storage backend | 5 | Pending |
| [packages.md](./packages.md) | T13: Upload/download API | 5 | Pending |

### Phase 5: Advanced Features

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [workspace-api.md](./workspace-api.md) | T14: Workspace CRUD | 3 | Pending |
| [collections-api.md](./collections-api.md) | T15: Collections CRUD | 3 | Pending |
| [publish-ui.md](./publish-ui.md) | T16: Package publish wizard | 3 | Pending |
| [workspace-ui.md](./workspace-ui.md) | T17: Workspace management | 3 | Pending |
| [collections-ui.md](./collections-ui.md) | T18: Collection pages | 3 | Pending |
| [analytics-ui.md](./analytics-ui.md) | T19: Download statistics | 2 | Pending |

### Phase 6: Integration & Polish

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [desktop-integration.md](./desktop-integration.md) | T20: Desktop app API client | 3 | Pending |
| [deployment.md](./deployment.md) | T21: Vercel deployment | 5 | Pending |

### Phase 7: Admin System

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [admin-ui.md](./admin-ui.md) | T22: Admin dashboard, package & content moderation | 8 | Pending |

### Cross-Cutting Concerns

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [workspace-management.md](./workspace-management.md) | Multi-workspace MCP/Skills management system | 13 | Planning |

---

## Quick Reference

### Critical Path

```
T0 → T1 → T4 → T5 → T11 → T13 → T16 → T21
```

### Parallel Groups

| Group | Tasks | Can Start After |
|-------|-------|-----------------|
| G1 | T1, T2, T3 | T0 |
| G2 | T5, T6, T7 | T4 |
| G3 | T8, T9, T10 | T5, T6, T7 |
| G4 | T11, T12 | T5, T6 |
| G5 | T14, T15, T16 | T13 |
| G6 | T17, T18, T19, T20 | T14, T15, T16, T13 |

---

## How to Use These Specs

1. **Before starting a task**: Read the full spec to understand scope
2. **During implementation**: Follow code examples and patterns
3. **Before marking done**: Verify all acceptance criteria are met
4. **If blocked**: Check dependencies in [task-dag.md](../task-dag.md)

---

## Related Documents

- [Platform Upgrade v3.0](../platform-upgrade-v2.md) - Master planning document
- [Task DAG](../task-dag.md) - Task dependency graph
- [Backend Guidelines](../backend/index.md) - Development standards
- [Frontend Guidelines](../frontend/index.md) - UI/UX standards
