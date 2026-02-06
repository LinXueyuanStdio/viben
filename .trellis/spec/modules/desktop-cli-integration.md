# Desktop-CLI Integration Specification

> Desktop 应用与 Viben CLI 的集成规范

**Status**: ✅ 已实现 (2026-02-07)

---

## Overview

### Architecture (已实现)

```
┌─────────────────────────────────────────────────────────────┐
│                      viben-core (Rust)                       │
│              crates/viben-core/                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │AgentManager │ │ProviderMgr │ │ ModelManager│            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ConfigManager│ │   Paths    │  (async tokio)              │
│  └─────────────┘ └─────────────┘                            │
├─────────────────────────────────────────────────────────────┤
│                    ↑              ↑                          │
│        ┌──────────────┐    ┌──────────────┐                 │
│        │  viben-cli   │    │   Desktop    │                 │
│        │ crates/cli/  │    │apps/desktop/ │                 │
│        │  (clap CLI)  │    │  (Tauri)     │                 │
│        └──────────────┘    └──────────────┘                 │
│              ↓                    ↓                          │
│        直接链接 crate      37 个 Tauri Commands              │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**:
- **viben-core** 是 Rust 共享库 (crate)，包含所有业务逻辑
- CLI (`crates/viben-cli/`) 直接链接 viben-core crate
- Desktop (`apps/desktop/src-tauri/`) 通过 Tauri commands 暴露 viben-core API
- 避免重复实现逻辑
- 单一真相源：所有配置管理逻辑在 Rust 中实现
- 数据存储在 `~/.viben/` 目录，CLI 和 Desktop 共享

### Why Rust?

1. **统一代码库**：CLI 和 Desktop 共享同一套 Rust 实现
2. **类型安全**：Rust 的类型系统确保数据一致性
3. **性能**：原生性能，无 Node.js 运行时开销
4. **Tauri 原生支持**：Desktop 后端已是 Rust，无需 FFI
5. **无浏览器兼容问题**：不需要处理 Node.js vs Browser 差异

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

## Crate Structure (已实现)

### viben-core Crate

```
crates/viben-core/
├── Cargo.toml
└── src/
    ├── lib.rs                   # Main exports + initialize()
    ├── error.rs                 # Error types (thiserror)
    ├── config/
    │   ├── mod.rs               # ConfigManager (GlobalConfig)
    │   ├── paths.rs             # Path utilities (~/.viben/)
    │   └── yaml.rs              # YAML/JSON read/write (async)
    ├── agents/
    │   ├── mod.rs               # AgentManager (CRUD + templates + sessions + memory)
    │   └── types.rs             # Agent, AgentTemplate, CreateAgentOptions, etc.
    ├── providers/
    │   ├── mod.rs               # ProviderManager (CRUD + enable/disable + test)
    │   └── types.rs             # Provider, ProviderType, CreateProviderOptions
    └── models/
        ├── mod.rs               # ModelManager (CRUD + known models)
        ├── types.rs             # Model, CreateModelOptions, KnownModel
        └── known.rs             # 内置已知模型列表 (OpenAI, Anthropic, Ollama, etc.)
```

### viben-cli Crate

```
crates/viben-cli/
├── Cargo.toml
└── src/
    ├── main.rs                  # CLI entry (clap)
    └── commands/
        ├── mod.rs
        ├── init.rs              # viben init
        ├── config.rs            # viben config
        ├── agent.rs             # viben agent <subcommand>
        ├── provider.rs          # viben provider <subcommand>
        └── model.rs             # viben model <subcommand>
```

### Desktop Tauri Commands

```
apps/desktop/src-tauri/src/commands/
├── mod.rs                       # Re-exports
├── viben_agents.rs              # 17 个 Agent 命令
├── viben_providers.rs           # 10 个 Provider 命令
└── viben_models.rs              # 10 个 Model 命令
```

### Dependencies

```toml
# crates/viben-core/Cargo.toml
[package]
name = "viben-core"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_yaml = "0.9"
serde_json = "1.0"
tokio = { version = "1", features = ["fs", "io-util"] }
dirs = "5.0"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.0", features = ["v4", "serde"] }
thiserror = "1.0"
```

---

## CLI Integration (已实现)

### CLI Commands

```bash
# 初始化
viben init [path]

# 配置管理
viben config [key] [value] --list

# Agent 管理
viben agent list                            # 列出所有 agents
viben agent show --id <id>                  # 显示 agent 详情
viben agent create --name <name>            # 创建 agent
viben agent update --id <id>                # 更新 agent
viben agent remove --id <id>                # 删除 agent
viben agent set-default --id <id>           # 设置默认 agent

# Provider 管理
viben provider list                         # 列出所有 providers
viben provider show --id <id>               # 显示 provider 详情
viben provider add --name <n> --provider-type <t>  # 添加 provider
viben provider update --id <id>             # 更新 provider
viben provider remove --id <id>             # 删除 provider
viben provider set-default --id <id>        # 设置默认 provider
viben provider enable --id <id>             # 启用 provider
viben provider disable --id <id>            # 禁用 provider
viben provider test --id <id>               # 测试连接

