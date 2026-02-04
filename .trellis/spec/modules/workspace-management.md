# Workspace Management System

> **Status**: Planning
> **Priority**: High
> **Type**: Feature Architecture

---

## Overview

Workspace Management System allows users to organize MCP servers and Skills configurations across multiple workspaces (projects/folders). Each workspace can contain multiple agent configurations (e.g., Claude Code, Codex), and users can manage MCP servers and Skills for each agent through a user-friendly UI.

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
- Represents the user's application-level configuration
- Located in application data directory or user home

**Custom Workspace**:
- User-added project-specific workspaces
- Typically points to project directories (e.g., `/Users/name/projects/my-project`)
- Can be added/removed by user

### Agent

An **agent** is a detected configuration folder within a workspace.

| Agent Type | Detection Pattern | Config Files |
|------------|-------------------|--------------|
| **Claude Code** | `.claude/` folder exists | `.claude/mcp.json`, `.claude/settings.json` |
| **Codex** | `.codex/` folder exists | `.codex/config.json` |
| **Cursor** | `.cursor/` folder exists | `.cursor/mcp.json` |

**Agent Properties**:
- `name`: Display name (e.g., "Claude Code", "Codex")
- `type`: Agent type identifier
- `configPath`: Path to configuration folder
- `mcpConfig`: Parsed MCP servers configuration
- `skillsConfig`: Parsed Skills configuration

### Relationship Diagram

```
Workspace (Folder)
├── Agent 1 (.claude/)
│   ├── MCP Servers Config (mcp.json)
│   └── Skills Config (skills.json)
├── Agent 2 (.codex/)
│   ├── MCP Servers Config (config.json)
│   └── Skills Config
└── Agent 3 (.cursor/)
    └── MCP Config
```

---

## User Stories

### US-1: View Workspaces
**As a** user
**I want to** see all my workspaces in the left sidebar
**So that** I can quickly switch between different projects

**Acceptance Criteria**:
- Global workspace is always visible and marked as "Global"
- Custom workspaces are listed with their folder names
- Current active workspace is visually highlighted

### US-2: Add Workspace
**As a** user
**I want to** add a new workspace by selecting a folder
**So that** I can manage project-specific MCP/Skills configurations

**Acceptance Criteria**:
- "Add Workspace" button in the sidebar
- File picker opens to select folder
- System automatically detects agents in the folder
- New workspace appears in the list immediately

### US-3: View Agents in Workspace
**As a** user
**I want to** see all detected agents when I select a workspace
**So that** I know which agent configurations exist in this project

**Acceptance Criteria**:
- Clicking a workspace shows agent list in the right panel
- Each agent displays its type (Claude Code, Codex, etc.)
- Empty state shown if no agents detected

### US-4: Manage MCP Servers for Agent
**As a** user
**I want to** add/edit/delete MCP servers for a specific agent
**So that** I can configure which tools are available

**Acceptance Criteria**:
- Clicking an agent shows its MCP servers list
- "Add MCP Server" button opens configuration form
- Each server can be edited (name, command, args, env)
- Each server can be deleted with confirmation
- Changes are saved to the agent's config file (e.g., `.claude/mcp.json`)

### US-5: Manage Skills for Agent
**As a** user
**I want to** add/view/delete Skills for a specific agent
**So that** I can control which skills are available

**Acceptance Criteria**:
- Agent detail view shows Skills list
- "Add Skill" button opens skill selector (from marketplace or local)
- Skills can be removed (not edited - skills are immutable packages)
- Changes are saved to the agent's skills config

---

## Data Model

### Workspace Model

