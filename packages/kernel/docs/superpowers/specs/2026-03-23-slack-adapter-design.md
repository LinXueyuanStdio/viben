# Slack Channel Adapter Design

**Date:** 2026-03-23
**Scope:** `src/adapters/slack/` — new channel adapter for Slack workspaces
**Approach:** SOLID-first, channel-per-session threading, Socket Mode event delivery
**Constraint:** Zero changes to core modules. External behavior of existing adapters preserved.

---

## Problem Statement

Viben currently only supports Telegram as a channel. Adding Slack opens the platform to enterprise/team workspaces where Telegram is uncommon. The implementation must:

1. **Not touch core** — `VibenCore`, `Session`, `AgentInstance`, `SessionBridge` stay unchanged
2. **Not touch Telegram adapter** — no shared-state coupling between adapters
3. **Be extensible internally** — SOLID principles so future adapters (Discord, Teams...) can learn from this pattern
4. **Handle Slack-specific constraints** correctly — rate limits, channel naming, interactive payloads, OAuth scopes

---

## Architecture Decision Record

### ADR-1: Channel per Session (not Thread replies)

Each Viben session maps to a dedicated Slack **channel** (private, bot-managed).

**Rationale:**
- Threads in Slack are secondary UI — easy to miss, no rename API, hard to navigate across sessions
- Channels are first-class citizens: renameable, navigable from sidebar, archivable
- Maps cleanly to `createSessionThread` / `renameSessionThread` / `deleteSessionThread` in `ChannelAdapter`

**Trade-offs:**
- Requires `channels:manage` / `groups:write` OAuth scopes
- Channels accumulate — `deleteSessionThread` archives (not deletes) due to Slack API limitation
- Channel names must be slugified (Slack rule: lowercase, ≤80 chars, no spaces/special chars)
- Bot is automatically a member of private channels it creates — no self-join/invite needed
- Users must be explicitly invited via `conversations.invite` after channel creation — private channels are inaccessible to users until invited (link shows as locked, cannot be opened)
- Invite `allowedUserIds` from config on channel creation; if empty (open workspace), skip invite

**Convention:** Use private channels (`conversations.create` with `is_private: true`) to avoid cluttering the workspace's public channel list.

### ADR-2: Socket Mode for Event Delivery

Use `@slack/bolt` with Socket Mode (WebSocket) instead of Events API (HTTP webhook).

**Rationale:**
- Viben runs locally — no public URL guaranteed
- Socket Mode requires no tunnel setup (unlike Events API)
- Consistent with Telegram's long-polling model — no inbound HTTP required
- Tunnel feature exists but is optional; Socket Mode keeps Slack setup self-contained

**Trade-off:** Requires `connections:write` scope and an App-level token (separate from bot token).

### ADR-3: SOLID Internal Structure

`SlackAdapter` is the thin orchestrator. All concerns are extracted into focused, injectable classes — mirroring the Telegram refactor design but applied from the start.

---

## Module Structure

```
src/adapters/slack/
  adapter.ts              — SlackAdapter (orchestrator, ~200 lines)
  types.ts                — SlackChannelConfig, SlackSessionMeta
  channel-manager.ts      — ISlackChannelManager + impl (create, rename, archive, join)
  formatter.ts            — ISlackFormatter + impl (Block Kit builder)
  send-queue.ts           — SlackSendQueue (per-method rate limiting)
  permission-handler.ts   — SlackPermissionHandler (interactive components)
  event-router.ts         — SlackEventRouter (Bolt event → IncomingMessage)
  slug.ts                 — Channel name slugifier utility
  setup-guide.ts          — CLI setup wizard for Slack App creation (OAuth scopes, tokens)
```

---

## Design

### 1. Interfaces (Dependency Inversion)

Define interfaces for all major dependencies so `SlackAdapter` depends on abstractions, not concretions.

```ts
// channel-manager.ts
export interface ISlackChannelManager {
  create(name: string): Promise<string>;          // returns channelId
  rename(channelId: string, name: string): Promise<void>;
  archive(channelId: string): Promise<void>;
  ensureBotJoined(channelId: string): Promise<void>;
  getNotificationChannelId(): string;
}

// formatter.ts
export interface ISlackFormatter {
  formatOutgoing(message: OutgoingMessage): Block[];
  formatPermissionRequest(request: PermissionRequest): Block[];
  formatNotification(text: string): Block[];
  formatSessionEnd(reason?: string): Block[];
}

// send-queue.ts
export interface ISlackSendQueue {
  enqueue(method: SlackMethod, params: Record<string, unknown>): Promise<unknown>;
}
```

### 2. SlackAdapter — Thin Orchestrator

```ts
export class SlackAdapter extends ChannelAdapter {
  constructor(
    core: VibenCore,
    private config: SlackChannelConfig,
    private app: App,                              // @slack/bolt App instance
    private channelManager: ISlackChannelManager,
    private formatter: ISlackFormatter,
    private sendQueue: ISlackSendQueue,
    private permissionHandler: SlackPermissionHandler,
    private eventRouter: SlackEventRouter,
  ) {
    super(core);
  }

  // --- ChannelAdapter abstract methods ---

  async sendMessage(threadId: string, message: OutgoingMessage): Promise<void> {
    const blocks = this.formatter.formatOutgoing(message);
    if (!blocks.length) return;
    await this.sendQueue.enqueue('chat.postMessage', {
      channel: threadId,
      blocks,
      text: this.fallbackText(message),           // required for notifications
    });
  }

  async sendPermissionRequest(threadId: string, req: PermissionRequest): Promise<void> {
    await this.permissionHandler.send(threadId, req);
  }

  async sendNotification(text: string): Promise<void> {
    const blocks = this.formatter.formatNotification(text);
    await this.sendQueue.enqueue('chat.postMessage', {
      channel: this.channelManager.getNotificationChannelId(),
      blocks,
      text,
    });
  }

  async createSessionThread(channelId: string, label: string): Promise<string> {
    const slug = toSlug(label);                    // "New Session" → "viben-new-session-a3k9"
    const newChannelId = await this.channelManager.create(slug);
    await this.channelManager.ensureBotJoined(newChannelId);
    return newChannelId;
  }

  async renameSessionThread(threadId: string, name: string): Promise<void> {
    await this.channelManager.rename(threadId, toSlug(name));
  }

  async deleteSessionThread(threadId: string): Promise<void> {
    await this.channelManager.archive(threadId);   // Slack API cannot delete channels
  }

  // --- Lifecycle ---

  async start(): Promise<void> {
    this.eventRouter.register(this.app);
    this.permissionHandler.register(this.app);
    await this.app.start();
    await this.sendNotification('✅ Viben online');
  }

  async stop(): Promise<void> {
    await this.sendNotification('🛑 Viben shutting down');
    await this.app.stop();
  }
}
```

