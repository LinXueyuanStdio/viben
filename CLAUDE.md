# Claude Code Guidelines

生成 spec 时使用中文

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
