# Desktop-CLI Integration Specification

> Desktop 应用与 Viben CLI 的集成规范

**Status**: ✅ 已实现 (2026-02-07)

---

## Overview

### Architecture (已实现)

```
┌─────────────────────────────────────────────────────────────┐
│                      @viben/core (TypeScript)                │
│              packages/core/src/                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │AgentManager │ │ProviderMgr │ │ ModelManager│            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ConfigManager│ │   Paths    │  (async Node.js)            │
│  └─────────────┘ └─────────────┘                            │
├─────────────────────────────────────────────────────────────┤
│                    ↑              ↑                          │
│        ┌──────────────┐    ┌──────────────┐                 │
│        │  viben CLI   │    │   Desktop    │                 │
│        │  apps/cli/   │    │apps/desktop/ │                 │
│        │ (Commander)  │    │  (Tauri)     │                 │
│        └──────────────┘    └──────────────┘                 │
│              ↓                    ↓                          │
│        导入 @viben/core    Gateway HTTP API                  │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**:
- **@viben/core** 是 TypeScript 共享库，包含所有业务逻辑
- CLI (`apps/cli/`) 直接导入 @viben/core
- Desktop (`apps/desktop/`) 通过 Gateway HTTP API 访问 @viben/core
- 避免重复实现逻辑
- 单一真相源：所有配置管理逻辑在 TypeScript 中实现
- 数据存储在 `~/.viben/` 目录，CLI 和 Desktop 共享

### Why TypeScript?

1. **统一代码库**：CLI 和 Desktop 共享同一套 TypeScript 实现
2. **类型安全**：TypeScript 的类型系统确保数据一致性
3. **开发效率**：热重载，更快的迭代周期
4. **生态系统**：丰富的 npm 包生态
5. **Gateway 架构**：统一的 HTTP API，支持多客户端

---

## Shared Configuration

### File Locations

Desktop 和 CLI 使用相同的配置文件结构：

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

---

## Package Structure (已实现)

### @viben/core Package

```
packages/core/src/
├── index.ts                     # Main exports
├── error.ts                     # Error types
├── config/
│   ├── index.ts                 # ConfigManager (GlobalConfig)
│   ├── paths.ts                 # Path utilities (~/.viben/)
│   └── yaml.ts                  # YAML/JSON read/write (async)
├── agents/
│   ├── index.ts                 # AgentManager (CRUD + templates + sessions + memory)
│   └── types.ts                 # Agent, AgentTemplate, CreateAgentOptions, etc.
├── providers/
│   ├── index.ts                 # ProviderManager (CRUD + enable/disable + test)
│   └── types.ts                 # Provider, ProviderType, CreateProviderOptions
├── models/
│   ├── index.ts                 # ModelManager (CRUD + known models)
│   ├── types.ts                 # Model, CreateModelOptions, KnownModel
│   └── known.ts                 # 内置已知模型列表 (OpenAI, Anthropic, Ollama, etc.)
├── gateway/                     # HTTP Gateway server
│   ├── server.ts                # Fastify server
│   └── routes/                  # API routes
└── cli/                         # CLI commands
    ├── index.ts                 # CLI entry (Commander)
    └── commands/
        ├── agent.ts             # viben agent <subcommand>
        ├── provider.ts          # viben provider <subcommand>
        └── model.ts             # viben model <subcommand>
```

### apps/cli Package

```
apps/cli/
├── package.json
└── src/
    ├── index.ts                 # CLI entry point
    └── lib/
        └── utils.ts             # CLI utilities
```

### Desktop Gateway Integration

```
apps/desktop/src/
├── lib/
│   └── gateway.ts               # Gateway HTTP client
├── hooks/
│   └── use-workspace-resources.ts  # React hooks for agents, providers, models
└── pages/                       # UI pages using Gateway API
```

### Dependencies

```json
// packages/core/package.json
{
  "name": "@viben/core",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "yaml": "^2.0.0",
    "fastify": "^5.0.0",
    "commander": "^12.0.0",
    "chalk": "^5.0.0",
    "uuid": "^9.0.0"
  }
}
```

---

## CLI Integration (已实现)

### CLI Commands

```bash
# Agent 管理
viben agent list                            # 列出所有 agents
viben agent show <id>                       # 显示 agent 详情
viben agent create --name <name>            # 创建 agent
viben agent update <id>                     # 更新 agent
viben agent remove <id>                     # 删除 agent
viben agent set-default <id>                # 设置默认 agent