### 3. SlackChannelManager — Single Responsibility: Channel CRUD

```ts
export class SlackChannelManager implements ISlackChannelManager {
  constructor(
    private client: WebClient,
    private config: SlackChannelConfig,
  ) {}

  async create(slug: string): Promise<string> {
    const res = await this.client.conversations.create({
      name: slug,
      is_private: true,
    });
    return res.channel!.id!;
  }

  async rename(channelId: string, slug: string): Promise<void> {
    await this.client.conversations.rename({
      channel: channelId,
      name: slug,
    });
  }

  async archive(channelId: string): Promise<void> {
    await this.client.conversations.archive({ channel: channelId });
  }

  async ensureBotJoined(channelId: string): Promise<void> {
    await this.client.conversations.join({ channel: channelId });
  }

  getNotificationChannelId(): string {
    return this.config.notificationChannelId;
  }
}
```

### 4. SlackFormatter — Single Responsibility: Block Kit

Slack does not support HTML. All formatting uses Block Kit (JSON blocks).

```ts
export class SlackFormatter implements ISlackFormatter {
  formatOutgoing(message: OutgoingMessage): Block[] {
    switch (message.type) {
      case 'text':       return this.text(message.text);
      case 'thought':    return this.thought(message.text);
      case 'tool_call':  return this.toolCall(message);
      case 'tool_update':return this.toolUpdate(message);
      case 'plan':       return this.plan(message.text);
      case 'usage':      return this.usage(message);
      case 'session_end':return this.sessionEnd(message.text);
      case 'error':      return this.error(message.text);
      default:           return [];
    }
  }

  private text(t: string): Block[] {
    // Split at 3000-char Slack limit, never inside code fences
    return splitSafe(t).map(chunk => ({
      type: 'section',
      text: { type: 'mrkdwn', text: chunk },
    }));
  }

  private toolCall(msg: OutgoingMessage): Block[] {
    return [{
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `🔧 \`${msg.metadata?.name}\`` }],
    }];
  }

  formatPermissionRequest(req: PermissionRequest): Block[] {
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `🔐 *Permission Request*\n${req.description}` },
      },
      {
        type: 'actions',
        block_id: `perm_${req.id}`,
        elements: req.options.map(opt => ({
          type: 'button',
          text: { type: 'plain_text', text: opt.label },
          value: `${req.id}:${opt.id}`,
          action_id: `perm_action_${opt.id}`,
          style: opt.isAllow ? 'primary' : 'danger',
        })),
      },
    ];
  }

  formatNotification(text: string): Block[] {
    return [{ type: 'section', text: { type: 'mrkdwn', text } }];
  }

  formatSessionEnd(reason?: string): Block[] {
    return [{ type: 'divider' }, {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `✅ Session ended${reason ? ` — ${reason}` : ''}` }],
    }];
  }
}
```

### 5. SlackSendQueue — Per-Method Rate Limiting

Slack rate limits by API method tier, not globally. Each method has its own quota.

```ts
type SlackMethod = 'chat.postMessage' | 'conversations.create' | 'conversations.rename' | 'conversations.archive' | 'conversations.join';

// Slack Tier definitions (requests/minute)
const METHOD_TIERS: Record<SlackMethod, number> = {
  'chat.postMessage':     50,   // Tier 3
  'conversations.create': 20,   // Tier 2
  'conversations.rename': 20,   // Tier 2
  'conversations.archive': 20,  // Tier 2
  'conversations.join':   20,   // Tier 2
};

export class SlackSendQueue implements ISlackSendQueue {
  private queues: Map<SlackMethod, PQueue> = new Map();

  constructor(private client: WebClient) {
    for (const [method, rpm] of Object.entries(METHOD_TIERS)) {
      // interval: 60_000ms / rpm to spread evenly
      this.queues.set(method as SlackMethod, new PQueue({
        interval: Math.ceil(60_000 / rpm),
        intervalCap: 1,
      }));
    }
  }

  async enqueue(method: SlackMethod, params: Record<string, unknown>): Promise<unknown> {
    const queue = this.queues.get(method)!;
    return queue.add(() => (this.client.apiCall as Function)(method, params));
  }
}
```

> **Note:** Uses `p-queue` for per-method throttling. On HTTP 429, Bolt's built-in retry handler kicks in as a second defense layer.

### 6. SlackEventRouter — Single Responsibility: Route Bolt Events → Core

```ts
export class SlackEventRouter {
  constructor(
    private core: VibenCore,
    private config: SlackChannelConfig,
  ) {}

  register(app: App): void {
    // New message in a session channel
    app.message(async ({ message, say }) => {
      if (!this.isAllowedUser(message.user)) return;
      if (message.channel_type !== 'group') return;  // private channel
      if (message.bot_id) return;                     // ignore bot messages

      await this.core.handleMessage({
        channelId: 'slack',
        threadId: message.channel,
        userId: message.user,
        text: (message as any).text ?? '',
      });
    });

    // Slash command: /new
    app.command('/viben-new', async ({ ack, body }) => {
      await ack();
      if (!this.isAllowedUser(body.user_id)) return;
      await this.core.handleNewSession({
        channelId: 'slack',
        userId: body.user_id,
        threadId: body.channel_id,   // reply in current channel initially
      });
    });

    // Slash command: /cancel
    app.command('/viben-cancel', async ({ ack, body }) => {
      await ack();
      await this.core.handleMessage({
        channelId: 'slack',
        threadId: body.channel_id,
        userId: body.user_id,
        text: '/cancel',
      });
    });
  }

