# Platform Upgrade v3.0 - Task DAG

> Task Directed Acyclic Graph for implementing the AI Tool Platform.

---

## Visual DAG

```
                                    ┌─────────────────┐
                                    │   T0: Project   │
                                    │     Setup       │
                                    └────────┬────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                         ▼                   ▼                   ▼
                ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                │  T1: Database   │ │  T2: Auth Core  │ │  T3: UI Shell   │
                │    Schema       │ │    (JWE)        │ │  (Layout)       │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         └─────────┬─────────┘                   │
                                   │                             │
                                   ▼                             │
                         ┌─────────────────┐                     │
                         │  T4: User API   │                     │
                         │  (CRUD + OAuth) │                     │
                         └────────┬────────┘                     │
                                  │                              │
                         ┌────────┴────────┐                     │
                         │                 │                     │
                         ▼                 ▼                     ▼
                ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                │  T5: MCP API    │ │  T6: Skills API │ │  T7: Auth UI    │
                │    (CRUD)       │ │    (CRUD)       │ │  (Login/Reg)    │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         │                   │                   │
                         ▼                   ▼                   ▼
                ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                │  T8: MCP UI     │ │  T9: Skills UI  │ │  T10: Profile   │
                │  (Marketplace)  │ │  (Marketplace)  │ │      UI         │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         └─────────┬─────────┴─────────┬─────────┘
                                   │                   │
                                   ▼                   ▼
                         ┌─────────────────┐ ┌─────────────────┐
                         │ T11: Social API │ │ T12: Storage    │
                         │ (Fav/Comment)   │ │    Backend      │
                         └────────┬────────┘ └────────┬────────┘
                                  │                   │
                                  └─────────┬─────────┘
                                            │
                                            ▼
                                  ┌─────────────────┐
                                  │ T13: Package    │
                                  │ Upload/Download │
                                  └────────┬────────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         │                 │                 │
                         ▼                 ▼                 ▼
                ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                │ T14: Workspace  │ │ T15: Collections│ │ T16: Publish UI │
                │      API        │ │      API        │ │   (MCP/Skills)  │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         ▼                   ▼                   ▼
                ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                │ T17: Workspace  │ │ T18: Collections│ │ T19: Analytics  │
                │      UI         │ │      UI         │ │      UI         │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         └─────────────────┬─┴───────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │ T20: Desktop    │
                                  │   Integration   │
                                  └────────┬────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │ T21: Deploy &   │
                                  │     Polish      │
                                  └─────────────────┘
```

---

## Task Definitions

### Phase 0: Foundation

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T0 | Project Setup | - | [project-setup.md](../modules/infrastructure/project-setup.md) | Next.js app scaffold, pnpm workspace |

### Phase 1: Core Infrastructure

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T1 | Database Schema | T0 | [database.md](../modules/infrastructure/database.md) | Drizzle schema, migrations |
| T2 | Auth Core | T0 | [auth.md](../modules/auth/auth.md) | JWE session, middleware |
| T3 | UI Shell | T0 | [ui-shell.md](../modules/web-ui/ui-shell.md) | Layout, navigation, theme |

### Phase 2: User System

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T4 | User API | T1, T2 | [user-api.md](../modules/auth/user-api.md) | User CRUD, OAuth, API keys |
| T7 | Auth UI | T3, T4 | [auth-ui.md](../modules/auth/auth-ui.md) | Login, register, OAuth buttons |
| T10 | Profile UI | T7 | [profile-ui.md](../modules/auth/profile-ui.md) | Profile page, API key management |

### Phase 3: Marketplace Core

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T5 | MCP API | T4 | [mcp-api.md](../modules/marketplace/mcp-api.md) | MCP CRUD, search |
| T6 | Skills API | T4 | [skills-api.md](../modules/marketplace/skills-api.md) | Skills CRUD, search |
| T8 | MCP UI | T5, T3 | [mcp-ui.md](../modules/marketplace/mcp-ui.md) | MCP marketplace pages |
| T9 | Skills UI | T6, T3 | [skills-ui.md](../modules/marketplace/skills-ui.md) | Skills marketplace pages |

### Phase 4: Social & Storage

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T11 | Social API | T5, T6 | [social-api.md](../modules/marketplace/social-api.md) | Favorites, comments, ratings |
| T12 | Storage Backend | T4 | [storage.md](../modules/infrastructure/storage.md) | HuggingFace integration |
| T13 | Package Upload/Download | T11, T12 | [packages.md](../modules/marketplace/packages.md) | Upload/download API |

