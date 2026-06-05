# Proposal: Plugin Bridge — Universal Plugin Runtime for AI Coding Agents

## Status

**Proposal** — this document describes a vision for making Viben the universal runtime that can consume plugins from any AI coding agent ecosystem (Claude Code, Codex, Cursor, Gemini CLI, OpenCode) and serve them to any agent. It is not a spec and not ready for implementation. Feedback and discussion are welcome.

## The Problem

### Plugin Fragmentation Across AI Agent Ecosystems

The AI coding agent market has exploded, and each agent has built its own plugin/extension system:

| Agent | Plugins | Marketplace | Launch |
|---|---|---|---|
| **Claude Code** | 133 (catalog), 180 (tracked) | Curated, centralized | ~2025 |
| **Codex (OpenAI)** | ~35 curated + 400K+ community | Official + open | 03/2026 |
| **Cursor** | 50-80+ | Curated marketplace | 02/2026 |
| **Gemini CLI** | 761+ | Open gallery | 10/2025 |
| **OpenCode** | 50+ | No official marketplace | — |

**Total: ~1,000+ unique plugins across 5 ecosystems.**

The problem is threefold:

1. **For plugin authors**: Writing a plugin that works everywhere requires maintaining 5 different manifests, adapting to 5 different hook systems, and mapping 5 different tool names. The superpowers plugin is a prime example — it ships with `.claude-plugin/`, `.cursor-plugin/`, `.opencode/`, `.codex/` directories, each with platform-specific code.

2. **For users**: Skills installed on Claude Code don't work on Codex. Extensions from Gemini CLI don't work on Cursor. Users are locked into one ecosystem or must manually install the same plugin multiple times.

3. **For Viben**: As a platform that already bridges multiple agents to messaging platforms, Viben is uniquely positioned to also bridge the plugin ecosystem — but currently has no mechanism to leverage any of these existing plugins.

### The Convergence Nobody Is Exploiting

Despite the fragmentation, all 5 ecosystems have **converged on remarkably similar formats**:

- **Skills**: ALL use `SKILL.md` with YAML frontmatter (name + description)
- **Agents**: ALL use markdown files with YAML frontmatter (name, description, model, tools)
- **Commands**: ALL use markdown files with YAML frontmatter
- **Hooks**: ALL have lifecycle event systems (different names, same concepts)
- **MCP**: Emerging as the standard protocol for tool integration across all agents

The content is agent-agnostic — skills are prompt instructions that work on any LLM. The only differences are:
- How plugins are **discovered** (scan dirs, manifests, symlinks, npm)
- How plugins are **loaded** (lazy, eager, on-demand)
- What **tool names** are used (`Read` vs `read_file` vs `replace`)
- What **hook events** are called (`PreToolUse` vs `BeforeTool` vs `tool.execute.before`)

**Nobody is building the bridge.** Each ecosystem is a silo. Viben can be the first to break these walls.

---

## Vision

Build a **Plugin Bridge** inside Viben that:

1. **Reads plugins from any ecosystem** — scan Claude's cache, Codex's skills dir, Gemini's extensions, OpenCode's plugins, Cursor's skills
2. **Normalizes them** into a unified internal format
3. **Serves them to any agent** via Viben's existing middleware system (`agent:beforePrompt`, `registerCommand`, etc.)
4. **Translates tool names** automatically based on the target agent
5. **Maps hook events** from source format to Viben middleware hooks

The result: install a plugin once → it works on every agent Viben manages.

### Why This Matters

- **For Viben users**: Instant access to ~1,000+ plugins across all ecosystems without manual per-agent setup
- **For plugin authors**: Write once in any format → Viben distributes to all agents
- **For Viben itself**: Becomes the "universal plugin runtime" — a unique competitive position that no other platform occupies
- **For the ecosystem**: Reduces fragmentation by creating a de facto interoperability layer

---

## Market Analysis

### Claude Code — "Curated Walled Garden"

- **133 plugins** in official catalog, ~2.72M total installs
- Single centralized marketplace managed by Anthropic (PR-based submission)
- Plugin format is the most complete: skills + hooks + commands + agents + MCP
- Extremely long-tail distribution: 9 plugins hold 57% of installs, 63% of plugins have only 1 install
- Architecture supports multi-marketplace (federated) but currently only has one
- Top plugins: frontend-design (324K), superpowers (182K), context7 (169K), code-review (149K)

