# Viben-Core Desktop Integration

> Local AI agent, provider, and model management for the desktop app via viben-core.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T-VIBEN-CORE |
| Dependencies | packages/core, crates/viben-core |
| Status | **In Progress** |
| Priority | P0 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Desktop Frontend (React)                      │
├─────────────────────────────────────────────────────────────────┤
│  use-viben-agents.ts  │  use-viben-providers.ts  │  use-viben-models.ts  │
│        ↓                       ↓                        ↓        │
│    invoke()                invoke()                 invoke()     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Tauri Commands (Rust)                         │
├─────────────────────────────────────────────────────────────────┤
│  viben_agents.rs      │  viben_providers.rs    │  viben_models.rs     │
│        ↓                       ↓                        ↓        │
│    AgentManager          ProviderManager          ModelManager   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Viben-Core (Rust Crate)                       │
├─────────────────────────────────────────────────────────────────┤
│  crates/viben-core/src/agents/  │  providers/  │  models/  │ config/ │
│        ↓                              ↓             ↓           ↓   │
│    ~/.viben/agents/           providers.yaml   models.yaml  config.yaml │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

### 1. Rust Crate (crates/viben-core) ✅ Complete

| Component | Status | File |
|-----------|--------|------|
| ConfigManager | ✅ | `src/config/mod.rs` |
| Path utilities | ✅ | `src/config/paths.rs` |
| YAML/JSON IO | ✅ | `src/config/yaml.rs` |
| AgentManager | ✅ | `src/agents/mod.rs` |
| Agent types | ✅ | `src/agents/types.rs` |
| ProviderManager | ✅ | `src/providers/mod.rs` |
| Provider types | ✅ | `src/providers/types.rs` |
| ModelManager | ✅ | `src/models/mod.rs` |
| Model types | ✅ | `src/models/types.rs` |
| Known models | ✅ | `src/models/known.rs` |
| Error types | ✅ | `src/error.rs` |

### 2. Tauri Commands ✅ Complete

| Command Group | Status | File |
|---------------|--------|------|
| Agent CRUD | ✅ | `viben_agents.rs` |
| Agent templates | ✅ | `viben_agents.rs` |
| Agent sessions | ✅ | `viben_agents.rs` |
| Agent memory | ✅ | `viben_agents.rs` |
| Provider CRUD | ✅ | `viben_providers.rs` |
| Provider enable/disable | ✅ | `viben_providers.rs` |
| Provider connection test | ✅ | `viben_providers.rs` |
| Model CRUD | ✅ | `viben_models.rs` |
| Model enable/disable | ✅ | `viben_models.rs` |
| Known models listing | ✅ | `viben_models.rs` |

### 3. Frontend Hooks ✅ Complete

| Hook | Status | File |
|------|--------|------|
| useVibenAgents | ✅ | `use-viben-agents.ts` |
| useVibenProviders | ✅ | `use-viben-providers.ts` |
| useVibenModels | ✅ | `use-viben-models.ts` |

### 4. Settings UI ✅ Complete

| Page | Status | File |
|------|--------|------|
| Settings Agents | ✅ | `settings-agents.tsx` |
| Settings Providers | ✅ | `settings-providers.tsx` |
| Settings Models | ✅ | `settings-models.tsx` |

### 5. Internationalization ✅ Complete

| Language | Status | File |
|----------|--------|------|
| English | ✅ | `en.json` |
| Chinese | ✅ | `zh-CN.json` |

---

## Data Storage

All viben-core data is stored in `~/.viben/`:

```
~/.viben/
├── config.yaml           # Global config (default agent, provider, model)
├── providers.yaml        # Provider configurations
├── models.yaml           # Custom models and disabled models list
├── agents/               # Agent directories
│   └── {agent-id}/
│       ├── config.yaml   # Agent configuration
│       ├── memory/       # Agent memory files
│       └── .agent_sessions/  # Session data
├── agent-templates/      # Saved agent templates
│   └── {template-id}/
│       └── config.yaml
├── mcp/                  # Shared MCP servers (future)
└── skills/               # Shared skills (future)
```

---

## Type Definitions

### Provider Types

```rust
// Rust (crates/viben-core/src/providers/types.rs)
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Azure,
    Ollama,
    OpenRouter,
    Custom,
}

pub struct Provider {
    pub id: String,
    pub provider_type: ProviderType,
    pub name: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub is_default: bool,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

```typescript
// TypeScript (apps/desktop/src/hooks/use-viben-providers.ts)
type ProviderType = "openai" | "anthropic" | "azure" | "ollama" | "openrouter" | "custom";

interface Provider {
  id: string;
  provider_type: ProviderType;
  name: string;
  api_key?: string;
  base_url?: string;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

### Agent Types

```rust
// Rust
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

---

## Remaining Work

### High Priority

- [ ] Fix provider creation bug (dialog not dismissing)
- [ ] Add error toast notifications for failed operations
- [ ] Add loading states during async operations

### Medium Priority

- [ ] MCP server management UI in settings
- [ ] Skills management UI in settings
- [ ] Connection testing with actual API calls

### Low Priority

- [ ] Import/export functionality for agents
- [ ] Bulk operations (delete multiple, enable/disable all)
- [ ] Agent memory viewer/editor

---

## Testing

### Manual Testing Checklist

- [ ] Create new provider
- [ ] Edit existing provider
- [ ] Delete provider
- [ ] Set default provider
- [ ] Enable/disable provider
- [ ] Test provider connection
- [ ] Create new agent
- [ ] Edit existing agent
- [ ] Delete agent
- [ ] Set default agent
- [ ] Save agent as template
- [ ] Create agent from template
- [ ] View/filter models
- [ ] Enable/disable models
- [ ] Set default model

---

## Notes

- The Rust `viben-core` crate is separate from the TypeScript `packages/core`
- TypeScript core is for Node.js environments (CLI, web)
- Rust crate is for desktop app via Tauri
- Both share similar APIs but are independent implementations
- Field names use `provider_type` (not `type`) for JSON compatibility