### Phase 5: Advanced Features

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T14 | Workspace API | T13 | [workspace-api.md](../modules/workspace/workspace-api.md) | Workspace CRUD |
| T15 | Collections API | T11 | [collections-api.md](../modules/marketplace/collections-api.md) | Collection CRUD |
| T16 | Publish UI | T13, T8, T9 | [publish-ui.md](../modules/marketplace/publish-ui.md) | Package publish wizard |
| T17 | Workspace UI | T14 | [workspace-ui.md](../modules/workspace/workspace-ui.md) | Workspace management |
| T18 | Collections UI | T15 | [collections-ui.md](../modules/marketplace/collections-ui.md) | Collection pages |
| T19 | Analytics UI | T13 | [analytics-ui.md](../modules/marketplace/analytics-ui.md) | Download stats |

### Phase 6: Integration & Polish

| Task | Name | Dependencies | Spec | Deliverables |
|------|------|--------------|------|--------------|
| T20 | Desktop Integration | T13 | [desktop-task-dag.md](./desktop-task-dag.md) | 16 sub-tasks (TD0-TD15): Auth, Marketplace, Install, Sync, Offline |
| T21 | Deploy & Polish | All | [deployment.md](../modules/infrastructure/deployment.md) | Vercel deploy, testing |

> **Note**: T20 is expanded into a separate task DAG with 16 sub-tasks. See [desktop-task-dag.md](./desktop-task-dag.md) for details.

---

## Dependency Matrix

```
Task | T0 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10| T11| T12| T13| T14| T15| T16| T17| T18| T19| T20| T21
-----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|
T0   |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T1   | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T2   | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T3   | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T4   |    | X  | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T5   |    |    |    |    | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T6   |    |    |    |    | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T7   |    |    |    | X  | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T8   |    |    |    | X  |    | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T9   |    |    |    | X  |    |    | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T10  |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T11  |    |    |    |    |    | X  | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T12  |    |    |    |    | X  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
T13  |    |    |    |    |    |    |    |    |    |    |    | X  | X  |    |    |    |    |    |    |    |    |    |
T14  |    |    |    |    |    |    |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |    |    |
T15  |    |    |    |    |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |    |    |    |    |
T16  |    |    |    |    |    |    |    |    | X  | X  |    |    |    | X  |    |    |    |    |    |    |    |    |
T17  |    |    |    |    |    |    |    |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |    |
T18  |    |    |    |    |    |    |    |    |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |
T19  |    |    |    |    |    |    |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |    |    |
T20  |    |    |    |    |    |    |    |    |    |    |    |    |    | X  |    |    |    |    |    |    |    |    |
T21  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  | X  |    |
```

---

## Parallel Execution Groups

Tasks that can be executed in parallel:

| Group | Tasks | Description |
|-------|-------|-------------|
| G1 | T1, T2, T3 | Foundation (after T0) |
| G2 | T5, T6, T7 | APIs + Auth UI (after T4) |
| G3 | T8, T9, T10 | Marketplace + Profile UI |
| G4 | T11, T12 | Social + Storage (parallel) |
| G5 | T14, T15, T16 | Advanced features (after T13) |
| G6 | T17, T18, T19, T20 | All UIs + Integration |

---

## Critical Path

```
T0 → T1 → T4 → T5 → T11 → T13 → T16 → T21
     ↓
     T2 ──────────────────────────────────→
```

**Critical path duration**: 8 sequential tasks

---

## Estimated Effort

| Phase | Tasks | Total Points |
|-------|-------|--------------|
| Phase 0 | T0 | 3 |
| Phase 1 | T1, T2, T3 | 8 |
| Phase 2 | T4, T7, T10 | 13 |
| Phase 3 | T5, T6, T8, T9 | 21 |
| Phase 4 | T11, T12, T13 | 13 |
| Phase 5 | T14-T19 | 18 |
| Phase 6 | T20, T21 | 8 |
| **Total** | 22 tasks | **84 points** |

---

## Next Steps

1. Create module specs in `.trellis/spec/modules/`
2. Start with T0 (Project Setup)
3. Execute parallel groups where possible
