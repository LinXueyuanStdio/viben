# Agent Hooks 规范

> 统一 Agent 数据来源和操作的 Hook 架构规范

---

## 概述

本规范定义了 Desktop 应用中 Agent 相关 Hooks 的统一架构。目标是：

1. **单一数据源**: 所有 Agent 数据从 Gateway API 获取
2. **统一 Hook**: 合并 `useVibenAgents` 到 `useAgents`
3. **操作能力**: `useChatList` 和 `useAgents` 提供完整 CRUD 操作

---

## 目标架构

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Desktop)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  useChatList │    │   useAgents  │    │ useExecutors │   │
│  │  (聚合列表)   │    │  (Agent CRUD)│    │ (Executor 列表)│  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │            │
│         └───────────────────┼───────────────────┘            │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  GatewayClient  │                       │
│                    └────────┬────────┘                       │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │ HTTP
┌─────────────────────────────▼────────────────────────────────┐
│                    Gateway (packages/core)                    │
├──────────────────────────────────────────────────────────────┤
│  /api/chat-list    - 聚合列表 (Group Chats + Executors + Agents)│
│  /api/agents       - Agent CRUD 操作                          │
│  /api/executors    - Executor 列表                            │
└──────────────────────────────────────────────────────────────┘
```

### 废弃的架构 (useVibenAgents)

```
❌ 不再使用
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐                                           │
│  │useVibenAgents│  ──── Tauri invoke ────→  viben-core     │
│  └──────────────┘                           AgentManager    │
└─────────────────────────────────────────────────────────────┘
```

---

## Hook 规范

### 1. useAgents (主要 Agent Hook)

**位置**: `apps/desktop/src/hooks/use-workspace-resources.ts`

**职责**:
- 获取 Agent 列表 (workspace + global)
- 提供完整 CRUD 操作
- 管理 default agent

```typescript
export interface UseAgentsOptions {
  /** Workspace path to scope agents */
  workspacePath?: string | null;
  /** Include global agents (default: true) */
  includeGlobal?: boolean;
}

