# Session Rename Persist & Resume Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure session name is persisted to store after auto-naming, and `skillMsgId` is persisted to platform data so neither is repeated on resume.

**Architecture:** Name persistence is handled by `renameSessionThread` → `updateSessionName()` (already done). `skillMsgId` needs to be added to `TelegramPlatformData`, persisted when created, restored on resume, and cleared on cleanup. Also need `getSessionRecord()` on `SessionManager` so the adapter can read platform data.

**Tech Stack:** TypeScript, existing `SessionManager`/`SessionStore`, `TelegramAdapter`

---

## Status

- [x] `SessionManager.updateSessionName()` added
- [x] `TelegramAdapter.renameSessionThread()` calls `updateSessionName()` — name now persisted on rename
- [ ] `SessionManager.getSessionRecord()` — needed by adapter to read platform data
- [ ] `TelegramPlatformData.skillMsgId` field
- [ ] Persist/restore/clear `skillMsgId` in adapter

---

### Task 1: Add `getSessionRecord` to SessionManager

**Files:**
- Modify: `src/core/session-manager.ts`

- [ ] **Step 1: Add method after `updateSessionName`**

```ts
getSessionRecord(sessionId: string): import("./types.js").SessionRecord | undefined {
  return this.store?.get(sessionId);
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: no errors

---

### Task 2: Add `skillMsgId` to `TelegramPlatformData`

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Add optional field**

```ts
export interface TelegramPlatformData {
  topicId: number;
  skillMsgId?: number;
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: no errors

---

### Task 3: Persist and restore `skillMsgId` in TelegramAdapter

**Files:**
- Modify: `src/adapters/telegram/adapter.ts`

- [ ] **Step 1: In `sendSkillCommands()`, restore `skillMsgId` from store if not in memory**

Add at the top of `sendSkillCommands()`, before the `if (commands.length === 0)` check:

```ts
// Restore skillMsgId from persisted platform data if not in memory (e.g. after restart)
if (!this.skillMessages.has(sessionId)) {
  const record = (this.core as VibenCore).sessionManager.getSessionRecord(sessionId);
  const platform = record?.platform as import("./types.js").TelegramPlatformData | undefined;
  if (platform?.skillMsgId) {
    this.skillMessages.set(sessionId, platform.skillMsgId);
  }
}
```

- [ ] **Step 2: In `sendSkillCommands()`, persist `skillMsgId` after creating a new pinned message**

After `this.skillMessages.set(sessionId, msg!.message_id);`, add:

```ts
// Persist skillMsgId so it survives restarts
const record = (this.core as VibenCore).sessionManager.getSessionRecord(sessionId);
if (record) {
  await (this.core as VibenCore).sessionManager.updateSessionPlatform(
    sessionId,
    { ...record.platform, skillMsgId: msg!.message_id },
  );
}
```

- [ ] **Step 3: In `cleanupSkillCommands()`, clear `skillMsgId` from platform data**

After `this.skillMessages.delete(sessionId);`, add:

```ts
// Clear persisted skillMsgId
const record = (this.core as VibenCore).sessionManager.getSessionRecord(sessionId);
if (record) {
  const { skillMsgId: _removed, ...rest } = record.platform as import("./types.js").TelegramPlatformData;
  await (this.core as VibenCore).sessionManager.updateSessionPlatform(sessionId, rest);
}
```

- [ ] **Step 4: Build and test**

Run: `pnpm build && pnpm test`
Expected: no errors, all tests pass

---

## Verification

Manual test checklist:
- [ ] Start a new session, send first message → topic renamed → restart bot → send another message → topic NOT renamed again, `~/.viben/sessions.json` shows `"name": "..."`
- [ ] Session with skill commands → restart bot → send a message → existing pinned message is edited, NOT a new one pinned
- [ ] End a session → `cleanupSkillCommands` fires → `skillMsgId` cleared from `sessions.json`
