---
sidebar_position: 26
title: "Agent Hooks"
description: "Unified Agent data source and operation hook architecture for the Desktop app"
---

# Agent Hooks

Unified Agent data source and operation hook architecture for the Desktop app.

---

## Overview

This specification defines the unified architecture for Agent-related hooks in the Desktop application. The goals are:

1. **Single data source**: All Agent data is fetched from the Gateway API
2. **Unified hooks**: Merged `useVibenAgents` into `useAgents`
3. **Full CRUD operations**: `useChatList` and `useAgents` provide complete CRUD capabilities

---

## Architecture

### Data Flow

```
+-------------------------------------------------------------+
|                     Frontend (Desktop)                        |
+-------------------------------------------------------------+
|                                                               |
|  +-- useChatList --+    +-- useAgents --+    +-- useExecutors --+
|  | (aggregate list)|    | (Agent CRUD)  |    | (Executor list)  |
|  +-------+---------+    +------+--------+    +-------+----------+
|          |                     |                     |
|          +---------------------+---------------------+
|                                |
|                       +--------v--------+
|                       |  GatewayClient  |
|                       +--------+--------+
|                                |
+--------------------------------|---------------------------------+
                                 | HTTP
+--------------------------------v---------------------------------+
|                    Gateway (packages/core)                        |
+------------------------------------------------------------------+
|  /api/chat-list    - Aggregate list                               |
|  /api/agent        - Agent CRUD operations                        |
|  /api/executors    - Executor list                                |
+------------------------------------------------------------------+
```

---

## Hook Specifications

### 1. useAgents (Primary Agent Hook)

**Location**: `apps/desktop/src/hooks/use-workspace-resources.ts`

**Responsibilities**:
- Fetch Agent list (workspace + global)
- Provide full CRUD operations
- Manage default agent

```typescript
interface UseAgentsReturn {
  // Data
  agents: AgentInfo[];
  defaultAgentId: string | null;
  loading: boolean;
  error: string | null;
  total: number;

  // Read operations
  refresh: () => Promise<void>;
  getAgent: (id: string) => AgentInfo | undefined;
  getVibenAgents: () => AgentInfo[];
  getIdeAgents: () => AgentInfo[];
  getWorkspaceAgents: () => AgentInfo[];
  getGlobalAgents: () => AgentInfo[];

  // CRUD operations (Viben agents only)
  createAgent: (options: CreateAgentOptions) => Promise<AgentInfo>;
  updateAgent: (id: string, updates: AgentUpdate) => Promise<AgentInfo>;
  removeAgent: (id: string) => Promise<void>;
  setDefaultAgent: (id: string) => Promise<void>;

  // Templates
  templates: AgentTemplate[];
  refreshTemplates: () => Promise<void>;
  createTemplate: (agentId: string, templateId: string) => Promise<AgentTemplate>;
  createFromTemplate: (templateId: string, agentId: string) => Promise<AgentInfo>;
}
```

### 2. useChatList (Aggregate List Hook)

**Location**: `apps/desktop/src/hooks/use-workspace-resources.ts`

**Responsibilities**:
- Fetch sidebar aggregate list (Group Chats + Executors + Agents)
- Provide Agent operation delegation (to useAgents)

```typescript
interface UseChatListReturn {
  // Data
  items: ChatListItem[];
  groupChats: ChatListItem[];
  executors: ChatListItem[];
  agents: ChatListItem[];
  counts: ChatListCounts;
  total: number;
  loading: boolean;
  error: string | null;

  // Refresh
  refresh: () => Promise<void>;

  // Agent operations (delegate to useAgents internally)
  agentOperations: {
    defaultAgentId: string | null;
    setDefaultAgent: (id: string) => Promise<void>;
    removeAgent: (id: string) => Promise<void>;
    updateAgent: (id: string, updates: AgentUpdate) => Promise<AgentInfo>;
  };
}
```

---

## Gateway API Endpoints

### Existing Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat-list` | GET | Aggregate list |
| `/api/agent` | GET | Agent list |
| `/api/executors` | GET | Executor list |

### New Endpoints (Agent CRUD)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Create Agent |
| `/api/agent/:id` | GET | Get Agent details |
| `/api/agent/:id` | PATCH | Update Agent |
| `/api/agent/:id` | DELETE | Delete Agent |
| `/api/agent/default` | GET | Get default Agent ID |
| `/api/agent/default` | PUT | Set default Agent |
| `/api/agent/templates` | GET | List templates |
| `/api/agent/templates` | POST | Create template from Agent |
| `/api/agent/templates/:id` | GET | Get template |
| `/api/agent/templates/:id/instantiate` | POST | Create Agent from template |

---

## Type Definitions

### AgentInfo

```typescript
interface AgentInfo {
  id: string;
  name: string;
  agent_type: "viben" | "claude-code" | "cursor" | "windsurf" | "cline" | "aider";
  source: "workspace" | "global";
  workspace_path?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: string[];
  skills?: string[];
  plan_mode?: boolean;
  approvals?: boolean;
  created_at?: string;
  updated_at?: string;
}
```

### CreateAgentOptions

```typescript
interface CreateAgentOptions {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  from_template?: string;
  base_path?: string;
}
```

### AgentUpdate

```typescript
interface AgentUpdate {
  name?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: string[];
  skills?: string[];
  plan_mode?: boolean;
  approvals?: boolean;
}
```

---

## Migration Plan

### Phase 1: Backend API
Add CRUD handlers to `packages/core/src/gateway/routes/agents.ts`, plus `/api/agent/default` and `/api/agent/templates` endpoints.

### Phase 2: Gateway Client
Add new methods to `apps/desktop/src/lib/gateway.ts`.

### Phase 3: Hook Refactoring
Enhance `useAgents` hook with CRUD operations, enhance `useChatList` with agent operations, update all `useVibenAgents` imports.

### Phase 4: Cleanup
Delete `use-viben-agents.ts`, update hook exports.

---

## Affected Files

### Modified
- `packages/core/src/gateway/routes/agents.ts` - Add CRUD handlers
- `apps/desktop/src/lib/gateway.ts` - Add GatewayClient methods
- `apps/desktop/src/hooks/use-workspace-resources.ts` - Enhance hooks
- Various page files - Update imports

### Deleted
- `apps/desktop/src/hooks/use-viben-agents.ts` - Merged into useAgents

---

## Related Documentation

- [Agents API](./agents.md) - Agent management endpoints
- [Sessions API](./sessions.md) - Session management
- [Workspace Management](./workspace-management.md) - Workspace system