### Codex (OpenAI) — "Open Standard, Fragmented Discovery"

- ~35 official curated skills in `openai/skills` repo
- Plugin Marketplace launched 03/2026 with 20+ official plugins (Slack, Figma, Notion, Sentry)
- Community ecosystem is massive: SkillsMP indexes 400K+ skills (cross-agent)
- Vercel skills got 20K installs in first 6 hours — shows strong demand
- `SKILL.md` format is becoming the de facto cross-agent standard
- Distribution: GitHub repos + npm, discovery is fragmented across awesome-lists and community sites

### Cursor — "Enterprise-Ready Marketplace"

- 50-80+ plugins in official marketplace (launched 02/2026)
- Strong enterprise features: team marketplaces, admin controls, SCIM sync
- Unique dual-layer: VS Code extensions (Open VSX) + AI-native plugins (skills + subagents + MCP + hooks)
- Major partners: AWS, Figma, Linear, Stripe, Cloudflare, Vercel, Databricks, Snowflake
- Active community rules ecosystem: cursor.directory, awesome-cursorrules (100+ rules)

### Gemini CLI — "Biggest Open Ecosystem"

- **761+ extensions** — largest ecosystem by count
- Open model: anyone can publish without approval (Google does not vet third-party extensions)
- Extension gallery at geminicli.com/extensions, sorted by GitHub stars
- 101K GitHub stars on main repo — most popular CLI AI tool
- 40 repos in official `gemini-cli-extensions` org
- Major partners: Figma, Snyk, Stripe, Shopify, Dynatrace, MongoDB, Firebase, Flutter

### OpenCode — "Developer-First, No Marketplace"

