# Desktop-CLI Integration Specification

> Desktop 应用与 Viben CLI 的集成规范

---

## Overview

### Architecture Principle

```
┌─────────────────────────────────────────────────────────────┐
│                      @viben/core                             │
│  (共享核心库 - 配置管理、Agent、Provider、Model 等)          │
├─────────────────────────────────────────────────────────────┤
│                    ↑              ↑                          │
│        ┌──────────────┐    ┌──────────────┐                 │
│        │   viben CLI  │    │   Desktop    │                 │
│        │ (命令行界面) │    │  (图形界面)  │                 │
│        └──────────────┘    └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**:
- **@viben/core** 是共享库，包含所有业务逻辑
- CLI 和 Desktop 都使用 @viben/core
- CLI 提供命令行界面
- Desktop 提供图形界面
- 避免重复实现逻辑

---

## Shared Configuration

### File Locations

Desktop 使用与 CLI 相同的配置文件结构：

```
~/.viben/                                    # 状态目录 (VIBEN_STATE_DIR)
├── config.yaml                              # 全局配置
├── providers.yaml                           # API Providers 配置
├── models.yaml                              # Models 配置
├── agents/                                  # Agent 实例目录
│   └── <agent-id>/
│       ├── config.yaml                      # Agent 配置
│       ├── mcp_servers.json                 # MCP servers 配置
│       ├── skills/                          # Agent 专属 skills
│       ├── memory/                          # Agent 记忆
│       └── .agent_sessions/                 # 会话存储
├── agent-templates/                         # Agent 模板目录
├── mcp/                                     # 共享 MCP
│   ├── installed.yaml
│   └── <name>/
└── skills/                                  # 共享 Skills
    ├── installed.yaml
    └── <name>/
```

Desktop 通过 @viben/core 库读写这些配置文件。

---

## Package Structure

### @viben/core Library

```
packages/core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Main exports
│   ├── config/
│   │   ├── index.ts             # Config management
│   │   ├── paths.ts             # Path utilities
│   │   ├── scope.ts             # Scope detection
│   │   └── yaml.ts              # YAML read/write
│   ├── agents/
│   │   ├── index.ts             # Agent management
│   │   ├── types.ts             # Agent types
│   │   ├── memory.ts            # Memory management
│   │   └── session.ts           # Session management
│   ├── providers/
│   │   ├── index.ts             # Provider management
│   │   ├── types.ts             # Provider types
│   │   └── adapters/            # Provider adapters
│   ├── models/
│   │   ├── index.ts             # Model management
│   │   ├── types.ts             # Model types
│   │   ├── aliases.ts           # Alias management
│   │   └── fallbacks.ts         # Fallback chain
│   ├── mcp/
│   │   ├── index.ts             # MCP management
│   │   └── types.ts
│   ├── skills/
│   │   ├── index.ts             # Skills management
│   │   └── types.ts
│   └── types/
│       └── index.ts             # Shared types
```

### Package Dependencies

```json
// packages/core/package.json
{
  "name": "@viben/core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "dependencies": {
    "yaml": "^2.4.0"
  }
}
```

---

## Desktop UI Changes

### New Pages/Tabs

根据 CLI 功能，Desktop 需要在 Workspace 页面添加新的 Tab：

| Tab 名称 | 位置 | 功能 |
|----------|------|------|
| **Agents** | 侧边栏 (发现的智能体右侧) | Agent 实例管理 |
| **Providers** | Settings 页面内 | API Provider 配置 |
| **Models** | Settings 页面内 | Model 别名和回退链 |

### Tab Structure

```
Workspace Detail Page
├── Overview (现有)
├── MCP Servers (现有)
├── Skills (现有)
├── Agents (新增)              ← Agent 实例管理
│   ├── Agent List             # 列表视图
│   ├── Agent Detail           # 详情/编辑
│   ├── Templates              # 模板管理
│   └── Sessions               # 会话管理
├── Commands (现有)
└── Chat (现有)

Settings Page
├── General (现有)
├── Appearance (现有)
├── Environment (现有)
├── Providers (新增)           ← Provider 配置
│   ├── Provider List          # 已配置的 providers
│   ├── Add Provider           # 添加新 provider
│   └── Provider Status        # 连通性检查
├── Models (新增)              ← Model 配置
│   ├── Available Models       # 可用模型列表
│   ├── Aliases                # 模型别名
│   └── Fallbacks              # 回退链配置
├── Storage (现有)
└── About (现有)
```

---

## Desktop Implementation

### 1. Agent Management UI

**File**: `apps/desktop/src/pages/workspace-agents.tsx`

```typescript
import { useState, useEffect } from 'react';
import { AgentManager, type Agent, type AgentTemplate } from '@viben/core';

