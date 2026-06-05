# Entire Context Resume — Design Spec

## Overview

Enable users to continue conversations from previous coding sessions by injecting conversation history from [Entire](https://entire.io) checkpoints into new Viben sessions. Users trigger this via `/resume` command on Telegram (assistant chat or topic), specifying a PR, branch, commit, or requesting latest sessions.

Entire stores full agent conversation transcripts (`full.jsonl`) on a git-native branch (`entire/checkpoints/v1`), capturing sessions from Claude Code, Cursor, Gemini, and other tools. Viben reads this data via `git show` — zero API dependency, zero infra.

## Goals

- Resume context from previous sessions across devices and tools (IDE → Telegram continuity)
- Support 4 entry points: PR number/URL, branch name, commit hash, latest N sessions
- Abstract `ContextProvider` interface so other providers can be added later
- Adaptive output mode (full/balanced/compact) based on total conversation size
- Token budget management with user choice when exceeding threshold

## Non-Goals

- Writing back to Entire (Viben sessions do NOT create checkpoints — read-only)
- Real-time sync with Entire (snapshot at `/resume` time only)
- Replacing ACP agent resume (`AgentInstance.resume()`) — that's a separate concern

## Architecture

```
ContextProvider (interface)
     ↑
EntireProvider (first implementation)
     ↑
ContextManager (registry of providers)
     ↑
VibenCore (holds contextManager)
     ↑
Adapter /resume command
```

### Module Structure

```
src/core/context/
  context-provider.ts      — Interface + shared types
  context-manager.ts       — Provider registry, provider selection
  entire/
    entire-provider.ts     — implements ContextProvider, orchestrates git → markdown
    checkpoint-reader.ts   — Git operations: list checkpoints, read metadata, extract JSONL
    conversation-builder.ts — JSONL → markdown: parse events, adaptive mode, merge sessions
    message-cleaner.ts     — System tag filtering, skill prompt detection, noise removal
```

### Interfaces

```typescript
// context-provider.ts

// NOTE: This interface is designed around Entire as the first provider.
// It may evolve when additional providers (Cursor history, Zed, etc.) are added.
// Providers may only support a subset of query types and should return empty results
// for unsupported types rather than throwing.

interface ContextProvider {
  name: string;
  // Called per /resume invocation (not cached — providers may appear/disappear)
  isAvailable(repoPath: string): Promise<boolean>;
  // Lightweight scan: metadata only, includes token estimate for budget check
  listSessions(query: ContextQuery): Promise<SessionListResult>;
  buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult>;
}

interface ContextQuery {
  repoPath: string;
  type: 'branch' | 'commit' | 'pr' | 'latest' | 'checkpoint' | 'session';
  value: string;  // branch name, commit hash, PR number/URL, count for 'latest',
                   // 12-hex checkpoint ID, or UUID session ID
}

interface ContextOptions {
  maxTokens?: number;  // default 30000
  limit?: number;      // max sessions to include (for user-chosen subset)
}

interface SessionListResult {
  sessions: SessionInfo[];
  estimatedTokens: number;  // rough estimate for budget check before full rebuild
}

interface SessionInfo {
  checkpointId: string;
  sessionIndex: string;
  transcriptPath: string;
  createdAt: string;
  endedAt: string;
  branch: string;
  agent: string;
  turnCount: number;
  filesTouched: string[];
}

interface ContextResult {
  markdown: string;
  tokenEstimate: number;
  sessionCount: number;
  totalTurns: number;
  mode: 'full' | 'balanced' | 'compact';
  truncated: boolean;
  timeRange: { start: string; end: string };
}
```

### ContextManager

```typescript
// context-manager.ts

class ContextManager {
  private providers: ContextProvider[] = [];

  register(provider: ContextProvider): void;
  async getProvider(repoPath: string): Promise<ContextProvider | null>;
  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult | null>;
}
```

Iterates registered providers, returns first where `isAvailable()` is true. Future providers (Cursor history, Zed Conversations, etc.) register the same way.

### Integration in VibenCore

```typescript
class VibenCore {
  contextManager: ContextManager;

  constructor() {
    this.contextManager = new ContextManager();
    this.contextManager.register(new EntireProvider());
  }

  // Convenience method for adapters — handles the full flow
  async createSessionWithContext(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    contextQuery: ContextQuery;
    contextOptions?: ContextOptions;
    createThread?: boolean;
  }): Promise<{ session: Session; contextResult: ContextResult | null }> {
    // 1. Build context (may return null if provider unavailable)
    const contextResult = await this.contextManager.buildContext(
      params.contextQuery,
      params.contextOptions,
    );

    // 2. Create session via existing pipeline
    const session = await this.createSession({
      channelId: params.channelId,
      agentName: params.agentName,
      workingDirectory: params.workingDirectory,
      createThread: params.createThread,
    });

    // 3. Inject context if available
    if (contextResult) {
      session.setContext(contextResult.markdown);
    }

    return { session, contextResult };
  }
}
```

Adapters call `core.createSessionWithContext()` — single method that combines context building + session creation. Adapters do NOT access `contextManager` directly.

**Thread creation:** Follow existing Telegram pattern — adapter creates topic BEFORE calling `core.createSessionWithContext()` to prevent race condition (per CLAUDE.md convention).

### Scope Notes

- **Discord/Slack adapters:** Out of scope for v1. Only Telegram implements `/resume` initially. Other adapters can add support later using the same `core.createSessionWithContext()` method.
- **Config changes:** None required for v1. All defaults are hardcoded (`maxTokens: 30000`, cache TTL: 1 hour). Config schema extension can be added later if users need customization.
- **Warmup interaction:** `Session.setContext()` sets `pendingContext` which survives warmup (warmup uses sentinel `\x00__warmup__` that bypasses normal `processPrompt` path). Context is only injected on the first real user prompt.

## Entire Provider: How It Resolves Entry Points

All 6 entry points converge to: **list of checkpoint IDs → session metadata → JSONL transcripts → rebuilt markdown**.

### By PR

```
git log --grep "Merge pull request #N" → merge commit
git log merge^2 --not merge^1 --format="%(trailers:key=Entire-Checkpoint,valueonly)"
→ list checkpoint IDs → sessions
```

### By Branch

```
git ls-tree -r origin/entire/checkpoints/v1 → all checkpoint metadata.json
→ filter by metadata.branch === branchName → sessions
```

### By Commit

```
git log -1 --format="%(trailers:key=Entire-Checkpoint,valueonly)" <hash>
→ checkpoint ID → sessions
```

### By Checkpoint ID

```
f634acf05138 → shard path: f6/34acf05138
→ git show metadata.json → all sessions in this checkpoint
```

Direct lookup, O(1). Checkpoint ID is the 12-hex value from commit trailers or entire.io dashboard.

### By Session ID

```
1d9503b8-0134-419a-a3a7-019b312dd12c
→ scan all session metadata.json files → match session_id field
→ return matching session(s)
```

UUID format. Requires scanning checkpoint metadata — slower than other lookups but still fast (metadata files are small JSON).

### Latest N

```
All checkpoint metadata → all sessions → sort by created_at desc → take N
```

## Conversation Rebuild Pipeline

### Step 1: Extract JSONL

```
git show origin/entire/checkpoints/v1:<shard>/<checkpoint>/N/full.jsonl
```

### Step 2: Parse Events

Each line is a JSON event. Relevant types:
- `user` — user messages (text, images, tool_results)
- `assistant` — agent responses (text, thinking, tool_use)

Other types (`progress`, `queue-operation`, `file-history-snapshot`, `system`) are skipped.

### Step 3: Clean User Messages

Strip system/IDE noise tags while preserving real user content:

**Tags stripped:**
- `<system-reminder>`, `<local-command-caveat>`, `<local-command-stdout>`
- `<command-name>`, `<command-message>`
- `<ide_selection>`, `<ide_opened_file>`, `<ide_context>`
- `<cursor_context>`, `<attached_files>`, `<repo_context>`
- `<task-notification>`, `<user-prompt-submit-hook>`

**Special handling:**
- `<command-args>` — content extracted as user input (this IS the real message when triggered via skill commands)
- Skill prompts detected and skipped (messages containing `<HARD-GATE>`, `Base directory for this skill:`, etc.)
- Noise filtered: "ready", model switches (`opus[1m]`), deprecated skill redirects, subagent output retrieval instructions

**Never stripped:** Code/JSX tags in user-pasted content (`<SocialValidationResult>`, `<SVGSVGElement>`, TypeScript generics, React components, stack traces).

Validated: 0 false positives across 855 messages in 109 sessions.

### Step 4: Build Turns

Group events into turns: user message → merged assistant response (consecutive assistant events merged into one).

For each assistant response, extract:
- **Text blocks** — always kept in all modes
- **Edit tool_use** — `old_string`/`new_string` diff, formatted per mode
- **Write tool_use** — file content, formatted per mode
- **Read/Bash/Grep/Glob** — skipped (agent will re-read if needed)

### Step 5: Adaptive Mode Selection

Mode is chosen based on **total turns across ALL sessions** (not per-session):

| Total Turns | Mode | Edit Rendering | Write Rendering |
|-------------|------|----------------|-----------------|
| ≤ 10 | full | Complete `-/+` diff | Full file content |
| 11–25 | balanced | Truncated (12 lines max) | Preview (15 lines) |
| > 25 | compact | One-liner: `✏️ file (-N/+M lines)` | `📝 file (N lines)` |

User messages and assistant text are **always kept in full** regardless of mode.

### Step 6: Post-Check Token Budget

After rebuild, estimate tokens (`chars / 4`):
1. Within `maxTokens` → done
2. Exceeds but not yet compact → force downgrade to compact, rebuild
3. Still exceeds in compact → truncate oldest sessions, keep newest until fits. Set `truncated: true`.

### Step 7: Merge Sessions

Sessions ordered chronologically (oldest first, newest last). Output format:

```markdown
# Conversation History from PR #19 (branch: refactor/verify-agent)

6 sessions | 75 turns | 2026-03-15 18:53 → 2026-03-16 04:35 | mode: compact

## Session Conversation History 1 — 2026-03-15 18:53 → 20:14 (Claude Code, 11 turns, branch: refactor/verify-agent)
*Files: schema.prisma, challenge-generator.ts, ...*

**User [1]:**
...
**Assistant:**
...

## Session Conversation History 6 — 2026-03-16 04:28 → 04:35 (Claude Code, 2 turns, branch: refactor/verify-agent)
...

---
⚠️ The conversation history above is from previous sessions and may be outdated.
Files, code, and decisions referenced may have changed since then.
Always verify the current state of the codebase before making changes based on this history.
---
```

## Context Injection into Agent

### When

Only once — on the first prompt of the session. After injection, `pendingContext` is cleared.

### How

```typescript
class Session {
  private pendingContext: string | null = null;

  setContext(markdown: string): void {
    this.pendingContext = markdown;
  }

  private async processPrompt(text: string, attachments?: Attachment[]): Promise<void> {
    if (this.pendingContext) {
      text = `[CONVERSATION HISTORY - This is context from previous sessions, not current conversation]\n\n${this.pendingContext}\n\n[END CONVERSATION HISTORY]\n\n${text}`;
      this.pendingContext = null;
    }
    // ... existing prompt processing
  }
}
```

## `/resume` Command

### Syntax

```
/resume pr <number|url> [repo_path]
/resume branch <name> [repo_path]
/resume commit <hash> [repo_path]
/resume <checkpoint_or_session_id> [repo_path]   — auto-detect by format
/resume [repo_path]                               — latest 5 sessions
```

**Auto-detection for IDs (no subcommand needed):**
- 12 hex chars (`f634acf05138`) → checkpoint ID
- UUID format (`1d9503b8-0134-419a-a3a7-019b312dd12c`) → session ID

Available in both assistant chat and topic threads. Always creates a new session/topic.

### UX Flow

**Normal case (< 30K tokens):**

```
User: /resume pr 19

Bot: 🔍 Scanning PR #19...
     Found 6 sessions (75 turns) on branch `refactor/verify-agent`
     2026-03-15 → 2026-03-16 | mode: compact | ~15K tokens

     Creating session with context...

[New topic created: "PR #19: refactor/verify-agent"]

Bot (in topic): ✅ Session created with conversation history from PR #19
     6 sessions loaded (compact mode, ~15K tokens)

     Send your message to continue.
```

**Over budget (> 30K tokens):**

```
User: /resume branch main

Bot: 🔍 Scanning branch `main`...
     Found 64 sessions (180 turns) — estimated ~85K tokens

     This exceeds the 30K token budget. Options:
     1️⃣ Latest 5 sessions (~12K tokens)
     2️⃣ Latest 10 sessions (~22K tokens)
     3️⃣ All 64 sessions in compact mode (~45K tokens)

User: 1️⃣

Bot: Creating session with latest 5 sessions...
```

**Over-budget timeout:** If user doesn't respond within 60 seconds, auto-select option 1 (latest 5 sessions) and proceed. If user sends a non-option message, treat it as cancellation and abort `/resume`.

**Entire not available:**

```
User: /resume pr 19

Bot: ⚠️ This repo doesn't have Entire checkpoints enabled.

     To enable conversation history tracking:
     npx entire enable

     Learn more: https://docs.entire.io/getting-started
```

### Repo Path Resolution

1. If `repo_path` argument provided → use it
2. Otherwise → use `workingDirectory` from current agent config
3. Validate: must be a git repo (`git rev-parse --git-dir`)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `git` not found | Skip, notify "Git not installed" |
| Remote branch not fetched | Auto `git fetch` the entire checkpoints ref. Remote name resolved via `git remote` (first remote, usually `origin`) |
| Corrupted JSONL line | Skip line, log warning, continue |
| PR number not found | "PR #N not found in git history" |
| Branch has no checkpoints | "No Entire sessions found on branch `name`" |
| Commit has no checkpoint trailer | "Commit `hash` has no Entire checkpoint linked" |
| Checkpoint ID not found | "Checkpoint `id` not found in Entire data" |
| Session ID not found | "Session `id` not found in Entire data" |
| Sessions found but 0 turns after filter | "Sessions found but contain no conversation data" |
| JSONL file > 10MB | Stream parse line-by-line, don't load into memory |

## Caching

- Cache rebuilt context: `~/.viben/cache/entire/{repo_hash}_{query_hash}.md`
- TTL-based: 1 hour. No smart invalidation — just expire after TTL. Checkpoints don't change retroactively, and 1 hour is short enough to pick up new ones.
- Cache miss or expired → full rebuild from git

## Prototype Reference

Logic has been prototyped and validated in Python:
- `/tmp/rebuild_conversation_v6.py` — single session JSONL → markdown
- `/tmp/entire_extract.py` — 4 entry points → multi-session context

Validation results:
- 109 sessions tested across claw-quest and Viben repos
- 855 user messages processed, 0 false positives in filtering
- Cross-agent support: Claude Code + Cursor sessions both parse correctly
- Special cases validated: code pastes, images, REDACTED content, context continuations, IDE selections, task notifications, skill prompts

Port to TypeScript should preserve the same filtering rules, adaptive mode thresholds, and message cleaning logic.

## Testing Strategy

- Unit tests for `MessageCleaner`: each tag pattern, skill prompt detection, edge cases
- Unit tests for `ConversationBuilder`: adaptive mode selection, turn merging, token estimation
- Integration tests for `CheckpointReader`: mock git output, parse metadata
- Integration tests for `EntireProvider`: end-to-end from query → context result
- Ship test fixtures: sample `metadata.json` and `full.jsonl` files (short/medium/long sessions) for deterministic tests without requiring a real repo
- Test with real Entire data from claw-quest repo (109 sessions available) for validation

## Known Limitations

- **Agent prompt size limit:** Injected context + user message may exceed some agents' max prompt size. No guardrail in v1 — rely on adaptive mode + token budget to keep context reasonable. Document as known limitation.
- **JSONL format coupling:** Parser assumes Claude Code / Cursor transcript format. If Entire changes JSONL schema, parser needs updating.
- **No bi-directional sync:** Viben sessions via Telegram do NOT create Entire checkpoints. This is read-only integration.
- **Single remote assumed:** Git operations use first remote found. Multi-remote setups may need manual `repo_path` specification.