  private isAllowedUser(userId?: string): boolean {
    const allowed = this.config.allowedUserIds;
    if (!allowed?.length) return true;
    return !!userId && allowed.includes(userId);
  }
}
```

### 7. SlackPermissionHandler — Interactive Components

Slack interactive payloads route through a separate Bolt action handler (unlike Telegram callback_query which flows through the same bot middleware).

```ts
export class SlackPermissionHandler {
  private pending: Map<string, (optionId: string) => void> = new Map();

  constructor(private sendQueue: ISlackSendQueue) {}

  register(app: App): void {
    // Match all permission action IDs with prefix "perm_action_"
    app.action(/^perm_action_/, async ({ action, ack, body }) => {
      await ack();
      const btn = action as ButtonAction;
      const [requestId, optionId] = btn.value.split(':');
      const resolve = this.pending.get(requestId);
      if (resolve) {
        resolve(optionId);
        this.pending.delete(requestId);
        // Remove buttons from the original message
        await this.removeButtons(body);
      }
    });
  }

  async send(channelId: string, req: PermissionRequest): Promise<void> {
    const formatter = new SlackFormatter();
    await this.sendQueue.enqueue('chat.postMessage', {
      channel: channelId,
      blocks: formatter.formatPermissionRequest(req),
      text: `Permission request: ${req.description}`,
    });
    // Register callback for when user responds
    return new Promise<void>(resolve => {
      this.pending.set(req.id, (_optionId) => resolve());
    });
  }

  private async removeButtons(body: BlockAction): Promise<void> {
    // Edit the original message to replace actions block with a "responded" context
    // Uses body.message.ts + body.channel.id to identify the message
  }
}
```

### 8. Slug Utility

```ts
// slug.ts
export function toSlug(name: string, suffix?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .trim()
    .replace(/\s+/g, '-')            // spaces → dashes
    .replace(/-+/g, '-')             // collapse dashes
    .slice(0, 70);                   // Slack max: 80, leave room for suffix

  const sfx = suffix ?? nanoid(4);  // collision-resistant suffix
  return `${base}-${sfx}`;
}

// Examples:
// "Fix auth bug" → "fix-auth-bug-a3k9"
// "New Session"  → "new-session-x7p2"
// "Implement OAuth 2.0 & JWT refresh" → "implement-oauth-20-jwt-refresh-b8qr"
```

---

## Config Schema

Added to Zod config schema in `config.ts`. All fields have `.default()` or `.optional()` for backward compatibility.

```ts
const SlackChannelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  adapter: z.literal('slack').optional(),            // plugin adapter marker

  // Auth — from Slack App dashboard
  botToken: z.string().optional(),                   // xoxb-...
  appToken: z.string().optional(),                   // xapp-... (Socket Mode)
  signingSecret: z.string().optional(),              // for request verification

  // Workspace setup
  notificationChannelId: z.string().optional(),      // pre-existing #viben-notifications

  // Security (mirrors core security but per-channel)
  allowedUserIds: z.array(z.string()).default([]),   // Slack member IDs (U...)

  // Channel naming prefix
  channelPrefix: z.string().default('viben'),      // e.g. "viben-fix-auth-bug-a3k9"

  // Startup behavior
  autoCreateSession: z.boolean().default(true),       // create a session channel on adapter start
});
```

**Config example (`~/.viben/config.json`):**

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "signingSecret": "...",
      "notificationChannelId": "C0123456789",
      "allowedUserIds": ["U0123456789"],
      "channelPrefix": "viben"
    }
  }
}
```

---

## main.ts — Registration (Zero Impact)

Only additive change. Existing Telegram registration is untouched.

```ts
// main.ts
if (config.channels.slack?.enabled) {
  const slackCfg = config.channels.slack as SlackChannelConfig;

  const boltApp = new App({
    token: slackCfg.botToken,
    appToken: slackCfg.appToken,
    socketMode: true,
  });

  const client = boltApp.client;
  const sendQueue = new SlackSendQueue(client);
  const channelManager = new SlackChannelManager(client, slackCfg);
  const formatter = new SlackFormatter();
  const permissionHandler = new SlackPermissionHandler(sendQueue);
  const eventRouter = new SlackEventRouter(core, slackCfg);

  const slackAdapter = new SlackAdapter(
    core, slackCfg, boltApp,
    channelManager, formatter, sendQueue, permissionHandler, eventRouter,
  );

  core.registerAdapter('slack', slackAdapter);
}
```

---

## Post-Implementation Issues (from Code Review)

Issues identified during code review of PR #42 that must be fixed before merge.

### Issue 1: `onNewSession` callback is a no-op

**Location:** `adapter.ts` — EventRouter construction
**Problem:** When a user messages the notification channel, the `onNewSession` callback is `() => {}` — the message is silently dropped. User gets no feedback.
**Fix:** Reply to the user in the notification channel with instructions on how to start a session (e.g., "Use `/viben-new` to start a session").

### Issue 2: `markdownToMrkdwn` bold/italic ordering bug

**Location:** `formatter.ts:markdownToMrkdwn`
**Problem:** Bold runs first — `**bold**` → `*bold*`. The italic regex can then match `*bold*` → `_bold_`, turning bold text into italic.
**Fix:** Use placeholder tokens for bold before running italic conversion:
```typescript
export function markdownToMrkdwn(text: string): string {
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "\x00BOLD\x00$1\x00BOLD\x00")  // placeholder
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "_$1_")   // italic (won't match placeholder)
    .replace(/\x00BOLD\x00(.+?)\x00BOLD\x00/g, "*$1*")         // restore bold
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "<$2|$1>")
    .replace(/^[ \t]*[-*]\s+/gm, "• ")
    .trim();
}
```