```typescript
interface Workspace {
  id: string;                    // UUID or path hash
  name: string;                  // Display name (folder name)
  path: string;                  // Absolute path to folder
  type: 'global' | 'custom';     // Workspace type
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

### Skill Model

```typescript
interface Skill {
  id: string;                    // Skill package ID
  name: string;                  // Display name
  version: string;               // Version
  source: 'marketplace' | 'local'; // Source
  path?: string;                 // Local path (if local)
}
```

---

## Storage Strategy

### Workspace List Storage

**Location**: Application data directory
**File**: `~/.browsemcp/workspaces.json` (or similar)

```json
{
  "version": "1.0",
  "workspaces": [
    {
      "id": "global",
      "name": "Global",
      "path": "~/.browsemcp",
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

**Location**: Each workspace's folder
**Pattern**: `<workspace-path>/<agent-folder>/mcp.json`

**Example - Claude Code MCP Config**:
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

**Example - Skills Config**:
```json
// <workspace>/.claude/skills.json (hypothetical)
{
  "skills": [
    {
      "id": "skill-pdf",
      "name": "PDF Tools",
      "version": "1.0.0",
      "source": "marketplace"
    },
    {
      "id": "skill-custom",
      "name": "Custom Skill",
      "version": "0.1.0",
      "source": "local",
      "path": "./local-skills/custom-skill"
    }
  ]
}
```

---

## UI Architecture

### Sidebar Navigation Structure

```
┌─────────────────────────────┐
│ [+] Add Workspace           │  ← Action Button
├─────────────────────────────┤
│ ▼ Workspaces                │  ← Section Header (collapsible)
│   📁 Global (default)       │  ← Global workspace (always present)
│   📁 my-project             │  ← Custom workspace
│   📁 another-project        │
├─────────────────────────────┤
│ ▼ Home                      │  ← Section 1
│   🏠 Dashboard              │
├─────────────────────────────┤
│ ▼ MCP                       │  ← Section 2
│   🛒 MCP Marketplace        │  2.1
│   ▼ Browse MCP              │  2.2 (collapsible)
│     📊 Dashboard            │    2.2.1
│     📦 Data Sources         │    2.2.2
│     🔍 Search Services      │    2.2.3
│   🔍 Inspector              │  2.3
├─────────────────────────────┤
│ ▼ Skills                    │  ← Section 3
│   🛒 Skills Marketplace     │  3.1
├─────────────────────────────┤
│ ▼ Preferences               │  ← Section 4 (Settings)
│   ⚙️  Settings              │
│   ℹ️  About                 │
└─────────────────────────────┘
```

### Workspace Detail View

When a workspace is clicked in the sidebar:

```
┌─────────────────────────────────────────────────────────┐
│ Workspace: my-project                    [Remove] [⚙️]   │
├─────────────────────────────────────────────────────────┤
│ Path: /Users/name/projects/my-project                   │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Agents                           [+ Add Agent]      │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 🤖 Claude Code                                 [>]  │ │
│ │    2 MCP servers, 3 skills                          │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 📝 Codex                                       [>]  │ │
│ │    1 MCP server, 0 skills                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Quick Actions                                       │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ [Open in Terminal]  [Open in File Explorer]        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Agent Detail View

When an agent is clicked:

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to my-project                                     │
├─────────────────────────────────────────────────────────┤
│ Agent: Claude Code                                       │
│ Config: /Users/name/projects/my-project/.claude/        │
│                                                           │
│ ┌─ MCP Servers ─────────────────────────── [+ Add] ───┐ │
│ │                                                       │ │
│ │ filesystem                              [Edit] [Del] │ │
│ │   Command: npx -y @modelcontextprotocol/server-file │ │
│ │   Status: ✅ Active                                  │ │
│ │                                                       │ │
│ │ github                                  [Edit] [Del] │ │
│ │   Command: npx -y @modelcontextprotocol/server-git  │ │
│ │   Status: ✅ Active                                  │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─ Skills ──────────────────────────────── [+ Add] ───┐ │
│ │                                                       │ │
│ │ 📄 PDF Tools (v1.0.0)                        [Del]  │ │
│ │    Source: Marketplace                               │ │
│ │                                                       │ │
│ │ 🎨 Canvas Design (v2.1.0)                    [Del]  │ │
│ │    Source: Marketplace                               │ │
│ │                                                       │ │
│ │ 🔧 Custom Skill (v0.1.0)                     [Del]  │ │
│ │    Source: Local (./local-skills/custom-skill)      │ │
│ └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Data Layer (Backend)

**Tauri Commands** (Rust):
```rust
// Workspace management
#[tauri::command]
fn list_workspaces() -> Result<Vec<Workspace>, String>;

#[tauri::command]
fn add_workspace(path: String) -> Result<Workspace, String>;

#[tauri::command]
fn remove_workspace(id: String) -> Result<(), String>;

#[tauri::command]
fn get_workspace_agents(workspace_id: String) -> Result<Vec<Agent>, String>;

// Agent detection
#[tauri::command]
fn detect_agents(workspace_path: String) -> Result<Vec<Agent>, String>;

// MCP management
#[tauri::command]
fn get_mcp_servers(agent_id: String) -> Result<Vec<McpServer>, String>;

#[tauri::command]
fn add_mcp_server(agent_id: String, server: McpServer) -> Result<(), String>;

#[tauri::command]
fn update_mcp_server(agent_id: String, name: String, server: McpServer) -> Result<(), String>;

#[tauri::command]
fn delete_mcp_server(agent_id: String, name: String) -> Result<(), String>;

// Skills management
#[tauri::command]
fn get_skills(agent_id: String) -> Result<Vec<Skill>, String>;

#[tauri::command]
fn add_skill(agent_id: String, skill: Skill) -> Result<(), String>;

#[tauri::command]
fn delete_skill(agent_id: String, skill_id: String) -> Result<(), String>;
```

**File Operations**:
- Read/write `workspaces.json`
- Detect agent folders (`.claude/`, `.codex/`, etc.)
- Parse agent config files (JSON)
- Update config files atomically

### Phase 2: State Management (Frontend)

**Zustand Store** (`workspace-store.ts`):
```typescript
interface WorkspaceStore {
  // State
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  selectedAgentId: string | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  addWorkspace: (path: string) => Promise<Workspace>;
  removeWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string) => void;

  // Agent actions
  loadAgents: (workspaceId: string) => Promise<Agent[]>;
  selectAgent: (agentId: string) => void;

  // MCP actions
  loadMcpServers: (agentId: string) => Promise<McpServer[]>;
  addMcpServer: (agentId: string, server: McpServer) => Promise<void>;
  updateMcpServer: (agentId: string, name: string, server: McpServer) => Promise<void>;
  deleteMcpServer: (agentId: string, name: string) => Promise<void>;

  // Skills actions
  loadSkills: (agentId: string) => Promise<Skill[]>;
  addSkill: (agentId: string, skill: Skill) => Promise<void>;
  deleteSkill: (agentId: string, skillId: string) => Promise<void>;
}
```

### Phase 3: UI Components

**Component Tree**:
```
App
├── Sidebar (refactored)
│   ├── WorkspaceSection
│   │   ├── AddWorkspaceButton
│   │   └── WorkspaceList
│   │       └── WorkspaceItem (clickable)
│   ├── HomeSection
│   ├── McpSection (collapsible)
│   ├── SkillsSection
│   └── PreferencesSection
├── MainContent (routed)
│   ├── WorkspaceDetail (shows agents)
│   │   └── AgentList
│   │       └── AgentCard
│   ├── AgentDetail (shows MCP + Skills)
│   │   ├── McpServersList
│   │   │   ├── McpServerCard
│   │   │   └── AddMcpServerDialog
│   │   └── SkillsList
│   │       ├── SkillCard
│   │       └── AddSkillDialog
│   └── [Other existing pages]
```

**New Pages**:
1. `workspace-detail.tsx` - Shows agents in a workspace
2. `agent-detail.tsx` - Shows MCP servers + Skills for an agent
3. `add-workspace-dialog.tsx` - Folder picker dialog
4. `add-mcp-server-dialog.tsx` - MCP server configuration form
5. `add-skill-dialog.tsx` - Skill selector from marketplace/local

### Phase 4: Sidebar Refactor

**Before** (Current flat list):
```tsx
<Sidebar>
  <NavItem href="/dashboard" />
  <NavItem href="/providers" />
  <NavItem href="/marketplace" />
  <NavItem href="/skills-market" />
  <NavItem href="/logs" />
  <NavItem href="/inspector" />
  <NavItem href="/settings" />
  <NavItem href="/about" />
</Sidebar>
```

**After** (Sectioned + collapsible):
```tsx
<Sidebar>
  <AddWorkspaceButton />

  <Section title="Workspaces" collapsible defaultOpen>
    {workspaces.map(ws => (
      <WorkspaceItem key={ws.id} workspace={ws} />
    ))}
  </Section>

  <Section title="Home">
    <NavItem href="/dashboard" icon={<Home />} />
  </Section>

  <Section title="MCP" collapsible>
    <NavItem href="/marketplace" icon={<Store />} label="MCP Marketplace" />
    <Section title="Browse MCP" collapsible nested>
      <NavItem href="/mcp/dashboard" icon={<LayoutDashboard />} />
      <NavItem href="/providers" icon={<Database />} label="Data Sources" />
      <NavItem href="/search" icon={<Search />} label="Search Services" />
    </Section>
    <NavItem href="/inspector" icon={<Microscope />} />
  </Section>

  <Section title="Skills" collapsible>
    <NavItem href="/skills-market" icon={<Store />} label="Skills Marketplace" />
  </Section>

  <Section title="Preferences" collapsible>
    <NavItem href="/settings" icon={<Settings />} />
    <NavItem href="/about" icon={<Info />} />
  </Section>
</Sidebar>
```

---

## Technical Challenges

### 1. Agent Detection

**Challenge**: Different agents use different config structures.

**Solution**:
- Define detection patterns (file/folder existence)
- Create parsers for each agent type
- Fall back to generic "unknown" agent type if structure doesn't match

### 2. Config File Compatibility

**Challenge**: Modifying config files without breaking existing agent setups.

**Solution**:
- Read entire config file
- Preserve unknown fields
- Update only the managed sections
- Validate JSON before writing
- Create backup before modification

### 3. Concurrent Access

**Challenge**: Agent might be running while user modifies config.

**Solution**:
- Show warning if config file is locked
- Recommend stopping agent before modification
- Use file locking if possible (OS-dependent)

### 4. Migration from Global to Workspace

**Challenge**: Users have existing global MCP/Skills configs.

**Solution**:
- Global workspace represents the existing global config
- No data migration needed
- Users can gradually adopt workspace-specific configs

---

## Security Considerations

1. **Path Validation**:
   - Validate workspace paths are within allowed directories
   - Prevent path traversal attacks
   - Check folder exists and is readable

2. **Config File Safety**:
   - Validate JSON structure before writing
   - Sanitize user input (server names, commands, etc.)
   - Warn about potentially dangerous commands

3. **Sensitive Data**:
   - Never store API keys in plaintext
   - Support environment variable references (e.g., `${GITHUB_TOKEN}`)
   - Warn users when displaying env vars in UI

---

## Future Enhancements

1. **Workspace Templates**:
   - Predefined MCP/Skills configurations
   - Quick setup for common use cases (e.g., "Web Development", "Data Science")

2. **Import/Export**:
   - Export workspace config as shareable file
   - Import config from file or URL

3. **Workspace Sync**:
   - Sync workspace configs across devices (via cloud)
   - Version control integration (commit config changes)

4. **Agent Health Monitoring**:
   - Check if MCP servers are running
   - Show server logs/errors in UI
   - Restart failed servers

5. **Multi-Agent Orchestration**:
   - Run multiple agents simultaneously
   - Share MCP servers across agents
   - Agent communication/collaboration

---

## Related Specs

- [Sidebar Navigation](./sidebar-navigation.md) - To be created
- [Component Guidelines](./../frontend/components.md) - Component patterns
- [Design System](./../frontend/design-system.md) - UI styling

---

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code Configuration](https://docs.anthropic.com/claude-code)
- [Tauri File System API](https://tauri.app/v1/api/js/fs)

---

**Language**: English
**Last Updated**: 2026-02-05
**Status**: Draft for Review