export function WorkspaceAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    async function loadAgents() {
      const manager = new AgentManager();
      setAgents(await manager.listAgents());
      setTemplates(await manager.listTemplates());
    }
    loadAgents();
  }, []);

  // UI implementation...
}
```

### 2. Provider Configuration UI

**File**: `apps/desktop/src/pages/settings-providers.tsx`

```typescript
import { useState, useEffect } from 'react';
import { ProviderManager, type Provider } from '@viben/core';

export function SettingsProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<string>('');

  useEffect(() => {
    async function loadProviders() {
      const manager = new ProviderManager();
      setProviders(await manager.listProviders());
      setDefaultProvider(await manager.getDefault());
    }
    loadProviders();
  }, []);

  async function handleAddProvider(type: string, config: ProviderConfig) {
    const manager = new ProviderManager();
    await manager.createProvider(config);
    // Refresh list
  }

  async function handleCheckStatus(providerId: string) {
    const manager = new ProviderManager();
    return manager.checkStatus(providerId);
  }

  // UI implementation...
}
```

### 3. Model Configuration UI

**File**: `apps/desktop/src/pages/settings-models.tsx`

```typescript
import { useState, useEffect } from 'react';
import { ModelManager, type ModelAlias, type ModelFallback } from '@viben/core';

export function SettingsModelsPage() {
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');

  useEffect(() => {
    async function loadModels() {
      const manager = new ModelManager();
      setAliases(await manager.getAliases());
      setFallbacks(await manager.getFallbacks());
      setDefaultModel(await manager.getDefault());
    }
    loadModels();
  }, []);

  // UI implementation...
}
```

---

## @viben/core API Design

### AgentManager

```typescript
// packages/core/src/agents/index.ts

export interface AgentManager {
  // Agent CRUD
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | null>;
  createAgent(options: CreateAgentOptions): Promise<Agent>;
  removeAgent(id: string): Promise<void>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent>;
  setDefault(id: string): Promise<void>;
  getDefault(): Promise<string>;

  // Templates
  listTemplates(): Promise<AgentTemplate[]>;
  createTemplate(agentId: string, templateId: string): Promise<AgentTemplate>;
  createAgentFromTemplate(templateId: string, agentId: string): Promise<Agent>;

  // Sessions
  listSessions(agentId: string): Promise<AgentSession[]>;
  createSession(agentId: string, name?: string): Promise<AgentSession>;
  removeSession(agentId: string, sessionId: string): Promise<void>;

  // Memory
  getMemory(agentId: string): Promise<AgentMemory>;
  appendMemory(agentId: string, content: string): Promise<void>;
  getDailyLogs(agentId: string, days?: number): Promise<DailyLog[]>;
}
```

### ProviderManager

```typescript
// packages/core/src/providers/index.ts

export interface ProviderManager {
  listProviders(): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | null>;
  createProvider(config: CreateProviderOptions): Promise<Provider>;
  removeProvider(id: string): Promise<void>;
  setDefault(id: string): Promise<void>;
  getDefault(): Promise<string>;
  checkStatus(id: string): Promise<ProviderStatus>;
  checkAllStatus(): Promise<Record<string, ProviderStatus>>;
}
```

### ModelManager

```typescript
// packages/core/src/models/index.ts

export interface ModelManager {
  // Models
  listModels(): Promise<Model[]>;
  getDefault(): Promise<string>;
  setDefault(model: string): Promise<void>;

  // Aliases
  getAliases(): Promise<Record<string, string>>;
  createAlias(alias: string, model: string): Promise<void>;
  removeAlias(alias: string): Promise<void>;
  resolveAlias(aliasOrModel: string): string;

  // Fallbacks
  getFallbacks(): Promise<string[]>;
  addFallback(model: string): Promise<void>;
  removeFallback(model: string): Promise<void>;
  clearFallbacks(): Promise<void>;