### Issue 3: `adoptSession` hardcodes `Number(session.threadId)` for Slack

**Location:** `core.ts:adoptSession`
**Problem:** `platform: { topicId: Number(session.threadId) }` — Slack threadIds are channel slugs (strings), so this stores `NaN`.
**Fix:** Core should not cast to Number. Store threadId as-is:
```typescript
platform: { topicId: session.threadId },
```
Note: This requires verifying that Telegram's existing `topicId` handling still works (Telegram uses numeric topic IDs). The field type should be `string | number`.

### Issue 4: `renameSessionThread` reimplements slug logic without nanoid suffix

**Location:** `adapter.ts:renameSessionThread`
**Problem:** Inline slug conversion instead of `toSlug()`. Missing nanoid suffix → renamed channels can collide.
**Fix:** Use `toSlug(newName, this.slackConfig.channelPrefix)` directly.

### Issue 5: Race condition — `botUserId` may be empty

**Location:** `adapter.ts:start()`
**Problem:** If `auth.test` fails, `botUserId = ""` and only a warning is logged. `EventRouter` captures this empty value. Without a valid `botUserId`, the bot cannot filter its own messages → infinite message loop.
**Fix:** Throw instead of warn — this is a hard requirement:
```typescript
const authResult = await this.webClient.auth.test();
if (!authResult.user_id) {
  throw new Error("Slack auth.test() did not return user_id — check botToken");
}
this.botUserId = authResult.user_id as string;
```

### Issue 6: `allowedUserIds` defined in config but not enforced

**Location:** `event-router.ts`
**Problem:** `SlackChannelConfigSchema` has `allowedUserIds` but `SlackEventRouter` does not check it. Any Slack user can send messages.
**Fix:** Add `isAllowedUser` check in `SlackEventRouter.register()` before routing messages:
```typescript
private isAllowedUser(userId: string): boolean {
  const allowed = this.config.allowedUserIds ?? [];
  if (allowed.length === 0) return true;
  return allowed.includes(userId);
}
```

### Issue 7: `SlackTextBuffer` data loss on concurrent flush

**Location:** `text-buffer.ts:flush()`
**Problem:** `buffer` is cleared (`this.buffer = ""`) before flush completes. If `append()` is called during flush, that text is captured in a cleared buffer — then the early-return guard (`if (this.flushing) return`) on the next flush silently drops it.
**Fix:** Capture buffer content into a local variable before clearing, and queue a re-flush if content arrived during flush:
```typescript
async flush(): Promise<void> {
  if (this.flushing) return;
  const text = this.buffer.trim();
  if (!text) return;
  this.buffer = "";
  if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }

  this.flushing = true;
  try {
    // ... post to Slack
  } finally {
    this.flushing = false;
    // Re-flush if content arrived during flush
    if (this.buffer.trim()) {
      await this.flush();
    }
  }
}
```

### Minor issues

- **File header comment wrong:** `adapter.ts` line 1 says `// src/adapters/slack/index.ts` — fix to `adapter.ts`
- **`config as never` type cast:** Constructor uses `super(core, config as never)` — fix the generic type parameter instead
- **`splitSafe` duplicated:** Exists in both `formatter.ts` and `text-buffer.ts` — extract to a shared `utils.ts`
- **Missing `index.ts` barrel export** — add to match Telegram adapter pattern
- **Missing tests** for `markdownToMrkdwn` regex and `SlackTextBuffer` concurrent flush

### Post-Implementation Issues — Review Round 2 (2026-03-24)

Issues identified by @0xmrpeter after round 1 fixes were applied. PR #42 review ID: 3997306232.

#### Issue R2-1: `config` param optional in `SlackEventRouter` — security footgun

**Location:** `event-router.ts:28`
**Problem:** `private config?: SlackChannelConfig` is optional. If caller forgets to pass it, `isAllowedUser()` silently allows everyone via `this.config?.allowedUserIds ?? []` fallback.
**Fix:** Make `config` a required parameter (non-optional). The adapter always has config available — no valid reason for it to be optional.

#### Issue R2-2: `splitSafe` docstring lies about code block protection

**Location:** `utils.ts:7`
**Problem:** Docstring says "never inside a fenced code block" but implementation only finds `lastIndexOf("\n")`. Code blocks straddling the 3000-char boundary will be split mid-block.
**Fix:** Update docstring to be honest: "splits at nearest newline boundary" — tracking fence state is overkill for current use case.

#### Issue R2-3: `sendPermissionRequest` async flow undocumented

**Location:** `adapter.ts:256-298`
**Problem:** Unlike Telegram adapter where `sendPermissionRequest` awaits the response, Slack posts buttons and returns immediately. Resolution happens async via Bolt action handler. Flow is correct but confusing without explanation.
**Fix:** Add inline comment explaining the async flow difference from Telegram.

#### Issue R2-4: `_createStartupSession` auto-creates on every restart

**Location:** `adapter.ts:129-151`
**Problem:** Every restart creates a new channel. Over time this accumulates abandoned channels. If `maxConcurrentSessions=1`, user is blocked from creating new sessions.
**Fix:** Add `autoCreateSession: boolean` config option (default `true` for backward compat). When `false`, skip `_createStartupSession()`. Document the behavior.

#### Issue R2-5: `channelConfig as any` type cast in main.ts

**Location:** `main.ts:96`
**Problem:** `channelConfig as any` bypasses type checking. Should use proper type.
**Fix:** Change to `channelConfig as SlackChannelConfig` with proper import.

#### Issue R2-6: Auto-approve `"viben"` string match too broad