- 50+ plugins tracked in community-curated awesome-opencode
- No official marketplace (community has requested one in issue #3087)
- Most flexible plugin system: JS/TS modules with ~20+ event hooks
- Distribution via npm (`opencode-*` packages) + local files
- Built by SST team, plugin SDK at v1.4.3 with 736 npm dependents

---

## Reference Standard: Claude Code

All ecosystems have converged on similar patterns, but they differ in naming, structure, and completeness. Rather than inventing a new neutral standard, **Plugin Bridge uses Claude Code as the canonical reference** and translates everything else to/from it.

### Why Claude Code?

1. **Most complete plugin format** — Claude is the only ecosystem that bundles all 5 component types (skills, hooks, commands, agents, MCP) in a single plugin. Other ecosystems support subsets:
   - Codex: skills only (no hooks, no commands, no agents in plugin format)
   - Gemini: skills + MCP (hooks via settings, not bundled in extensions)
   - Cursor: skills + agents + hooks + rules (no MCP in plugin bundle)
   - OpenCode: skills + commands (hooks are JS code, not declarative)

2. **Most comprehensive hook system** — 9 distinct hook events covering the full agent lifecycle. Other agents have 1-5 events.

3. **Highest quality ecosystem** — curated marketplace with manual review means plugins are reliable and well-structured. Gemini has 761+ extensions but no quality gate.

4. **Viben already deeply integrated** — session handoff, hook injection, and command integration with Claude Code are production-ready.

5. **Naming is clearest** — `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop` are self-documenting. Compare with OpenCode's `tool.execute.before` or Gemini's `BeforeTool`.

### What "Reference Standard" Means in Practice

**Plugin structure:** The internal `BridgedPlugin` schema mirrors Claude's plugin layout (`skills/`, `agents/`, `commands/`, `hooks/`). Plugins from other ecosystems are mapped into this structure.

**Tool names:** Claude tool names (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `TodoWrite`, `Agent`, `WebSearch`) are the canonical names used internally. Translation happens at the boundary when injecting into a non-Claude agent.

**Hook events:** Claude hook event names are the canonical names in `BridgedHook.event`. The mapper translates from/to platform-specific names:

| Canonical (Claude) | Gemini | Cursor | OpenCode | Cline |
|---|---|---|---|---|
| `SessionStart` | `SessionStart` | `sessionStart` | `event(session.created)` | `TaskStart` |
| `UserPromptSubmit` | `BeforeAgent` | `beforeSubmitPrompt` | `chat.message` | — |
| `PreToolUse` | `BeforeTool` | — | `tool.execute.before` | — |
| `PostToolUse` | `AfterTool` | — | `tool.execute.after` | — |
| `Stop` | — | — | — | — |
| `SubagentStop` | — | — | — | — |
| `PreCompact` | `PreCompress` | — | `event(session.compacted)` | — |
| `Notification` | `Notification` | — | — | — |
| `SessionEnd` | `SessionEnd` | — | `event(server.instance.disposed)` | — |

**Hook I/O format:** Claude's JSON input + plaintext/JSON output format is the internal standard. Hooks from other ecosystems are adapted to match.

### Required Viben Hook Additions

To fully support Claude's hook system as the reference standard, Viben needs 7 new middleware hooks. These close the gaps between Viben's current 19 hooks and the 9 Claude hook events:

| New Hook | Type | Maps Claude Event | Purpose |
|---|---|---|---|
| `tool:beforeUse` | modifiable, can block | `PreToolUse` | Intercept before agent uses a tool — security checks, input validation, audit |
| `tool:afterUse` | read-only | `PostToolUse` | Observe tool results — logging, cost tracking, post-validation |
| `agent:beforeStop` | modifiable, can block | `Stop` | Intercept agent's decision to stop — quality gates, verification checks |
| `session:afterCreate` | read-only | `SessionStart` | React after session is ready — inject initial context, start tracking |
| `session:beforeDestroy` | modifiable, can block | `SessionEnd` | Intercept before session ends — save state, cleanup, confirmation |
| `context:beforeCompact` | modifiable | `PreCompact` | Preserve critical context before compression — pin important messages |
| `fs:afterWrite` | read-only | (OpenCode `file.edited`) | Track file changes — git auto-commit, live reload, change notifications |

After adding these, Viben will have **26 middleware hooks** with **100% coverage of all Claude hook events**. This means every Claude plugin hook can be mapped to a native Viben middleware hook without lossy translation.

**Priority for implementation:** `tool:beforeUse` and `tool:afterUse` first — they are the most commonly used hooks across all ecosystems and are prerequisites for Plugin Bridge Phase 3.

---

## Technical Design

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        @viben/plugin-bridge                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Source Scanners                          │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │ │
│  │  │ Claude   │ │ Codex    │ │ Gemini   │ │ Cursor /      │ │ │
│  │  │ Scanner  │ │ Scanner  │ │ Scanner  │ │ OpenCode      │ │ │
│  │  │          │ │          │ │          │ │ Scanner       │ │ │
│  │  │ ~/.claude│ │ ~/.agents│ │ geminicli│ │ ~/.cursor     │ │ │
│  │  │ /plugins │ │ /skills  │ │ .com/ext │ │ /skills       │ │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘ │ │
│  │       └─────────────┴─────────┬──┴──────────────┘          │ │
│  └───────────────────────────────┼────────────────────────────┘ │
│                                  ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Unified Plugin Index                       │ │
│  │                                                              │ │
│  │  BridgedPlugin {                                             │ │
│  │    source: "claude" | "codex" | "gemini" | "cursor" | ...   │ │
│  │    skills: BridgedSkill[]                                    │ │
│  │    commands: BridgedCommand[]                                │ │
│  │    agents: BridgedAgent[]                                    │ │
│  │    hooks: BridgedHook[]                                      │ │
│  │    mcp: McpServerConfig[]                                    │ │
│  │  }                                                           │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐ │
│  │                   Adapter Layer                              │ │
│  │                                                              │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │ │
│  │  │ Skill Injector │  │ Command        │  │ Hook Event   │  │ │
│  │  │                │  │ Registrar      │  │ Mapper       │  │ │
│  │  │ beforePrompt   │  │ registerCmd()  │  │ Claude→OACP  │  │ │
│  │  │ middleware      │  │                │  │ middleware   │  │ │
│  │  └────────────────┘  └────────────────┘  └──────────────┘  │ │
│  │  ┌────────────────┐  ┌────────────────┐                    │ │
│  │  │ Agent Profile  │  │ Tool Name      │                    │ │
│  │  │ Creator        │  │ Translator     │                    │ │
│  │  │                │  │                │                    │ │
│  │  │ markdown→agent │  │ Read→read_file │                    │ │
│  │  └────────────────┘  └────────────────┘                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│                    Viben Plugin API                             │
│            (agent:beforePrompt, registerCommand,                  │
│             registerMiddleware, registerService)                  │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Claude  │   │  Codex   │   │  Gemini  │
        │  Agent   │   │  Agent   │   │  Agent   │
        │          │   │          │   │          │
        │ (skills  │   │ (skills  │   │ (skills  │
        │  injected│   │  injected│   │  injected│
        │  + tools │   │  + tools │   │  + tools │
        │  mapped) │   │  mapped) │   │  mapped) │
        └──────────┘   └──────────┘   └──────────┘
```

### Component Breakdown

#### 1. Source Scanners

Each scanner knows how to read one ecosystem's plugin format:

**Claude Scanner:**
- Path: `~/.claude/plugins/cache/*/`
- Reads: `.claude-plugin/plugin.json` manifest → discovers `skills/`, `agents/`, `commands/`, `hooks/` directories
- Parses: `SKILL.md` frontmatter, `hooks.json`, agent/command markdown files

**Codex Scanner:**
- Path: `~/.agents/skills/`, `~/.codex/skills/`
- Reads: `SKILL.md` files directly (flat directory structure)
- Lock file: `~/.agents/.skill-lock.json` for installed skill metadata

**Gemini Scanner:**
- Path: Gemini extension directories
- Reads: Extension manifests, `SKILL.md` files, agent definitions
- Also reads: `.gemini/settings.json` for MCP server configs

**Cursor Scanner:**
- Path: `~/.cursor/skills-cursor/`, Cursor plugin cache
- Reads: `.cursor-plugin/plugin.json` manifest, `.mdc` rule files
- Also reads: `hooks-cursor.json` for hook definitions

**OpenCode Scanner:**
- Path: `~/.config/opencode/plugins/`, `~/.config/opencode/skills/`
- Reads: JS/TS plugin files (extract metadata only), `SKILL.md` files, command markdown

#### 2. Unified Plugin Index

All scanned plugins are normalized into a common internal format:

```typescript
interface BridgedPlugin {
  id: string;                          // e.g., "claude:superpowers"
  source: PluginSource;                // "claude" | "codex" | "gemini" | "cursor" | "opencode"
  name: string;                        // human-readable name
  version: string;
  sourcePath: string;                  // filesystem path to original plugin
  skills: BridgedSkill[];
  commands: BridgedCommand[];
  agents: BridgedAgent[];
  hooks: BridgedHook[];
  mcpServers: McpServerConfig[];
}

interface BridgedSkill {
  name: string;                        // from SKILL.md frontmatter
  description: string;                 // trigger description
  contentPath: string;                 // path to SKILL.md
  content?: string;                    // lazy-loaded full content
  references: string[];                // paths to supporting files
}

interface BridgedCommand {
  name: string;
  description: string;
  contentPath: string;
  allowedTools?: string[];             // tool whitelist (will be translated)
  modelOverride?: string;
}

interface BridgedAgent {
  name: string;
  description: string;
  contentPath: string;
  model?: string;
  tools?: string[];
}

interface BridgedHook {
  event: NormalizedHookEvent;          // normalized from platform-specific names
  type: "command" | "prompt";
  matcher?: string;
  command?: string;                    // for command-type hooks
  prompt?: string;                     // for prompt-type hooks
}
```

The index is **lazy**: only frontmatter (name + description) is loaded at boot. Full skill content is loaded on demand when a skill is activated. This keeps memory usage minimal regardless of how many plugins are indexed.

#### 3. Tool Name Translator

When injecting skill content into a prompt, tool references are automatically translated based on the target agent:

```typescript
const TOOL_MAP: Record<string, Record<AgentType, string>> = {
  "Read":      { claude: "Read",  codex: "Read",  gemini: "read_file",         opencode: "Read",      cursor: "Read" },
  "Write":     { claude: "Write", codex: "Write", gemini: "write_file",        opencode: "Write",     cursor: "Write" },
  "Edit":      { claude: "Edit",  codex: "Edit",  gemini: "replace",           opencode: "Edit",      cursor: "Edit" },
  "Bash":      { claude: "Bash",  codex: "Bash",  gemini: "run_shell_command", opencode: "Bash",      cursor: "Bash" },
  "Grep":      { claude: "Grep",  codex: "Grep",  gemini: "grep_search",       opencode: "Grep",      cursor: "Grep" },
  "Glob":      { claude: "Glob",  codex: "Glob",  gemini: "glob",              opencode: "Glob",      cursor: "Glob" },
  "TodoWrite": { claude: "TodoWrite", codex: "TodoWrite", gemini: "write_todos", opencode: "todowrite", cursor: "TodoWrite" },
  "Agent":     { claude: "Agent", codex: "Agent",  gemini: "N/A",              opencode: "@mention",  cursor: "Agent" },
  "WebSearch": { claude: "WebSearch", codex: "WebSearch", gemini: "google_web_search", opencode: "WebSearch", cursor: "WebSearch" },
};
```

The translator does a simple string replacement pass over skill content before injection. It is conservative — only replaces known tool name patterns (backtick-wrapped or in tool invocation contexts) to avoid false positives.

#### 4. Hook Event Mapper

Uses Claude hook events as canonical names (see "Reference Standard" section above). Maps platform-specific events to their Claude equivalent, then to Viben middleware hooks:

| Canonical (Claude) | Viben Middleware | Status |
|---|---|---|
| `SessionStart` | `session:afterCreate` | **New hook needed** |
| `UserPromptSubmit` | `agent:beforePrompt` | Exists |
| `PreToolUse` | `tool:beforeUse` | **New hook needed** |
| `PostToolUse` | `tool:afterUse` | **New hook needed** |
| `Stop` | `agent:beforeStop` | **New hook needed** |
| `SubagentStop` | `agent:beforeStop` (with subagent flag) | **New hook needed** |
| `PreCompact` | `context:beforeCompact` | **New hook needed** |
| `Notification` | `message:outgoing` (filtered) | Exists (approximate) |
| `SessionEnd` | `session:beforeDestroy` | **New hook needed** |

With the 7 proposed new hooks, all 9 Claude hook events have direct 1:1 mappings to Viben middleware hooks. No lossy translation needed.

Only `command`-type hooks can be bridged directly (execute script, return output). `prompt`-type hooks require an LLM call, which adds latency and cost — these are bridged as optional and disabled by default.

#### 5. Skill Injector (agent:beforePrompt middleware)

The core mechanism: intercept prompts before they reach the agent and inject relevant skill content.

**Activation modes:**

- **Explicit**: User invokes `/skill <name>` or `/bridge <name>` → inject full skill content
- **Auto-match** (optional): Parse user prompt → match against skill descriptions → inject if confidence is high. Disabled by default to avoid unwanted context injection.
- **Session-persistent**: Once a skill is activated in a session, it stays active for the session duration (like Claude Code's behavior)

**Injection strategy:**

Skills are injected as a system-level prefix in the prompt, wrapped in clear delimiters:

```
<bridged-skill source="claude:superpowers" name="test-driven-development">
[translated skill content here]
</bridged-skill>
```

This ensures the agent knows the context is external and can reference it naturally.

#### 6. Command Registrar

Bridged commands are registered as Viben commands via `ctx.registerCommand()`:

- Claude/Cursor commands (markdown with frontmatter) → parse and register
- Command arguments are passed through
- `allowed-tools` field is translated using the Tool Name Translator
- Commands appear in `/help` output with `[bridged]` prefix for clarity

#### 7. Agent Profile Creator

Bridged agent definitions are made available as selectable agent profiles:

- Agent markdown files are parsed for metadata (name, description, model, tools)
- Registered as agent configurations that can be spawned via Viben's session system
- Tool lists are translated for the target agent

---

## Implementation Phases

### Phase 1: Skills + Commands (High Value, Low Effort)

**Scope:** Read skills and commands from Claude plugin cache → inject into prompts → translate tool names

**Why first:**
- Skills and commands are the simplest format (just markdown files)
- They provide ~80% of the value (most plugins are skill-heavy)
- Claude's ecosystem (133 plugins) is immediately available
- No complex hook mapping needed

**Deliverables:**
- Claude Source Scanner
- Unified Plugin Index (skills + commands only)
- Tool Name Translator
- Skill Injector middleware
- Command Registrar
- `/skill list` and `/skill <name>` commands
- Estimated effort: ~500-800 lines of core logic

### Phase 2: Multi-Source + Agents

**Scope:** Add scanners for Codex, Gemini, Cursor, OpenCode + agent profile support

**Why second:**
- Expands coverage from 133 → ~1,000+ plugins
- Agent profiles add a new capability (specialized sub-agents from any ecosystem)
- Each scanner is relatively simple (same SKILL.md format, different paths)

**Deliverables:**
- Codex, Gemini, Cursor, OpenCode scanners
- Agent Profile Creator
- Cross-source deduplication (same plugin in multiple ecosystems)
- Estimated effort: ~400-600 lines per scanner

### Phase 3: Hook Bridge

**Scope:** Map platform-specific hooks to Viben middleware

**Why third:**
- Hooks are the most complex component (different event names, I/O formats, execution models)
- Command-type hooks need script execution sandboxing
- Prompt-type hooks need LLM calls (cost/latency implications)
- Value is moderate — most plugin value is in skills, not hooks

**Deliverables:**
- Hook Event Mapper
- Command-hook executor (sandboxed script runner)
- Prompt-hook adapter (optional, disabled by default)
- Estimated effort: ~600-1000 lines

### Phase 4: MCP Passthrough + Marketplace

**Scope:** Forward MCP server configs from bridged plugins + build discovery UI

**Deliverables:**
- MCP config aggregator (merge `.mcp.json` from all sources)
- Plugin discovery UI (list available plugins from all ecosystems)
- Optional: Viben marketplace that aggregates from Claude, Gemini, Codex marketplaces
- Estimated effort: varies significantly

---

## How It Fits Into Viben

Plugin Bridge is an **Viben plugin** (`@viben/plugin-bridge`), not a core modification. It uses the standard plugin API:

```typescript
const pluginBridge: VibenPlugin = {
  name: "@viben/plugin-bridge",
  version: "1.0.0",
  description: "Bridges plugins from Claude Code, Codex, Cursor, Gemini CLI, and OpenCode into Viben",
  permissions: [
    "middleware:register",    // for agent:beforePrompt injection
    "commands:register",      // for /skill command and bridged commands
    "services:register",      // for PluginBridgeService
    "storage:read",           // for caching index
    "storage:write",          // for persisting index
  ],

  async setup(ctx) {
    // 1. Scan all sources and build index
    const index = await scanAllSources();

    // 2. Register skill injection middleware
    ctx.registerMiddleware(Hook.AGENT_BEFORE_PROMPT, {
      priority: 50,  // early, before other middleware
      handler: createSkillInjector(index, ctx),
    });

    // 3. Register bridged commands
    for (const plugin of index.plugins) {
      for (const cmd of plugin.commands) {
        ctx.registerCommand(adaptCommand(cmd));
      }
    }

    // 4. Register management commands
    ctx.registerCommand({ name: "skill", handler: skillCommandHandler });
    ctx.registerCommand({ name: "bridge", handler: bridgeCommandHandler });

    // 5. Expose service for other plugins
    ctx.registerService("plugin-bridge", createBridgeService(index));
  },
};
```

This means:
- **Zero core changes** — entirely additive
- **Optional** — users who don't want bridged plugins can simply not install it
- **Standard lifecycle** — boots with other plugins, respects permissions and error isolation
- **Composable** — other plugins can use `getService("plugin-bridge")` to query the index

---

## Key Design Decisions

### Why "Plugin Bridge" and not "Skill Bridge"?

The initial name candidate was "Skill Bridge" since skills are the primary value. However:

1. **Scope is broader than skills** — we bridge commands, agents, hooks, and MCP too
2. **"Plugin" is the established term** — Claude, Cursor, Codex, and Gemini all call their distribution units "plugins" or "extensions"
3. **Future-proof** — as ecosystems add new component types, the bridge can expand without a naming mismatch
4. **Clear mental model** — "Plugin Bridge" immediately communicates what it does: bridges plugins between ecosystems

### Why read from existing caches, not re-download?

The bridge reads plugins from where agents already store them (`~/.claude/plugins/cache/`, `~/.agents/skills/`, etc.) rather than downloading plugins independently. This means:

- **No duplication** — plugins are stored once, shared by the agent and Viben
- **Automatic updates** — when the agent updates a plugin, Viben sees it on next scan
- **No auth needed** — no marketplace API keys or tokens required
- **Parasitic by design** — Viben piggybacks on each agent's ecosystem without interfering

### Why lazy loading?

With 1,000+ potential plugins, loading all content at boot would be wasteful. The index stores only frontmatter (~100 bytes per skill). Full content (~5-50KB per skill) is loaded on demand. This keeps boot time and memory usage constant regardless of ecosystem size.

### Why Claude Code as the reference standard, not a neutral format?

We could invent a new "Viben Plugin Format" as a neutral standard. We chose not to because:

1. **Claude's format is already the most complete** — it has every component type we need. A neutral format would end up looking almost identical to Claude's anyway.
2. **Zero adoption barrier** — plugin authors who write for Claude automatically write for Viben. No new format to learn.
3. **Living standard** — as Claude evolves its plugin system, Viben inherits improvements automatically instead of maintaining a separate spec.
4. **Pragmatism over purity** — a neutral standard sounds elegant but adds complexity without value. The goal is interoperability, not standards-body politics.

Other ecosystems' plugins are "upconverted" to Claude format on scan. This is straightforward because Claude's format is a superset — every Codex skill, Gemini extension, or Cursor plugin maps cleanly into Claude's structure, but not vice versa.

### Why tool name translation, not a universal tool abstraction?

A universal tool layer would require each agent to implement a new protocol. Tool name translation is a simpler approach — just string replacement — that works without any changes to the agents themselves. It's pragmatic and immediately effective.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Breaking changes in agent plugin formats** | Scanners stop working | Version-check each scanner; graceful degradation (skip unparseable plugins) |
| **Context window pollution** | Too many skills injected → agent confusion | Lazy loading + explicit activation by default; auto-match is opt-in |
| **Tool name translation errors** | Wrong tool names in prompts → agent errors | Conservative regex matching; only translate known patterns; integration tests |
| **Performance at scale** | Slow boot with 1000+ plugins | Lazy loading + cached index (re-scan only on file change via mtime check) |
| **Security: malicious skill content** | Injected prompts could be adversarial | Content is already trusted by the source agent; Viben adds no new trust boundary |
| **License/legal concerns** | Redistributing plugin content | Bridge reads from local cache only — no redistribution; content stays on user's machine |

---

## Success Metrics

- **Phase 1**: User can run `/skill list` and see all Claude Code skills available; `/skill tdd` injects TDD workflow into any agent session
- **Phase 2**: Skills from 5 ecosystems visible in unified list; deduplication works (same plugin from Claude and Codex shows once)
- **Phase 3**: Hooks from superpowers SessionStart work on Viben session start
- **Phase 4**: User can browse available plugins across all ecosystems from a single interface

---

## Prior Art and Inspiration

- **Superpowers plugin** — already demonstrates multi-platform distribution with separate manifests for 5 platforms; Plugin Bridge automates what superpowers does manually
- **SkillsMP** — community platform indexing 400K+ skills across agents; validates the demand for cross-ecosystem discovery
- **MCP (Model Context Protocol)** — standardized tool integration; Plugin Bridge does for skills/prompts what MCP does for tools
- **Docker** — containers run anywhere because of a universal runtime; Plugin Bridge is "Docker for AI agent plugins"

---

## Open Questions

1. **Should auto-match be enabled by default?** Auto-detecting relevant skills adds value but risks context pollution. Current recommendation: off by default, opt-in per session.

2. **How to handle plugin conflicts?** If the same skill exists in Claude and Codex with different content, which takes priority? Options: source priority order (configurable), newest version, user choice.

3. **Should Viben host its own marketplace?** Phase 4 suggests aggregating from existing marketplaces. An alternative is building an Viben-native marketplace that becomes the canonical cross-agent plugin registry.

4. **MCP server lifecycle** — bridged MCP configs need server processes. Should Plugin Bridge manage these processes, or delegate to existing MCP infrastructure?

5. **Monetization angle** — could Viben charge for premium bridged plugins or enterprise multi-source access?
