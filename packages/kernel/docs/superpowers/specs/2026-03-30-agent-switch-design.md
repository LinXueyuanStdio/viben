# Agent Switch — Design Spec

> Switch agents mid-session while preserving conversation context and session continuity.

## Overview

Allow users to switch between agents (e.g., Claude → Gemini) within the same Viben session. The system session remains intact — same session ID, same platform thread — only the underlying agent instance is swapped. Conversation history is injected into the new agent so it has full context.

When switching back to a previously used agent, the system can **resume** that agent's session if no user prompts were sent during the interim agent's turn and the agent supports resume. Otherwise, a new agent session is created with history injection.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Old agent subprocess | Kill immediately on switch | ACP `unstable_resumeSession` re-spawns when needed; saves resources |
| History scope | Full history with optional agent labels | New agent needs complete context; labels are configurable |
| Resume condition | `promptCount === 0` + agent supports resume | Only system messages (context injection, welcome) don't count; user prompts do |
| Prompt counting | Exclude first context injection prompt | System-generated messages don't indicate user interaction |
| In-flight prompt handling | Confirm with user before cancel | Prevent accidental data loss |
| Architecture approach | Session-level switch (swap agent instance in place) | Simplest; session ID + thread unchanged; good foundation for future fork |
| Command UX | `/switch` (menu) + `/switch <agent>` (direct) | Power users use direct, casual users use menu |
| Label setting | Both config + `/switch label on/off` | Accessible from both places |
| Middleware hooks | `agent:beforeSwitch` (blocking) + `agent:afterSwitch` (fire-and-forget) | Sufficient for security, usage tracking, etc. |

## Data Model

### SessionRecord extensions

```typescript
interface AgentSwitchEntry {
  agentName: string;
  agentSessionId: string;
  switchedAt: string;        // ISO timestamp
  promptCount: number;       // user prompts only (excludes system messages)
}

interface SessionRecord {
  // ... existing fields ...
  firstAgent: string;                     // agent used when session was created
  currentPromptCount: number;             // prompt count for current agent turn (persisted for restart recovery)
  agentSwitchHistory: AgentSwitchEntry[]; // newest entry at end
}
```

### Backward compatibility

- `firstAgent`: defaults to current `agentName` for existing sessions
- `agentSwitchHistory`: defaults to `[]` for existing sessions
- Old sessions without these fields continue working unchanged

### Resumable (derived at runtime)

```typescript
function canResume(entry: AgentSwitchEntry, agentDef: AgentDefinition): boolean {
  return entry.promptCount === 0 && agentDef.supportsResume;
}
```

## Switch Flow

### Happy path: Claude → Gemini (new session)

```
1. User sends /switch gemini
2. Check prompt in-flight → if yes, confirm "Cancel and switch?" [Yes] [No]
3. Middleware: agent:beforeSwitch (plugins can block)
4. Save current agent to switchHistory: {claude, sessionId, timestamp, promptCount}
5. Destroy current AgentInstance (kill subprocess)
6. Context plugin builds full history (with/without agent labels per setting)
7. AgentManager.spawn("gemini", workingDir)
8. Session.setContext(history) — inject into new agent
9. Rewire SessionBridge: disconnect old → connect new
10. Session.activate()
11. Update SessionRecord: agentName="gemini", agentSessionId=new
12. Reset promptCount = 0
13. Middleware: agent:afterSwitch
14. Adapter sends: "Switched to gemini (new session)"
```

### Switch back with resume: Gemini → Claude

```
1. Find last entry for "claude" in switchHistory
2. Check: entry.promptCount === 0 AND claude supports resume?
3. YES → AgentManager.resume("claude", workingDir, entry.agentSessionId)
   - No history injection needed (agent already has context)
4. Adapter sends: "Switched to claude (resumed)"
```

### Switch back without resume: Gemini → Claude

```
1. Find last entry for "claude" in switchHistory
2. Check: entry.promptCount > 0 OR claude doesn't support resume
3. → AgentManager.spawn("claude", workingDir)
4. → Inject full history
5. Adapter sends: "Switched to claude (new session)"
```

## Session & Bridge Rewiring

### Session.switchAgent()