export interface UseAgentsReturn {
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

### 2. useChatList (聚合列表 Hook)

**位置**: `apps/desktop/src/hooks/use-workspace-resources.ts`

**职责**:
- 获取侧边栏聚合列表 (Group Chats + Executors + Agents)
- 提供 Agent 操作代理 (delegate to useAgents)

```typescript
export interface UseChatListOptions {
  workspacePath?: string | null;
  includeGlobal?: boolean;
}

export interface UseChatListReturn {
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

## Gateway API 端点

### 现有端点

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat-list` | GET | 聚合列表 |
| `/api/agents` | GET | Agent 列表 |
| `/api/executors` | GET | Executor 列表 |

### 新增端点 (Agent CRUD)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | POST | 创建 Agent |
| `/api/agents/:id` | GET | 获取 Agent 详情 |
| `/api/agents/:id` | PATCH | 更新 Agent |
| `/api/agents/:id` | DELETE | 删除 Agent |
| `/api/agents/default` | GET | 获取默认 Agent ID |
| `/api/agents/default` | PUT | 设置默认 Agent |
| `/api/agents/templates` | GET | 列出模板 |
| `/api/agents/templates` | POST | 从 Agent 创建模板 |
| `/api/agents/templates/:id` | GET | 获取模板 |
| `/api/agents/templates/:id/instantiate` | POST | 从模板创建 Agent |

### Request/Response 示例

#### POST /api/agents

```json
// Request
{
  "name": "My Agent",
  "description": "A custom agent",
  "model": "claude-3-5-sonnet",
  "provider": "anthropic",
  "system_prompt": "You are a helpful assistant",
  "base_path": "/path/to/workspace"  // optional, for workspace-scoped agents
}

// Response
{
  "id": "my-agent",
  "name": "My Agent",
  "agent_type": "viben",
  "source": "global",
  "workspace_path": "~/.viben/agents/my-agent",
  "description": "A custom agent",
  "model": "claude-3-5-sonnet",
  "provider": "anthropic"
}
```

#### PATCH /api/agents/:id

```json
// Request
{
  "name": "Updated Name",
  "description": "Updated description",
  "model": "claude-3-opus"
}

// Response: Updated AgentInfo
```

#### DELETE /api/agents/:id

```json
// Response
{
  "success": true
}
```

#### PUT /api/agents/default

```json
// Request
{
  "agent_id": "my-agent"
}

// Response
{
  "success": true,
  "default_agent_id": "my-agent"
}
```

---

## GatewayClient 扩展

**位置**: `apps/desktop/src/lib/gateway.ts`

```typescript
// 新增方法
class GatewayClient {
  // Agent CRUD
  async createAgent(options: CreateAgentOptions): Promise<AgentInfo>;
  async getAgentById(id: string): Promise<AgentInfo>;
  async updateAgent(id: string, updates: AgentUpdate): Promise<AgentInfo>;
  async deleteAgent(id: string): Promise<void>;

  // Default agent
  async getDefaultAgentId(): Promise<string | null>;
  async setDefaultAgent(id: string): Promise<void>;

  // Templates
  async getTemplates(): Promise<AgentTemplate[]>;
  async getTemplate(id: string): Promise<AgentTemplate>;
  async createTemplate(agentId: string, templateId: string): Promise<AgentTemplate>;
  async createFromTemplate(templateId: string, agentId: string): Promise<AgentInfo>;
}
```

---

## 类型定义

### AgentInfo (Gateway 返回)

```typescript
export interface AgentInfo {
  id: string;
  name: string;
  agent_type: "viben" | "claude-code" | "cursor" | "windsurf" | "cline" | "aider";
  source: "workspace" | "global";
  workspace_path?: string;
  description?: string;
  model?: string;
  provider?: string;
  // Viben-specific fields
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
export interface CreateAgentOptions {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  from_template?: string;
  base_path?: string;  // workspace path for workspace-scoped agents
}
```

### AgentUpdate

```typescript
export interface AgentUpdate {
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

### AgentTemplate

```typescript
export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  config: {
    name: string;
    description?: string;
    model?: string;
    provider?: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
  };
  created_at: string;
}
```

---

## 迁移计划

### Phase 1: Backend API

1. 在 `packages/core/src/gateway/routes/agents.ts` 添加 CRUD handlers
2. 添加 `/api/agents/default` 端点
3. 添加 `/api/agents/templates` 端点
4. 编写测试

### Phase 2: Gateway Client

1. 在 `apps/desktop/src/lib/gateway.ts` 添加新方法
2. 添加类型定义

### Phase 3: Hook 重构

1. 增强 `useAgents` hook 添加 CRUD 操作
2. 增强 `useChatList` hook 添加 agentOperations
3. 更新所有 `useVibenAgents` 导入为 `useAgents`

### Phase 4: 清理

1. 删除 `use-viben-agents.ts`
2. 更新 `hooks/index.ts` 导出
3. 清理 `use-unified-agents.ts`

---

## 受影响的文件

### 需要修改

| File | Change |
|------|--------|
| `packages/core/src/gateway/routes/agents.ts` | 添加 CRUD handlers |
| `apps/desktop/src/lib/gateway.ts` | 添加 GatewayClient 方法 |
| `apps/desktop/src/hooks/use-workspace-resources.ts` | 增强 useAgents, useChatList |
| `apps/desktop/src/hooks/index.ts` | 更新导出 |
| `apps/desktop/src/hooks/use-chat-config.ts` | 更新导入 |
| `apps/desktop/src/hooks/use-unified-agents.ts` | 更新依赖 |
| `apps/desktop/src/pages/agent-detail.tsx` | 更新导入 |
| `apps/desktop/src/pages/workspace-agents.tsx` | 更新导入 |
| `apps/desktop/src/pages/workspace-chat.tsx` | 更新导入 |
| `apps/desktop/src/pages/workspace-kanban.tsx` | 更新导入 |
| `apps/desktop/src/pages/settings-channels.tsx` | 更新导入 |

### 需要删除

| File | Reason |
|------|--------|
| `apps/desktop/src/hooks/use-viben-agents.ts` | 功能合并到 useAgents |

---

## 验收标准

- [ ] Gateway API `/api/agents` CRUD 端点正常工作
- [ ] Gateway API `/api/agents/default` 端点正常工作
- [ ] Gateway API `/api/agents/templates` 端点正常工作
- [ ] `useAgents` hook 提供完整 CRUD 操作
- [ ] `useChatList` hook 提供 agentOperations
- [ ] 所有 `useVibenAgents` 导入已替换为 `useAgents`
- [ ] `use-viben-agents.ts` 文件已删除
- [ ] TypeScript 编译通过
- [ ] 所有测试通过
- [ ] Agent 列表在侧边栏正常显示
- [ ] Agent 创建/更新/删除操作正常工作
- [ ] 默认 Agent 设置正常工作