# Model 管理
viben model list                            # 列出所有 models
viben model show --id <id>                  # 显示 model 详情
viben model add --id <id> --name <n> --provider <p>  # 添加自定义 model
viben model update --id <id>                # 更新 model
viben model remove --id <id>                # 删除 model
viben model set-default --id <id>           # 设置默认 model
viben model known                           # 列出内置已知 models

# 全局选项
--json                                      # JSON 输出
--verbose                                   # 详细输出
--quiet                                     # 安静模式
```

---

## Desktop Integration (已实现)

### Tauri Commands (37个)

**Agent Commands (17个)** - `viben_agents.rs`:
- `viben_list_agents` - 列出所有 agents
- `viben_get_agent` - 获取单个 agent
- `viben_create_agent` - 创建 agent
- `viben_remove_agent` - 删除 agent
- `viben_update_agent` - 更新 agent
- `viben_set_default_agent` - 设置默认 agent
- `viben_get_default_agent` - 获取默认 agent ID
- `viben_list_templates` - 列出模板
- `viben_get_template` - 获取模板
- `viben_create_template` - 从 agent 创建模板
- `viben_create_from_template` - 从模板创建 agent
- `viben_list_sessions` - 列出会话
- `viben_create_session` - 创建会话
- `viben_remove_session` - 删除会话
- `viben_get_memory` - 获取 agent 记忆
- `viben_append_memory` - 追加 agent 记忆

**Provider Commands (10个)** - `viben_providers.rs`:
- `viben_list_providers` - 列出所有 providers
- `viben_get_provider` - 获取单个 provider
- `viben_create_provider` - 创建 provider
- `viben_remove_provider` - 删除 provider
- `viben_update_provider` - 更新 provider
- `viben_set_default_provider` - 设置默认 provider
- `viben_get_default_provider` - 获取默认 provider ID
- `viben_enable_provider` - 启用 provider
- `viben_disable_provider` - 禁用 provider
- `viben_test_provider_connection` - 测试连接

**Model Commands (10个)** - `viben_models.rs`:
- `viben_list_models` - 列出所有 models
- `viben_list_models_for_provider` - 按 provider 过滤 models
- `viben_get_model` - 获取单个 model
- `viben_create_model` - 创建自定义 model
- `viben_remove_model` - 删除自定义 model
- `viben_update_model` - 更新 model
- `viben_set_default_model` - 设置默认 model
- `viben_get_default_model` - 获取默认 model ID
- `viben_enable_model` - 启用 model
- `viben_disable_model` - 禁用 model

### Frontend Usage Example

```typescript
// apps/desktop/src/hooks/use-agents.ts
import { invoke } from "@tauri-apps/api/core";

// 调用 Tauri command
const agents = await invoke<Agent[]>("viben_list_agents");
const agent = await invoke<Agent>("viben_create_agent", { options });
await invoke("viben_remove_agent", { id: "agent-id" });
```

---

## API Design

### AgentManager

```rust
// crates/viben-core/src/agents/mod.rs

pub struct AgentManager {
    base_dir: PathBuf,
}

impl AgentManager {
    pub fn new() -> Self;

    // Agent CRUD
    pub async fn list_agents(&self) -> Result<Vec<Agent>>;
    pub async fn get_agent(&self, id: &str) -> Result<Option<Agent>>;
    pub async fn create_agent(&self, options: CreateAgentOptions) -> Result<Agent>;
    pub async fn remove_agent(&self, id: &str) -> Result<()>;
    pub async fn update_agent(&self, id: &str, updates: AgentUpdate) -> Result<Agent>;
    pub async fn set_default(&self, id: &str) -> Result<()>;
    pub async fn get_default(&self) -> Result<Option<String>>;

    // Templates
    pub async fn list_templates(&self) -> Result<Vec<AgentTemplate>>;
    pub async fn create_template(&self, agent_id: &str, template_id: &str) -> Result<AgentTemplate>;
    pub async fn create_from_template(&self, template_id: &str, agent_id: &str) -> Result<Agent>;

    // Sessions
    pub async fn list_sessions(&self, agent_id: &str) -> Result<Vec<AgentSession>>;
    pub async fn create_session(&self, agent_id: &str, name: Option<&str>) -> Result<AgentSession>;
    pub async fn remove_session(&self, agent_id: &str, session_id: &str) -> Result<()>;

    // Memory
    pub async fn get_memory(&self, agent_id: &str) -> Result<AgentMemory>;
    pub async fn append_memory(&self, agent_id: &str, content: &str) -> Result<()>;
}
```

### ProviderManager

```rust
// crates/viben-core/src/providers/mod.rs

pub struct ProviderManager {
    config_path: PathBuf,
}

impl ProviderManager {
    pub fn new() -> Self;