```typescript
async switchAgent(agentName: string): Promise<void> {
  // 1. Save current agent state to switchHistory
  this.addSwitchEntry(this.agentName, this.agentSessionId, this.promptCount);

  // 2. Disconnect bridge from old agent
  this.bridge.disconnect();

  // 3. Destroy old agent
  await this.agentInstance.destroy();

  // 4. Determine: resume or new session?
  const lastEntry = this.findLastEntry(agentName);
  const resume = lastEntry
    && lastEntry.promptCount === 0
    && agentSupportsResume(agentName);

  // 5. Spawn or resume new agent
  if (resume) {
    this.agentInstance = await AgentManager.resume(
      agentName, this.workingDir, lastEntry.agentSessionId
    );
  } else {
    this.agentInstance = await AgentManager.spawn(agentName, this.workingDir);
    const history = await contextPlugin.buildHistory(this, {
      labelAgent: this.labelSetting,
    });
    this.setContext(history);
  }

  // 6. Update session fields
  this.agentName = agentName;
  this.agentSessionId = this.agentInstance.sessionId;
  this.promptCount = 0;

  // 7. Reconnect bridge
  this.bridge.connect(this.agentInstance);

  // 8. Persist
  await this.store.save(this.toRecord());
}
```

### Bridge disconnect/connect

`SessionBridge` supports reconnection without creating a new bridge instance:

- `disconnect()` — remove all event listeners from old agent instance
- `connect(newAgentInstance)` — wire event listeners to new agent instance
- Session ID, thread, adapter reference remain unchanged

### Rollback on failure

```
If spawn/resume of new agent fails:
  → Re-spawn old agent (using agentSessionId from entry just saved)
  → Remove last entry from switchHistory
  → Reconnect bridge to old agent
  → Notify user: "Failed to switch, rolled back to <oldAgent>"

If rollback also fails:
  → Session transitions to `error` status
  → User must create new session or retry
```

## Command & UX

### `/switch` command

```
/switch              → Show menu with available agents
/switch <agentName>  → Switch directly to that agent
/switch label on     → Enable agent name labels in history
/switch label off    → Disable agent name labels in history
```

### Menu (no argument)

Shows all installed agents except the currently active one, one per row:

```
Switch Agent

[claude]
[gemini]
[codex]
```

### User-facing messages

| Situation | Message |
|-----------|---------|
| Switch success (new) | `Switched to gemini (new session)` |
| Switch success (resume) | `Switched to claude (resumed)` |
| Prompt in-flight | `Agent is responding. Cancel and switch?` + [Yes] [No] |
| Agent not installed | `Agent "xyz" is not installed` |
| Already using agent | `Already using claude` |
| Switch failed | `Failed to switch to gemini: <reason>` |
| Rollback after failure | `Rolled back to claude` |

### Label setting

Configurable via:
- `/switch label on/off` (per-session shortcut)
- Global config setting (default for new sessions)

## Middleware Hooks

### agent:beforeSwitch (blocking)

```typescript
interface BeforeSwitchPayload {
  session: Session;
  fromAgent: string;
  toAgent: string;
}
// Plugin returns false or throws → switch is blocked
```

### agent:afterSwitch (fire-and-forget)

```typescript
interface AfterSwitchPayload {
  session: Session;
  fromAgent: string;
  toAgent: string;
  resumed: boolean;  // true if resumed, false if new session
}
```

## Context History Format

### With agent labels (`labelAgent = true`)

```markdown
[CONVERSATION HISTORY]

## [claude]
**User:** Help me write a sort function
**Assistant:** Here is the implementation...

## [gemini]
**User:** Optimize this
**Assistant:** Optimized version...

[END CONVERSATION HISTORY]
```

### Without agent labels (`labelAgent = false`)

```markdown
[CONVERSATION HISTORY]

**User:** Help me write a sort function
**Assistant:** Here is the implementation...

**User:** Optimize this
**Assistant:** Optimized version...

[END CONVERSATION HISTORY]
```

### Context plugin changes

- `buildHistory()` adds option `labelAgent: boolean`
- Collects history from **all agent sessions** in switchHistory, merged chronologically
- Excludes system messages (context injection, welcome) — only user prompts and agent responses

## Edge Cases

| Case | Handling |
|------|----------|
| Rapid sequential switches (A→B→C) | Each switch goes through full flow; promptCount=0 recorded for each |
| Process restart mid-session | SessionRecord has switchHistory → lazyResume uses current agentName + agentSessionId; promptCount restored from record |
| Agent uninstalled after switch | Switch back → "Agent not installed", user must reinstall |
| Switch history grows long | No hard limit; context plugin may truncate old history based on token budget |
| Rollback also fails | Session → `error` status; user creates new session or retries |
| Adopt session then switch | Works normally — `originalAgentSessionId` preserved, switchHistory tracks separately |
| Switch to same agent | "Already using <agent>" — no-op |
| Session in `error` status | Switch allowed — new agent may resolve the issue |

## Future: Fork Session

The data model supports future fork functionality:

- `agentSwitchHistory` is a complete timeline — exact timestamps, agents, prompt counts
- Fork = create new session, copy switchHistory up to a checkpoint, continue independently
- Future field: `forkedFrom: { sessionId: string, switchIndex: number }` — points to source session and position in history

Fork is **not** implemented in this spec. The data model is designed to not block it.
