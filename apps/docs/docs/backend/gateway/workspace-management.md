---
sidebar_position: 22
title: "Workspace Management"
description: "Desktop-only workspace management system for organizing MCP servers and Skills configurations"
---

# Workspace Management System

Desktop-only workspace management system for organizing MCP servers and Skills configurations across multiple workspaces.

:::warning Desktop-Only Feature
This workspace management system is **desktop-only** and should NOT be confused with the web app's workspace system.

| Aspect | Desktop (this spec) | Web (different system) |
|--------|---------------------|------------------------|
| **What** | Local filesystem folders | Cloud-based collaborative spaces |
| **Storage** | Local JSON + filesystem | PostgreSQL database |
| **Agents** | .claude/, .codex/, .cursor/ folders | N/A |
| **Features** | MCP servers, Skills, Chat, Kanban | Package organization, members |
| **Backend** | Tauri (Rust) + SQLite | Next.js API + PostgreSQL |
:::

---

## Overview

The Workspace Management System allows users to organize MCP servers and Skills configurations across multiple workspaces (projects/folders). Each workspace can contain multiple agent configurations (e.g., Claude Code, Codex), and users can manage MCP servers and Skills for each agent through a user-friendly UI.

---

## Core Concepts

### Workspace

A **workspace** is a folder on the user's file system that represents a project or working context.

| Property | Description |
|----------|-------------|
| **Path** | Absolute path to the workspace folder |
| **Type** | `global` (built-in, non-deletable) or `custom` (user-added) |
| **Agents** | List of detected agent configurations (`.claude/`, `.codex/`, etc.) |
| **Config Location** | Each workspace's config stored in its own folder (e.g., `.claude/mcp.json`) |

**Global Workspace**:
- Default workspace that always exists (non-deletable)
- **Path**: `~` (user's home directory)
- Tracks global agent configurations: `~/.claude/`, `~/.codex/`, `~/.cursor/`
- Cannot be removed or modified (only the agents within it can be configured)

**Custom Workspace**:
- User-added project-specific workspaces
- Points to project directories (e.g., `/Users/name/projects/my-project`)
- Tracks project-local agent configurations
- Can be added/removed by user

### Agent

An **agent** is a detected configuration folder within a workspace.

| Agent Type | Detection Pattern | Config Files |
|------------|-------------------|--------------|
| **Claude Code** | `.claude/` folder exists | `.claude/mcp.json`, `.claude/settings.json` |
| **Codex** | `.codex/` folder exists | `.codex/config.json` |
| **Cursor** | `.cursor/` folder exists | `.cursor/mcp.json` |

### Relationship Diagram

```
Workspace (Folder)
+-- Agent 1 (.claude/)
|   +-- MCP Servers Config (mcp.json)
|   +-- Skills Config (skills.json)
+-- Agent 2 (.codex/)
|   +-- MCP Servers Config (config.json)
|   +-- Skills Config
+-- Agent 3 (.cursor/)
    +-- MCP Config
```

---

## Data Model

### Workspace Model

```typescript
interface Workspace {
  id: string;                    // UUID or path hash
  name: string;                  // Display name (folder name)
  path: string;                  // Absolute path to folder
  type: 'global' | 'custom';    // Workspace type
  agents: Agent[];               // Detected agents
  createdAt: string;             // ISO timestamp
  lastAccessed: string;          // ISO timestamp
}
```

### Agent Model

```typescript
interface Agent {
  id: string;                    // UUID or composite key
  workspaceId: string;           // Parent workspace ID
  name: string;                  // Display name ("Claude Code", etc.)
  type: AgentType;               // Agent type enum
  configPath: string;            // Path to config folder (.claude/, etc.)
  mcpConfigFile: string;         // Path to mcp.json or equivalent
  skillsConfigFile: string;      // Path to skills config
  mcpServers: McpServer[];       // Parsed MCP servers
  skills: Skill[];               // Parsed skills
}

type AgentType = 'claude-code' | 'codex' | 'cursor' | 'unknown';
```

### MCP Server Model

```typescript
interface McpServer {
  name: string;                  // Unique name within agent
  command: string;               // Executable command
  args?: string[];               // Command arguments
  env?: Record<string, string>;  // Environment variables
  disabled?: boolean;            // Whether server is disabled
}
```

---

## Storage Strategy

### Workspace List Storage

**Location**: `~/.viben/workspaces.json`

```json
{
  "version": "1.0",
  "workspaces": [
    {
      "id": "global",
      "name": "Global",
      "path": "~",
      "type": "global",
      "createdAt": "2026-02-05T00:00:00Z",
      "lastAccessed": "2026-02-05T10:30:00Z"
    },
    {
      "id": "workspace-abc123",
      "name": "my-project",
      "path": "/Users/name/projects/my-project",
      "type": "custom",
      "createdAt": "2026-02-05T01:00:00Z",
      "lastAccessed": "2026-02-05T10:00:00Z"
    }
  ],
  "activeWorkspaceId": "workspace-abc123"
}
```

### Agent Config Storage

**Pattern**: `<workspace-path>/<agent-folder>/mcp.json`

```json
// <workspace>/.claude/mcp.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## User Stories

### US-1: View Workspaces

View all workspaces in the left sidebar with the global workspace always visible and current active workspace highlighted.

### US-2: Add Workspace (Wizard Flow)

Add a new workspace through a guided wizard modal:
- **Step 1**: Choose method (open existing folder or create new)
- **Step 2**: Configure (name, location, Git/Viben initialization options)
- **Step 3**: Complete (success message with next actions)

### US-3: View Agents in Workspace

See all detected agents when selecting a workspace, with empty state shown if no agents found.

### US-4: Manage MCP Servers

Add/edit/delete MCP servers for a specific agent. Changes are saved directly to the agent's config file.

### US-5: Manage Skills

Add/view/delete Skills for a specific agent from marketplace or local sources.

---

## Implementation Plan

### Phase 1: Data Layer (Backend)

Tauri commands for workspace, agent, MCP, and skills management.

### Phase 2: State Management (Frontend)

Zustand store (`workspace-store.ts`) for workspace, agent, MCP, and skills state.

### Phase 3: UI Components

Component tree including workspace section, agent lists, MCP server management, and skill management.

### Phase 4: Sidebar Refactor

Sectioned and collapsible sidebar with workspace list, home, MCP, skills, and preferences sections.

---

## Security Considerations

1. **Path Validation**: Validate workspace paths, prevent path traversal
2. **Config File Safety**: Validate JSON structure, sanitize user input
3. **Sensitive Data**: Support environment variable references, never store API keys in plaintext

---

## Related Documentation

- [Agents API](./agents.md) - Agent management endpoints
- [Sessions API](./sessions.md) - Session management