**Location:** `adapter.ts:267`
**Problem:** `request.description.includes("viben")` matches any description containing the word "viben" anywhere. Could auto-approve unintended requests.
**Fix:** Check the tool/command name from metadata instead of matching against the description string. Use `request.metadata?.command?.startsWith("viben")` or equivalent specific check.

#### Issue R2-7: No retry on `name_taken` in channel-manager.ts

**Location:** `channel-manager.ts:22-26`
**Problem:** Spec mentions retry on `name_taken` but implementation doesn't have it. Simultaneous session starts with similar names will fail.
**Fix:** Catch `name_taken` error, regenerate nanoid suffix, retry once.

#### Issue R2-8: Missing tests for EventRouter and PermissionHandler

**Location:** N/A
**Problem:** Critical routing/security logic (allowedUserIds enforcement, bot message filtering, permission button routing) has no test coverage.
**Fix:** Add unit tests for `SlackEventRouter` (allowedUser filtering, bot message rejection, session lookup routing) and `SlackPermissionHandler` (button click → resolve, unknown request handling).

#### Minor — already addressed (no action needed)

- **Issue R2-6 (reviewer):** `core.ts` adoptSession IIFE — already replaced with clean if/else branching in current code.

---

## Voice/Speech Integration (STT + TTS)

**Date added:** 2026-03-24
**Scope:** Add speech-to-text and text-to-speech support to the Slack adapter, mirroring Telegram adapter's voice capabilities.
**Constraint:** Zero changes to core modules. All STT/TTS logic already lives in core (`SpeechService`, `Session.maybeTranscribeAudio()`, session-bridge `audio_content` events).

### Background

Core already provides:
- **STT**: Groq Whisper API (`whisper-large-v3-turbo`) via `SpeechService.transcribe()`
- **TTS**: Microsoft Edge TTS via `SpeechService.synthesize()` — output: MP3
- **Session integration**: `voiceMode` (off/next/on), `[TTS]...[/TTS]` block extraction, auto-transcribe when agent lacks audio capability
- **session-bridge**: emits `OutgoingMessage { type: "attachment", attachment: { type: "audio" } }` when TTS completes

Telegram adapter has full voice support. Slack adapter currently has none — `EventRouter` drops `file_share` subtype, `sendMessage()` has no `attachment` handler.

### Slack Audio Clip Behavior

Slack's native "Record audio clip" (microphone icon in message composer) produces:
- **Event**: `message` with `subtype: "file_share"` and `files[]` array
- **Format**: MP4 container (audio-only), MIME type `video/mp4`
- **Filename pattern**: `audio_message_*.mp4`
- **Download**: `file.url_private` with `Authorization: Bearer <botToken>` header
- **Required scope**: `files:read` (to access file content)

### Data Flow

```
INCOMING (STT):
User records audio clip in Slack
  → Bolt message event (subtype: "file_share", files[].mimetype: "video/mp4")
  → EventRouter allows file_share through (currently blocked by subtype guard)
  → Adapter callback downloads file via url_private + Bearer token
  → Save via FileService.saveFile() with corrected MIME "audio/mp4"
  → Pass as IncomingMessage.attachments[] to core.handleMessage()
  → Session.maybeTranscribeAudio() auto-transcribes via Groq Whisper

OUTGOING (TTS):
Agent response has [TTS]...[/TTS]
  → Session extracts & synthesizes via Edge TTS
  → session-bridge emits OutgoingMessage { type: "attachment", attachment: { type: "audio" } }
  → SlackAdapter.sendMessage() detects type: "attachment"
  → Upload MP3 via Slack files.uploadV2 API
  → Strip [TTS]...[/TTS] from pending text buffer
```

### Changes Required

#### 1. EventRouter — Allow `file_share` subtype

**Location:** `event-router.ts:43`
**Current:** `if ((message as any).subtype) return;` — blocks ALL subtypes including `file_share`
**Change:** Allow `file_share` through, extract `files[]` array

```typescript
const subtype = (message as any).subtype;
if (subtype && subtype !== "file_share") return;  // allow file_share through

const files: SlackFileInfo[] | undefined = (message as any).files;
```

Expand `IncomingMessageCallback` signature to pass raw file metadata:

```typescript
export type IncomingMessageCallback = (
  sessionId: string, text: string, userId: string,
  files?: SlackFileInfo[],
) => void;
```

`SlackFileInfo` type (add to `types.ts`):
```typescript
export interface SlackFileInfo {
  id: string;
  name: string;
  mimetype: string;
  size: number;
  url_private: string;
}
```

**Separation of concerns:** EventRouter only extracts metadata from the event. It does NOT download files — adapter handles that in the callback.

#### 2. Adapter — Download incoming audio + pass to core

**Location:** `adapter.ts` — incoming message callback (lines 96-104)

Add private methods:

**Dependency:** Adapter needs `FileService` — access via `this.core.fileService` (same pattern as Telegram adapter at `adapter.ts:148`). Add `private fileService!: FileService` property, assign in `start()`.

Add private methods:

```typescript
/** Detect Slack audio clips — MIME type or filename pattern.
 *  Slack audio clips arrive as video/mp4 (audio-only container).
 *  Also catches direct audio/* uploads (wav, mp3, etc). */
private isAudioClip(file: SlackFileInfo): boolean {
  return file.mimetype === "video/mp4" && file.name?.startsWith("audio_message") ||
         file.mimetype?.startsWith("audio/");
}

private async downloadSlackFile(url: string): Promise<Buffer | null> {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${this.slackConfig.botToken}` },
  });
  if (!resp.ok) {
    log.warn({ status: resp.status }, "Failed to download Slack file");
    return null;
  }
  return Buffer.from(await resp.arrayBuffer());
}
```

In the incoming callback, when files are present:
1. Filter audio files via `isAudioClip()`
2. Download via `downloadSlackFile()`
3. Save via `FileService.saveFile()` — use corrected MIME `audio/mp4` (Slack sends `video/mp4` but it's audio-only). This maps to `.m4a` extension via `FileService.MIME_TO_EXT`, which Whisper accepts.
4. Pass as `IncomingMessage.attachments[]` to `core.handleMessage()`
5. On download failure: forward text-only (don't drop the entire message)

Pattern mirrors Telegram's `handleIncomingMedia()` at `adapter.ts:851-889`.

#### 3. Adapter — Handle outgoing audio attachments

**Location:** `adapter.ts:sendMessage()` (lines 220-256)

Add handler for `type: "attachment"`:

```typescript
if (content.type === "attachment" && content.attachment) {
  if (content.attachment.type === "audio") {
    await this.uploadAudioFile(meta.channelId, content.attachment);
    // Strip [TTS]...[/TTS] from text buffer or already-posted message
    const buf = this.textBuffers.get(sessionId);
    if (buf) {
      await buf.stripTtsBlock();
    }
    return;
  }
  return;  // other attachment types: no-op for now
}
```

Upload method — calls `webClient.files.uploadV2()` directly (not through SendQueue) because `files.uploadV2` is a multi-step convenience wrapper that internally calls `files.getUploadURLExternal` + upload + `files.completeUploadExternal`. It cannot be routed through `apiCall()`. TTS audio uploads are infrequent, so rate limiting is not critical here.

```typescript
private async uploadAudioFile(channelId: string, att: Attachment): Promise<void> {
  const fileBuffer = await fs.promises.readFile(att.filePath);
  await this.webClient.files.uploadV2({
    channel_id: channelId,
    file: fileBuffer,
    filename: att.fileName,
  });
}
```

#### 4. SlackTextBuffer — Add `stripTtsBlock()` with message editing

**Location:** `text-buffer.ts`

**Problem:** The text buffer flushes after 2s idle. By the time TTS audio is ready (synthesis takes seconds), the `[TTS]...[/TTS]` block has likely already been posted to Slack. Simply stripping the in-memory buffer does nothing — the user already sees the raw tags.

**Solution:** Track the `ts` (timestamp/ID) of the last flushed message. When `stripTtsBlock()` is called:
1. If `[TTS]...[/TTS]` is still in the unflushed buffer → strip from buffer
2. If already posted → use `chat.update` to edit the posted message and remove the TTS block

```typescript
private lastMessageTs: string | undefined;

// In flush(), capture the message ts from the API response:
const result = await this.queue.enqueue("chat.postMessage", { ... });
this.lastMessageTs = (result as any).ts;

