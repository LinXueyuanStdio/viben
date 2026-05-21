# Guidelines

生成 spec 时使用中文

## Core Architecture

- **packages/core 是所有前端应用 (apps/*) 使用底层能力的唯一边界**，需完整实现所有功能，CLI 作为 MVP 验证入口，命令为 `viben`。
- **Provider/Model 等配置使用 file-native 范式 (YAML)**，不使用数据库，配置存储在 `~/.viben/` 目录。

## CLI 基础设施

### viben task - 任务管理

开发任务的工作流管理系统，存储在 `.viben/tasks/` 目录。

- 状态机: `backlog → queue → in_progress → review → completed`
- 核心命令: `create`, `enqueue`, `start`, `finish`, `archive`
- 文档: `docs/specs/modules/cli/task.md`

### viben queue - 命令队列

通用的后台命令执行系统，存储在 `~/.viben/queue/`。

- 特性: 并发控制、detached 进程、Gateway 重启恢复
- 核心命令: `enqueue`, `status`, `list`, `cancel`, `logs`
- 文档: `docs/specs/modules/cli/queue.md`

### Task + Queue 集成

`viben task enqueue <task>` 会将 `viben task start <task>` 提交到 Queue 系统执行。

**关键设计**: Queue 系统对 Task 系统**零知识**，只负责执行 shell 命令。

详见: `docs/specs/modules/cli/task-queue-integration.md`

## API Naming Convention

**IMPORTANT**: All Gateway API query parameters and File storage (e.g., YAML configuration files, markdown files, task.json) use **snake_case** format:
- Use `workspace_path` NOT `workspacePath`
- Use `include_global` NOT `includeGlobal`
- Use `session_id` NOT `sessionId` (in query params)

This ensures consistency between frontend (gateway client) and backend (gateway routes).

## TypeScript Import Style

**FORBIDDEN**: Never use inline import type syntax like `import("path").TypeName`. This is ugly and hard to read.

```typescript
// ❌ BAD - Never do this
function foo(): import("../../reward/ops/types").RewardConfig { }
type Bar = import("../types").SomeType;

// ✅ GOOD - Use explicit import statements
import type { RewardConfig } from "../../reward/ops/types";
import type { SomeType } from "../types";

function foo(): RewardConfig { }
type Bar = SomeType;
```

Always use explicit `import type { ... } from "..."` statements at the top of the file.

**FORBIDDEN**: Never use dynamic imports with `= await import()`. Use static imports instead.

```typescript
// ❌ BAD - Never do this
const module = await import("./some-module");
const { foo } = await import("./utils");

// ✅ GOOD - Use static imports
import { foo } from "./utils";
import * as module from "./some-module";
```

Dynamic imports make code harder to analyze and tree-shake. Use static imports for all module dependencies.

**Exceptions** (dynamic imports allowed):
- `initializeCore()` in `packages/core/src/index.ts` - requires lazy loading to avoid circular dependencies
- Optional dependencies (fastify, @fastify/*, cloudflared, node-notifier, @larksuiteoapi/node-sdk)
- Test files for mocking and isolation

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
| token | 词元 | Not "令牌" |

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

## Tailwind v4 注意事项

项目使用 **Tailwind v4**（`@import "tailwindcss"`，非 v3 的 `@tailwind` 指令）。

**`data-[state=active]:` 等任意 data 属性变体在 CVA 中不可靠**：自定义组件（如 `tabs.tsx`）通过 CVA 数组定义的 `data-[state=active]:border-primary` 类可能无法被 Tailwind v4 正确扫描生成 CSS，或生成后优先级不足以覆盖同层基础类（如 `border-transparent`）。

```tsx
// ❌ 不可靠 - CVA 中的 data-* 变体可能不生效
const variants = cva([...], {
  variants: {
    default: ["border-transparent", "data-[state=active]:border-primary"]
  }
});

// ✅ 可靠 - 通过 className 条件性传入，twMerge 会正确覆盖 CVA 中的基础类
<TabsTrigger
  value="gallery"
  className={cn("px-3 py-2", activeTab === "gallery" && "border-primary text-foreground")}
/>
```

**FORBIDDEN**: 不要用 `hsl()` 包裹 oklch 格式的 CSS 变量。项目的语义色彩变量（`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar`, `--surface` 等）均为 **oklch** 格式。`hsl(oklch(...))` 是无效 CSS，浏览器会渲染为透明色。

```css
/* ❌ BAD - oklch 值被 hsl() 包裹，结果为透明 */
background: hsl(var(--background));
color: hsl(var(--foreground));
border: 1px solid hsl(var(--border));
box-shadow: 0 0 0 4px hsl(var(--primary) / 0.5);

/* ✅ GOOD - 直接使用变量 */
background: var(--background);
color: var(--foreground);
border: 1px solid var(--border);
box-shadow: 0 0 0 4px color-mix(in oklch, var(--primary) 50%, transparent);

/* ✅ GOOD - 在 Tailwind 类中使用 */
className="bg-popover text-foreground border-border"
```

**例外**: `--info`, `--warning`, `--error`, `--success` 及 `--cyan-500` 等 Kanban 颜色变量是 HSL 分量格式（如 `210 70% 50%`），可以用 `hsl(var(--info))`。

## Desktop App Development

### Restart Desktop App

When the desktop app hangs or port 1549 is occupied, use the restart script:

```bash
pnpm desktop:restart
```

This script will:
1. Kill processes on port 1549 (Vite dev server)
2. Kill all Tauri, Vite, and viben-desktop processes
3. Verify port 1549 is free
4. Start Tauri dev server

The script is located at `scripts/restart-desktop.sh`.

### Restart Gateway

When you need to restart the Viben Gateway (after modifying packages/core):

```bash
pnpm gateway:restart
```

The gateway runs on port **18790** by default.

API endpoints:
- Health: `http://127.0.0.1:18790/health`
- Agents: `http://127.0.0.1:18790/api/agent`
- Cron: `http://127.0.0.1:18790/api/cron`
- Sessions: `http://127.0.0.1:18790/api/sessions`

The script is located at `scripts/restart-gateway.sh`.
