# Claude Code Guidelines

生成 spec 时使用中文

## Core Architecture

- **packages/core 是所有前端应用 (apps/*) 使用底层能力的唯一边界**，需完整实现所有功能，CLI 作为 MVP 验证入口，命令为 `viben`。
- **Provider/Model 等配置使用 file-native 范式 (YAML)**，不使用数据库，配置存储在 `~/.viben/` 目录。

## Build Requirements

**IMPORTANT**: When making changes to the codebase, ensure all packages compile successfully:

- `apps/web` - Web application must compile without errors
- `apps/desktop` - Desktop application must compile without errors
- All workspace packages must build successfully

Always run `pnpm build` or `pnpm typecheck` to verify changes before committing.

## Database Migrations (apps/web)

When encountering database schema errors like "column X does not exist", run database migrations:

```bash
cd apps/web && pnpm db:push
```

This command requires **manual interaction** - it will prompt you to confirm schema changes.

Available drizzle-kit commands:
- `pnpm db:push` - Push schema changes to database (interactive)
- `pnpm db:generate` - Generate migration files
- `pnpm db:migrate` - Run migrations
- `pnpm db:studio` - Open Drizzle Studio for database inspection

Migration files are stored in: `apps/web/lib/db/migrations/`

## Translation Guidelines

When translating to Chinese (zh-CN):

| English | Chinese | Notes |
|---------|---------|-------|
| agent | 智能体 | Not "代理" |

## UI Components

### AI Model Icons

Use `@lobehub/icons` for AI model branding icons. See: https://github.com/lobehub/lobe-icons

```tsx
import Claude from "@lobehub/icons/es/Claude";
import Gemini from "@lobehub/icons/es/Gemini";
import OpenAI from "@lobehub/icons/es/OpenAI";

// Usage
<Claude.Color size={20} />  // Color variant (if available)
<OpenAI size={20} />        // Default Mono variant
```

Available icons with `.Color` variant: Claude, Gemini, Mistral, Meta, DeepSeek, Qwen, Cohere, HuggingFace

Icons without `.Color` (use default): OpenAI, Ollama, Groq, Anthropic

### Chat Input Components

- `ChatInput` - Simple chat input with attachment support (used in task panels, debug panels)
- `AgentChatInput` - Full-featured agent chat input with model selector, parameters, token usage (used in workspace chat)

## Rust Monorepo Development

### Target Directory Convention

**IMPORTANT**: This is a monorepo. All Rust crates should share a single `target` directory at the project root to avoid redundant compilation.

**Correct structure:**
```
viben/
├── Cargo.toml          # Root workspace (primary)
├── target/             # Single shared target directory
├── crates/
│   ├── viben-core/
│   └── viben-agent-organization/
└── apps/desktop/src-tauri/
    └── target/         # Tauri has its own target (excluded from workspace)
```

**Wrong structure** (causes duplicate compilation):
```
viben/
├── target/
├── crates/
│   ├── Cargo.toml      # ❌ Separate workspace - DELETE THIS
│   ├── target/         # ❌ Duplicate target - DELETE THIS
│   └── viben-core/
│       └── target/     # ❌ Duplicate target - DELETE THIS
```

### Building and Installing CLI

Always run Cargo commands from the **project root**:

```bash
# Build
cargo build -p viben-core

# Run
cargo run -p viben-core -- <args>

# Install CLI globally (for development testing)
cargo install --path crates/viben-core
```

**Never** run `cargo build` or `cargo install` from inside `crates/` subdirectories.

### Cleaning Up Duplicate Targets

If you find duplicate `target` directories:

```bash
# Remove duplicate targets (keep only root target/)
rm -rf crates/target crates/viben-core/target crates/*/target

# Also remove duplicate workspace files
rm -f crates/Cargo.toml crates/Cargo.lock
```

## Desktop App Development

### Restart Desktop App

When the desktop app hangs or port 1420 is occupied, use the restart script:

```bash
pnpm desktop:restart
```

This script will:
1. Kill processes on port 1420 (Vite dev server)
2. Kill all Tauri, Vite, and viben-desktop processes
3. Verify port 1420 is free
4. Start Tauri dev server

The script is located at `scripts/restart-desktop.sh`.

### Restart Gateway

When you need to restart the Viben Gateway (after modifying Rust backend code):

```bash
# Restart gateway (uses existing binary)
pnpm gateway:restart

# Rebuild and restart gateway
pnpm gateway:build
```

The gateway runs on port **18790** by default.

API endpoints:
- Health: `http://127.0.0.1:18790/health`
- Agents: `http://127.0.0.1:18790/api/agents`
- Cron: `http://127.0.0.1:18790/api/cron`
- Sessions: `http://127.0.0.1:18790/api/sessions`

The script is located at `scripts/restart-gateway.sh`.