// Strip method:
async stripTtsBlock(): Promise<void> {
  const ttsRegex = /\[TTS\][\s\S]*?\[\/TTS\]/g;

  // Case 1: TTS block still in unflushed buffer
  if (ttsRegex.test(this.buffer)) {
    this.buffer = this.buffer.replace(ttsRegex, "").trim();
    return;
  }

  // Case 2: Already flushed — edit the posted message
  if (this.lastMessageTs) {
    // Fetch is not needed — we can just post an update with the cleaned text
    // However, we don't cache the posted text. Use chat.update with blocks.
    // Best effort: the block text is already in Slack, so we need to re-read
    // or cache it. Simplest: cache lastPostedText in flush().
    // See implementation plan for full details.
  }
}
```

**Note:** `chat.update` is already in `SlackMethod` union. The buffer should cache `lastPostedText` during flush for the edit case.

#### 5. Docs — Add `files:read` and `files:write` scopes

**Location:** `docs/slack-setup.md` — Bot Token Scopes section

Add `files:read` and `files:write` to the required scopes list. Also update the spec's OAuth scopes table.

### Files Changed

| File | Action | Change |
|---|---|---|
| `src/adapters/slack/event-router.ts` | **Modify** | Allow `file_share` subtype, extract `files[]`, expand callback signature |
| `src/adapters/slack/adapter.ts` | **Modify** | Add `downloadSlackFile()`, `isAudioClip()`, `uploadAudioFile()`, handle `attachment` in `sendMessage()` |
| `src/adapters/slack/text-buffer.ts` | **Modify** | Add `stripTtsBlock()` with message editing, track `lastMessageTs` |
| `src/adapters/slack/types.ts` | **Modify** | Add `SlackFileInfo` interface |
| `docs/slack-setup.md` | **Modify** | Add `files:read` and `files:write` scopes to setup instructions |
| `src/core/` | **No change** | All STT/TTS logic already in core |
| `src/adapters/telegram/` | **No change** | |

### Testing Strategy

- **Unit test for EventRouter**: Verify `file_share` messages with audio files are routed (not dropped)
- **Unit test for audio detection**: `isAudioClip()` correctly identifies Slack audio clips by filename pattern and MIME type
- **Integration test**: Mock Slack file download, verify `core.handleMessage()` receives correct `attachments[]`
- **TTS test**: Verify `type: "attachment"` with `type: "audio"` triggers `files.uploadV2` and `stripTtsBlock()`

### OAuth Scope Addition

Add to bot token scopes:

| Scope | Purpose |
|---|---|
| `files:read` | Download audio clip content from `url_private` |
| `files:write` | Upload TTS audio files via `files.uploadV2` |

---

## Known Constraints & Mitigations

### Channel archiving — not deletion

Slack API does not allow channel deletion via API (only through UI). `deleteSessionThread` archives the channel instead. Over time this accumulates.

**Mitigation:** Add a cleanup command (`viben slack:cleanup`) that archives channels older than N days in bulk. Run periodically or on demand.

### Channel name collisions

`toSlug` appends a 4-char nanoid suffix to all generated names. Probability of collision for 1M channels is ~0.002% — acceptable without a uniqueness check loop.

**Fallback:** If `conversations.create` fails with `name_taken`, regenerate suffix and retry (up to 3 attempts).

### No channel deletion means `sessionStore` diverges

When a session's channel is archived (on session end), the session record in store still has a `threadId` pointing to an archived channel. On lazy resume, posting to an archived channel will fail.

**Mitigation:** In `SlackAdapter.createSessionThread`, check if the channel is archived before posting. If archived, unarchive first (or create a new channel and update the session record's threadId).

### Interactive payload endpoint

Bolt handles Slack interactive payloads (button clicks) via its own internal router in Socket Mode — no separate HTTP endpoint needed. This is transparent in Socket Mode. If switching to Events API later, Hono API server must add `/slack/interactions` route and call `app.processEvent()`.

### OAuth scopes required

The Slack App must be configured with these bot token scopes:

| Scope | Purpose |
|---|---|
| `channels:manage` | Create/rename/archive public channels |
| `groups:write` | Create/rename/archive private channels |
| `groups:read` | List private channels |
| `chat:write` | Post messages |
| `files:read` | Download audio clip content from `url_private` |
| `files:write` | Upload TTS audio files via `files.uploadV2` |
| `commands` | Register slash commands |
| `connections:write` | Socket Mode (App-level token scope) |

And these app-level token scopes (for Socket Mode):
| Scope | Purpose |
|---|---|
| `connections:write` | Open WebSocket connection |

---

## SOLID Compliance Summary

| Principle | Application |
|---|---|
| **S** — Single Responsibility | 7 focused classes, each ≤200 lines. `adapter.ts` is orchestrator only. |
| **O** — Open/Closed | `SlackAdapter extends ChannelAdapter` — core closed for modification, Slack open for extension. Internal classes use interfaces so implementations are swappable. |
| **L** — Liskov Substitution | `SlackAdapter` correctly implements all `ChannelAdapter` abstract methods. `sendSkillCommands` / `cleanupSkillCommands` are no-ops (valid — optional methods). |
| **I** — Interface Segregation | `ISlackChannelManager`, `ISlackFormatter`, `ISlackSendQueue` each cover exactly one concern. `SlackAdapter` constructor only depends on what it uses. |
| **D** — Dependency Inversion | `SlackAdapter` depends on interfaces, not concrete classes. `main.ts` wires the concrete implementations — classic composition root pattern. |

---

## Implementation Order

| Step | Task | Files |
|---|---|---|
| 1 | Slug utility + unit tests | `slug.ts`, `slug.test.ts` |
| 2 | `ISlackFormatter` + `SlackFormatter` | `formatter.ts`, `formatter.test.ts` |
| 3 | `ISlackSendQueue` + `SlackSendQueue` | `send-queue.ts`, `send-queue.test.ts` |
| 4 | `ISlackChannelManager` + `SlackChannelManager` | `channel-manager.ts` |
| 5 | `SlackPermissionHandler` | `permission-handler.ts` |
| 6 | `SlackEventRouter` | `event-router.ts` |
| 7 | `SlackAdapter` + wire in `main.ts` | `adapter.ts`, `types.ts`, `main.ts` |
| 8 | Config schema update | `config.ts` (+5 lines Zod) |
| 9 | Setup wizard | `setup-guide.ts`, update `setup.ts` |
| 10 | Integration test (mocked Bolt) | `adapter.test.ts` |

---

## Files

| File | Action | Notes |
|---|---|---|
| `src/adapters/slack/adapter.ts` | **New** | ~200 lines, thin orchestrator |
| `src/adapters/slack/types.ts` | **New** | `SlackChannelConfig`, `SlackSessionMeta` |
| `src/adapters/slack/channel-manager.ts` | **New** | `ISlackChannelManager` + impl |
| `src/adapters/slack/formatter.ts` | **New** | `ISlackFormatter` + Block Kit impl |
| `src/adapters/slack/send-queue.ts` | **New** | Per-method rate limiter |
| `src/adapters/slack/permission-handler.ts` | **New** | Interactive components |
| `src/adapters/slack/event-router.ts` | **New** | Bolt event → `core.handleMessage` |
| `src/adapters/slack/slug.ts` | **New** | Channel name slugifier |
| `src/adapters/slack/setup-guide.ts` | **New** | Interactive setup wizard |
| `src/core/config.ts` | **Minor** | +`SlackChannelConfigSchema` (~20 lines) |
| `src/main.ts` | **Minor** | +Slack adapter registration (~20 lines) |
| `src/core/channel.ts` | **No change** | Abstract base unchanged |
| `src/core/core.ts` | **Minor fix** | `adoptSession`: store `threadId` as string, not `Number(threadId)` |
| `src/core/session.ts` | **No change** | |
| `src/adapters/telegram/` | **No change** | |

**New dependency:** `@slack/bolt` — official Slack framework.

---

## Testing Strategy

- **Unit tests per class** — all testable without a real Slack workspace
  - `slug.test.ts` — edge cases: unicode, long names, special chars
  - `formatter.test.ts` — each `OutgoingMessage` type → correct Block Kit JSON
  - `send-queue.test.ts` — verify per-method throttling, queue isolation
- **Integration test** — mock `@slack/bolt` App, assert `core.handleMessage` called correctly
- **No tests needed in core** — no core changes

---

### Post-Implementation Issues — Review Round 3 (2026-03-24)

Issues identified by @0xmrpeter after round 1 and round 2 fixes were applied. PR #42 review ID: 3998413467.

#### Issue R3-1 (Must Fix): `TextBuffer.flush()` race — data loss on `session_end`

**Location:** `text-buffer.ts:41-69`
**Problem:** When `flush()` is called while another flush is in progress, it returns immediately (`if (this.flushing) return`). The `session_end` handler in `adapter.ts:299-305` does `await buf.flush()` → returns immediately → calls `destroy()` → buffer cleared. The timer-triggered flush's `finally` block tries to re-flush but the buffer is already gone. Data arriving during an active flush can be lost.
**Fix:** Replace the boolean `flushing` flag with a promise-based lock. When a flush is in progress, return the ongoing promise so callers properly await completion.

```typescript
private flushPromise: Promise<void> | undefined;

async flush(): Promise<void> {
  if (this.flushPromise) return this.flushPromise;
  this.flushPromise = this._doFlush();
  return this.flushPromise;
}