# Provider 管理
viben provider list                         # 列出所有 providers
viben provider show <id>                    # 显示 provider 详情
viben provider create --name <n> --type <t> # 添加 provider
viben provider update <id>                  # 更新 provider
viben provider remove <id>                  # 删除 provider
viben provider set-default <id>             # 设置默认 provider
viben provider enable <id>                  # 启用 provider
viben provider disable <id>                 # 禁用 provider
viben provider test <id>                    # 测试连接

# Model 管理
viben model list                            # 列出所有 models
viben model show <id>                       # 显示 model 详情
viben model create --id <id> --name <n> --provider <p>  # 添加自定义 model
viben model update <id>                     # 更新 model
viben model remove <id>                     # 删除 model
viben model set-default <id>                # 设置默认 model
viben model known                           # 列出内置已知 models

# Executor 管理
viben executor list                         # 列出所有 executors
viben executor chat -n <name> -p <prompt>   # 运行 executor chat

# Gateway 服务
viben gateway start                         # 启动 gateway
viben gateway stop                          # 停止 gateway
viben gateway status                        # 查看状态

# 全局选项
--json                                      # JSON 输出
--verbose                                   # 详细输出
--quiet                                     # 安静模式
```

---

## Desktop Integration (已实现)

### Gateway HTTP API

Desktop 应用通过 Gateway HTTP API 访问 @viben/core 功能。Gateway 运行在 `http://127.0.0.1:18790`。

**Agent Endpoints**:
- `GET /api/agents` - 列出所有 agents
- `GET /api/agents/:id` - 获取单个 agent
- `POST /api/agents` - 创建 agent
- `PATCH /api/agents/:id` - 更新 agent
- `DELETE /api/agents/:id` - 删除 agent
- `GET /api/agents/default` - 获取默认 agent ID
- `PUT /api/agents/default` - 设置默认 agent
- `GET /api/agents/templates` - 列出模板
- `POST /api/agents/templates` - 创建模板
- `POST /api/agents/templates/:id/instantiate` - 从模板创建 agent

**Provider Endpoints**:
- `GET /api/providers` - 列出所有 providers
- `GET /api/providers/:id` - 获取单个 provider
- `POST /api/providers` - 创建 provider
- `PATCH /api/providers/:id` - 更新 provider
- `DELETE /api/providers/:id` - 删除 provider
- `PUT /api/providers/:id/enable` - 启用 provider
- `PUT /api/providers/:id/disable` - 禁用 provider
- `POST /api/providers/:id/test` - 测试连接

**Model Endpoints**:
- `GET /api/models` - 列出所有 models
- `GET /api/models/:id` - 获取单个 model
- `POST /api/models` - 创建自定义 model
- `PATCH /api/models/:id` - 更新 model
- `DELETE /api/models/:id` - 删除自定义 model
- `GET /api/models/known` - 列出内置已知 models

### Frontend Usage Example

```typescript
// apps/desktop/src/lib/gateway.ts
import { GatewayClient } from "./gateway";

const gateway = new GatewayClient("http://127.0.0.1:18790");

// 调用 Gateway API
const agents = await gateway.getAgents();
const agent = await gateway.createAgent({ name: "My Agent" });
await gateway.deleteAgent("agent-id");
```

---

## API Design

### AgentManager

```typescript
// packages/core/src/agents/index.ts

export class AgentManager {
  private baseDir: string;

  constructor();

  // Agent CRUD
  async listAgents(): Promise<Agent[]>;
  async getAgent(id: string): Promise<Agent | null>;
  async createAgent(options: CreateAgentOptions): Promise<Agent>;
  async removeAgent(id: string): Promise<void>;
  async updateAgent(id: string, updates: AgentUpdate): Promise<Agent>;
  async setDefault(id: string): Promise<void>;
  async getDefault(): Promise<string | null>;

  // Templates
  async listTemplates(): Promise<AgentTemplate[]>;
  async createTemplate(agentId: string, templateId: string): Promise<AgentTemplate>;
  async createFromTemplate(templateId: string, agentId: string): Promise<Agent>;

  // Sessions
  async listSessions(agentId: string): Promise<AgentSession[]>;
  async createSession(agentId: string, name?: string): Promise<AgentSession>;
  async removeSession(agentId: string, sessionId: string): Promise<void>;

  // Memory
  async getMemory(agentId: string): Promise<AgentMemory>;
  async appendMemory(agentId: string, content: string): Promise<void>;
}
```

### ProviderManager

```typescript
// packages/core/src/providers/index.ts

export class ProviderManager {
  private configPath: string;

  constructor();

  async listProviders(): Promise<Provider[]>;
  async getProvider(id: string): Promise<Provider | null>;
  async createProvider(options: CreateProviderOptions): Promise<Provider>;
  async removeProvider(id: string): Promise<void>;
  async updateProvider(id: string, updates: ProviderUpdate): Promise<Provider>;
  async setDefault(id: string): Promise<void>;
  async getDefault(): Promise<string | null>;
  async setEnabled(id: string, enabled: boolean): Promise<void>;
  async checkStatus(id: string): Promise<ProviderStatus>;
}
```