    pub async fn list_providers(&self) -> Result<Vec<Provider>>;
    pub async fn get_provider(&self, id: &str) -> Result<Option<Provider>>;
    pub async fn create_provider(&self, options: CreateProviderOptions) -> Result<Provider>;
    pub async fn remove_provider(&self, id: &str) -> Result<()>;
    pub async fn update_provider(&self, id: &str, updates: ProviderUpdate) -> Result<Provider>;
    pub async fn set_default(&self, id: &str) -> Result<()>;
    pub async fn get_default(&self) -> Result<Option<String>>;
    pub async fn set_enabled(&self, id: &str, enabled: bool) -> Result<()>;
    pub async fn check_status(&self, id: &str) -> Result<ProviderStatus>;
}
```

### ModelManager

```rust
// crates/viben-core/src/models/mod.rs

pub struct ModelManager {
    config_path: PathBuf,
}

impl ModelManager {
    pub fn new() -> Self;

    // Models
    pub fn list_known_models(&self) -> Vec<KnownModel>;
    pub async fn get_default(&self) -> Result<Option<String>>;
    pub async fn set_default(&self, model: &str) -> Result<()>;

    // Aliases
    pub async fn get_aliases(&self) -> Result<HashMap<String, String>>;
    pub async fn create_alias(&self, alias: &str, model: &str) -> Result<()>;
    pub async fn remove_alias(&self, alias: &str) -> Result<()>;
    pub fn resolve_alias(&self, alias_or_model: &str) -> String;

    // Fallbacks
    pub async fn get_fallbacks(&self) -> Result<Vec<String>>;
    pub async fn add_fallback(&self, model: &str) -> Result<()>;
    pub async fn remove_fallback(&self, model: &str) -> Result<()>;
    pub async fn set_fallbacks(&self, fallbacks: Vec<String>) -> Result<()>;
}
```

---

## Types

### Serde Types

```rust
// crates/viben-core/src/agents/types.rs

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAgentOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_template: Option<String>,
}
```

---

## Implementation Status

### Phase 1: Create viben-core Crate ✅

- [x] 创建 `crates/viben-core/` 目录结构
- [x] 实现配置文件读写 (YAML/JSON) - `config/yaml.rs`
- [x] 实现路径工具 - `config/paths.rs`
- [x] 实现 ConfigManager - `config/mod.rs`
- [x] 实现 AgentManager - `agents/mod.rs` (CRUD + templates + sessions + memory)
- [x] 实现 ProviderManager - `providers/mod.rs` (CRUD + enable/disable + test)
- [x] 实现 ModelManager - `models/mod.rs` (CRUD + known models)
- [x] Error types - `error.rs` (thiserror)
- [ ] 单元测试 (下一步)

### Phase 2: Integrate with Desktop ✅

- [x] 添加 viben-core 为 Desktop 后端依赖
- [x] 创建 37 个 Tauri commands
- [x] 启动时调用 `viben_core::initialize()`
- [ ] 创建 Frontend hooks 调用 Tauri commands
- [ ] 更新 Settings 页面使用新 hooks

### Phase 3: Create Rust CLI ✅

- [x] 创建 `crates/viben-cli/` Rust CLI
- [x] 使用 clap 实现命令行接口
- [x] 实现 agent/provider/model 命令
- [x] 支持 `--json` 输出格式

### Phase 4: Testing & Polish (进行中)

- [ ] viben-core 单元测试 (100% 覆盖率目标)
- [ ] 测试 CLI 和 Desktop 的配置同步
- [ ] 测试 Provider 连通性检查
- [ ] 测试 Agent 创建/删除流程
- [ ] UI 完善和错误处理

---

## Migration Notes

### From TypeScript @viben/core

原有的 TypeScript `@viben/core` 包将被废弃：

1. 删除 `packages/core/` 目录
2. 更新 Desktop 使用 Tauri invoke 而非直接导入
3. CLI 可选择保留 TypeScript 或迁移到 Rust

### TypeScript Type Definitions

为 Desktop 前端提供类型定义：

```typescript
// apps/desktop/src/types/viben-core.ts
// 从 Rust 类型生成或手动维护

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

## Acceptance Criteria

### viben-core Crate

- [x] 配置文件读写正常 (YAML)
- [x] AgentManager 实现完整
- [x] ProviderManager 实现完整
- [x] ModelManager 实现完整
- [ ] 单元测试覆盖 (100% 目标)

### Desktop Integration

- [x] Tauri commands 正常工作 (37 个)
- [ ] Agents 页面功能正常
- [ ] Providers 设置页面正常
- [ ] Models 设置页面正常
- [ ] i18n 支持 (EN/ZH-CN)

### CLI + Desktop 协同

- [x] CLI 和 Desktop 共享 viben-core
- [x] 配置文件格式完全兼容 (~/.viben/)
- [ ] Desktop 修改配置后 CLI 能读取 (需要测试)
- [ ] CLI 修改配置后 Desktop 能读取 (需要测试)

---

## Related Documents

- [CLI Application Specification](./cli-app.md) - CLI 完整规范
- [Desktop Integration](./desktop-integration.md) - 原有 Desktop 集成规范
- [Workspace Management](./workspace-management.md) - 工作区管理规范