  // Config
  getModelConfig(model: string): Promise<ModelConfig | null>;
  setModelConfig(model: string, config: ModelConfig): Promise<void>;
}
```

---

## i18n Keys

### English (`en.json`)

```json
{
  "agents": {
    "title": "Agents",
    "list": "Agent List",
    "create": "Create Agent",
    "createFromTemplate": "Create from Template",
    "clone": "Clone Agent",
    "remove": "Remove Agent",
    "setDefault": "Set as Default",
    "templates": "Templates",
    "sessions": "Sessions",
    "memory": "Memory",
    "noAgents": "No agents configured",
    "noTemplates": "No templates available"
  },
  "providers": {
    "title": "API Providers",
    "list": "Configured Providers",
    "add": "Add Provider",
    "remove": "Remove Provider",
    "setDefault": "Set as Default",
    "status": "Status",
    "connected": "Connected",
    "error": "Error",
    "checking": "Checking...",
    "noProviders": "No providers configured"
  },
  "models": {
    "title": "Models",
    "default": "Default Model",
    "aliases": "Model Aliases",
    "fallbacks": "Fallback Chain",
    "addAlias": "Add Alias",
    "addFallback": "Add to Fallback",
    "removeAlias": "Remove Alias",
    "removeFallback": "Remove from Fallback",
    "noAliases": "No aliases configured",
    "noFallbacks": "No fallbacks configured"
  }
}
```

### Chinese (`zh-CN.json`)

```json
{
  "agents": {
    "title": "智能体",
    "list": "智能体列表",
    "create": "创建智能体",
    "createFromTemplate": "从模板创建",
    "clone": "克隆智能体",
    "remove": "删除智能体",
    "setDefault": "设为默认",
    "templates": "模板",
    "sessions": "会话",
    "memory": "记忆",
    "noAgents": "未配置智能体",
    "noTemplates": "无可用模板"
  },
  "providers": {
    "title": "API 提供商",
    "list": "已配置的提供商",
    "add": "添加提供商",
    "remove": "删除提供商",
    "setDefault": "设为默认",
    "status": "状态",
    "connected": "已连接",
    "error": "错误",
    "checking": "检查中...",
    "noProviders": "未配置提供商"
  },
  "models": {
    "title": "模型",
    "default": "默认模型",
    "aliases": "模型别名",
    "fallbacks": "回退链",
    "addAlias": "添加别名",
    "addFallback": "添加到回退链",
    "removeAlias": "删除别名",
    "removeFallback": "从回退链移除",
    "noAliases": "未配置别名",
    "noFallbacks": "未配置回退链"
  }
}
```

---

## Implementation Phases

### Phase 1: @viben/core Library

1. 创建 `packages/core/` 目录结构
2. 实现配置文件读写 (YAML)
3. 实现 AgentManager
4. 实现 ProviderManager
5. 实现 ModelManager
6. 添加类型定义

### Phase 2: CLI Integration

1. 更新 CLI 使用 @viben/core
2. 验证所有 CLI 命令正常工作
3. 确保配置文件格式一致

### Phase 3: Desktop UI

1. 添加 Agents Tab 到 Workspace
2. 添加 Providers 页面到 Settings
3. 添加 Models 页面到 Settings
4. 添加 i18n 翻译

### Phase 4: Testing & Polish

1. 测试 CLI 和 Desktop 的配置同步
2. 测试 Provider 连通性检查
3. 测试 Agent 创建/删除流程
4. UI 完善和错误处理

---

## Acceptance Criteria

### @viben/core

- [ ] 配置文件读写正常 (YAML)
- [ ] AgentManager 实现完整
- [ ] ProviderManager 实现完整
- [ ] ModelManager 实现完整
- [ ] TypeScript 类型定义完整
- [ ] 单元测试覆盖

### Desktop Integration

- [ ] Agents Tab 显示在 Workspace 页面
- [ ] Agent 列表正确加载
- [ ] Agent 创建/删除功能正常
- [ ] Agent 模板管理正常
- [ ] Providers 配置页面正常工作
- [ ] Provider 连通性检查正常
- [ ] Models 配置页面正常工作
- [ ] 模型别名管理正常
- [ ] 回退链管理正常
- [ ] i18n 支持 (EN/ZH-CN)

### CLI + Desktop 协同

- [ ] Desktop 修改配置后 CLI 能读取
- [ ] CLI 修改配置后 Desktop 能读取
- [ ] 配置文件格式完全兼容

---

## Related Documents

- [CLI Application Specification](./cli-app.md) - CLI 完整规范
- [Desktop Integration](./desktop-integration.md) - 原有 Desktop 集成规范
- [Workspace Management](./workspace-management.md) - 工作区管理规范