### ModelManager

```typescript
// packages/core/src/models/index.ts

export class ModelManager {
  private configPath: string;

  constructor();

  // Models
  listKnownModels(): KnownModel[];
  async getDefault(): Promise<string | null>;
  async setDefault(model: string): Promise<void>;

  // Aliases
  async getAliases(): Promise<Record<string, string>>;
  async createAlias(alias: string, model: string): Promise<void>;
  async removeAlias(alias: string): Promise<void>;
  resolveAlias(aliasOrModel: string): string;

  // Fallbacks
  async getFallbacks(): Promise<string[]>;
  async addFallback(model: string): Promise<void>;
  async removeFallback(model: string): Promise<void>;
  async setFallbacks(fallbacks: string[]): Promise<void>;
}
```

---

## Types

### TypeScript Types

```typescript
// packages/core/src/agents/types.ts

export interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentOptions {
  id?: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  fromTemplate?: string;
}
```

---

## Implementation Status

### Phase 1: Create @viben/core Package ✅

- [x] 创建 `packages/core/src/` 目录结构
- [x] 实现配置文件读写 (YAML/JSON) - `config/yaml.ts`
- [x] 实现路径工具 - `config/paths.ts`
- [x] 实现 ConfigManager - `config/index.ts`
- [x] 实现 AgentManager - `agents/index.ts` (CRUD + templates + sessions + memory)
- [x] 实现 ProviderManager - `providers/index.ts` (CRUD + enable/disable + test)
- [x] 实现 ModelManager - `models/index.ts` (CRUD + known models)
- [x] Error types - `error.ts`
- [x] Gateway server - `gateway/server.ts`

### Phase 2: Integrate with Desktop ✅

- [x] Desktop 通过 Gateway HTTP API 访问 @viben/core
- [x] 创建 GatewayClient - `apps/desktop/src/lib/gateway.ts`
- [x] 创建 React hooks - `apps/desktop/src/hooks/use-workspace-resources.ts`
- [x] 更新 Settings 页面使用新 hooks

### Phase 3: Create TypeScript CLI ✅

- [x] 创建 `apps/cli/` TypeScript CLI
- [x] 使用 Commander 实现命令行接口
- [x] 实现 agent/provider/model/executor/gateway 命令
- [x] 支持 `--json` 输出格式

### Phase 4: Testing & Polish (进行中)

- [ ] @viben/core 单元测试
- [ ] 测试 CLI 和 Desktop 的配置同步
- [ ] 测试 Provider 连通性检查
- [ ] 测试 Agent 创建/删除流程
- [ ] UI 完善和错误处理

---

## Migration Notes

### From Rust crates/viben-core

原有的 Rust `crates/viben-core` 已被 TypeScript `@viben/core` 替代：

1. `crates/` 目录已删除
2. Desktop 通过 Gateway HTTP API 访问 @viben/core
3. CLI 使用 TypeScript (apps/cli/) 导入 @viben/core

### TypeScript Type Definitions

类型定义直接从 @viben/core 导出：

```typescript
// 从 @viben/core 导入类型
import type { Agent, CreateAgentOptions } from "@viben/core";

// 或从 gateway client 导入
import type { AgentInfo, CreateAgentOptions } from "@/lib/gateway";
```

---

## Acceptance Criteria

### @viben/core Package

- [x] 配置文件读写正常 (YAML)
- [x] AgentManager 实现完整
- [x] ProviderManager 实现完整
- [x] ModelManager 实现完整
- [x] Gateway server 实现完整
- [ ] 单元测试覆盖

### Desktop Integration

- [x] Gateway HTTP API 正常工作
- [x] GatewayClient 封装完整
- [ ] Agents 页面功能正常
- [ ] Providers 设置页面正常
- [ ] Models 设置页面正常
- [ ] i18n 支持 (EN/ZH-CN)

### CLI + Desktop 协同

- [x] CLI 和 Desktop 共享 @viben/core
- [x] 配置文件格式完全兼容 (~/.viben/)
- [ ] Desktop 修改配置后 CLI 能读取 (需要测试)
- [ ] CLI 修改配置后 Desktop 能读取 (需要测试)

---

## Related Documents

- [CLI Application Specification](./cli/cli-app.md) - CLI 完整规范
- [Executor Chat Specification](./cli/executor-chat.md) - Executor Chat 命令规范
- [Workspace Management](./workspace-management.md) - 工作区管理规范