private async _doFlush(): Promise<void> {
  const text = this.buffer.trim();
  if (!text) { this.flushPromise = undefined; return; }
  this.buffer = "";
  if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
  try {
    // ... post to Slack (existing logic)
  } finally {
    this.flushPromise = undefined;
    if (this.buffer.trim()) await this.flush();
  }
}
```

#### Issue R3-2 (Must Fix): Eager import of Slack adapter in `main.ts`

**Location:** `main.ts:9`
**Problem:** `import { SlackAdapter } from './adapters/slack/adapter.js'` is a static top-level import. This loads `@slack/bolt` and all dependencies on startup even when Slack is disabled. Discord adapter uses lazy `await import()` at `main.ts:100`.
**Fix:** Change to dynamic import matching Discord pattern:

```typescript
// Remove static import at top
// In the registration block:
} else if (channelName === 'slack') {
  const { SlackAdapter } = await import('./adapters/slack/adapter.js')
  const slackConfig = channelConfig as import('./adapters/slack/types.js').SlackChannelConfig
  core.registerAdapter('slack', new SlackAdapter(core, slackConfig))
}
```

Keep static `import type { SlackChannelConfig }` if needed (types are erased at runtime).

#### Issue R3-3 (Must Fix): `notifyChannel(channelId, text)` ignores the `channelId` parameter

**Location:** `channel-manager.ts:59-66`
**Problem:** The `channelId` parameter is completely ignored — always posts to `this.config.notificationChannelId`. Misleading API signature.
**Fix:** Remove the unused `channelId` parameter from both the interface and implementation. Update all call sites.

```typescript
// Interface
notifyChannel(text: string): Promise<void>;

// Implementation
async notifyChannel(text: string): Promise<void> {
  if (this.config.notificationChannelId) {
    await this.queue.enqueue("chat.postMessage", {
      channel: this.config.notificationChannelId,
      text,
    });
  }
}
```

#### Issue R3-4 (Should Fix): Permission buttons have no cleanup on session end

**Location:** `permission-handler.ts`, `adapter.ts:deleteSessionThread`
**Problem:** If a user never clicks Allow/Deny and the session is destroyed, stale buttons remain in Slack with no handler.
**Fix:** Track posted permission message timestamps in `SlackPermissionHandler`. Add `cleanupSession(channelId)` that edits pending messages to replace buttons with "Session ended" text. Call from `deleteSessionThread` before archiving.

```typescript
// permission-handler.ts — new tracking
private pendingMessages = new Map<string, { channelId: string; messageTs: string }>();

// In register(), capture ts from sendPermissionRequest result
// New method:
async cleanupSession(channelId: string): Promise<void> {
  for (const [requestId, msg] of this.pendingMessages) {
    if (msg.channelId === channelId) {
      await this.queue.enqueue("chat.update", {
        channel: msg.channelId, ts: msg.messageTs,
        text: "⏹ Session ended — permission request cancelled", blocks: [],
      });
      this.pendingMessages.delete(requestId);
    }
  }
}
```

#### Issue R3-5 (Should Fix): `(message as any)` casts in `event-router.ts`

**Location:** `event-router.ts:42-56`
**Problem:** Every field access uses `(message as any)`. Slack Bolt provides typed event payloads.
**Fix:** Define a local interface and cast once:

```typescript
interface SlackMessageEvent {
  bot_id?: string;
  subtype?: string;
  channel: string;
  text?: string;
  user?: string;
  files?: Array<{ id: string; name: string; mimetype: string; size: number; url_private: string }>;
}

// In register():
const msg = message as unknown as SlackMessageEvent;
```

#### Issue R3-6 (Should Fix): `_createStartupSession` accumulates orphan channels

**Location:** `adapter.ts:195-217`
**Problem:** Every restart creates a new private channel. No reuse logic. Channels accumulate over time.
**Fix:** Follow Telegram's `ensureTopics()` pattern — save `startupChannelId` to config, reuse on restart:

1. Add `startupChannelId?: string` to `SlackChannelConfig` schema (optional, persisted)
2. On startup (`autoCreateSession !== false`):
   - If `startupChannelId` in config → check channel alive via `conversations.info`
   - If alive → reuse (create session pointing to existing channel)
   - If archived → unarchive via `conversations.unarchive`
   - If missing/deleted → create new, save to config via `configManager.save()`

#### Issue R3-7 (Minor): `slack-voice.test.ts` duplicates `isAudioClip` logic

**Location:** `slack-voice.test.ts`, `adapter.ts:159-162`
**Problem:** Test reimplements detection logic — fragile if real implementation changes.
**Fix:** Move `isAudioClip` to `utils.ts` as an exported function. Test imports directly from there.

#### Issue R3-8 (Minor): `send-queue.test.ts` only has 2 tests

**Location:** `send-queue.test.ts`
**Problem:** No verification of rate-limiting behavior or queue independence.
**Fix:** Add tests for: (a) multiple rapid calls to same method are rate-limited, (b) different methods have independent queues, (c) FIFO ordering preserved.

#### Issue R3-9 (Minor): `name_taken` retry only attempts once

**Location:** `channel-manager.ts:29-39`
**Problem:** Current code retries once on `name_taken`. A second collision throws.
**Fix:** Wrap in retry loop (max 3 attempts). Each iteration calls `toSlug()` which generates a new nanoid suffix.

```typescript
async createChannel(sessionId: string, sessionName: string): Promise<SlackSessionMeta> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = toSlug(sessionName, this.config.channelPrefix ?? "viben");
    try {
      const res = await this.queue.enqueue<{ channel: { id: string } }>(
        "conversations.create", { name: slug, is_private: true },
      );
      // ... invite users ...
      return { channelId: res.channel.id, channelSlug: slug };
    } catch (err: any) {
      if (err?.data?.error === "name_taken" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("Failed to create channel after 3 attempts");
}
```
