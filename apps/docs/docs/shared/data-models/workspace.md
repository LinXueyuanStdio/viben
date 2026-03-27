# Workspace Module Specifications

> Index of all specification documents related to workspaces

---

## Platform Distinction

> **Important**: This project has two different "workspace" concepts:

| Aspect | Desktop Workspace | Web Workspace |
|--------|-------------------|---------------|
| **Platform** | apps/desktop (Tauri) | apps/web (Next.js) |
| **Definition** | Local folder + agent configuration | Cloud collaboration space |
| **Storage** | SQLite + local file system | PostgreSQL |
| **Features** | MCP, Skills, Chat, Kanban | Package management, member management |
| **Agent Support** | .claude/, .codex/, .cursor/ | N/A |

---

## Core Specifications

### Desktop Workspace System (Primary)

| Spec | Description | Status |
|------|-------------|--------|
| workspace-management | Desktop workspace core architecture | Done |
| desktop-chat-workany | Chat feature integration (based on workany) | Planning |

### Web Workspace System

| Spec | Description | Status |
|------|-------------|--------|
| workspace-api | Web Workspace CRUD API | Done |
| workspace-ui | Web Workspace UI pages | Done |

---

## Kanban System

> Task board functionality within workspaces (Desktop Only)

### Architecture & Analysis

| Spec | Description | Status |
|------|-------------|--------|
| kanban-integration | Kanban overall architecture + package design | Specification |
| kanban-features | Core feature specifications (Phase 1-2) | Specification |
| vibe-kanban-architecture | vibe-kanban frontend architecture deep analysis | Reference |
| desktop-kanban-integration-progress | Desktop integration progress report (~75%) | Report |

### Implementation Phases

| Phase | Spec | Focus | Status |
|-------|------|-------|--------|
| P3 | kanban-phase3 | Advanced features (quick create, keyboard navigation, statistics) | Planning |
| P4 | kanban-phase4 | Collaboration features | Planning |
| P5 | kanban-phase5 | Automation + integration | Planning |
| P6 | kanban-phase6 | Views + reports | Planning |
| P7 | kanban-phase7 | AI integration | Planning |
| P8 | kanban-phase8 | Advanced customization | Planning |

---

## Relationship Diagram

```
Desktop App
└── Workspace Management
    ├── Global Workspace (~/)
    │   └── Agents (.claude/, .codex/, .cursor/)
    │       ├── MCP Servers
    │       └── Skills
    └── Custom Workspaces (project folders)
        ├── Agents (local configs)
        │   ├── MCP Servers
        │   └── Skills
        ├── Chat ← desktop-chat-workany
        └── Kanban ← kanban-*

Web App
└── Workspaces (cloud)
    ├── Packages (MCP/Skills)
    ├── Members
    └── Settings
```

---

## Quick Links

- **Adding new workspace features**: Start with workspace-management spec
- **Kanban development**: Start with kanban-integration spec
- **Chat integration**: See desktop-chat-workany spec
- **Web workspace API**: See workspace-api spec
