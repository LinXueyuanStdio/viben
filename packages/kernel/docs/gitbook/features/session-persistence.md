# Session Persistence

## Sessions survive restarts

When you stop and restart Viben, your sessions are not lost. Viben saves session records to disk as they are created and updated, so everything — session names, which agent was running, which Telegram topic or Discord thread they belonged to — is restored automatically on restart.

You can continue sending messages to an existing session topic after a restart. Viben reconnects to the agent process if it is still alive, or starts a new agent session linked to the same topic.

---

## What happens after a restart

1. Viben reloads all saved sessions and restores them in your messaging app.
2. Sessions that were active before the restart appear in their previous state.
3. Sending a new message in an existing session topic reconnects to the agent automatically.
4. If the agent process did not survive the restart, the session shows an error notification. You can create a new session or use `/resume` to continue with history attached.

---

## Automatic cleanup

Old session records are cleaned up automatically. By default, sessions that have not been active for **30 days** are removed. Active sessions are never cleaned up regardless of age.

You can configure the retention period in the instance `config.json`:

```json
{
  "sessionStore": {
    "ttlDays": 30
  }
}
```

---

## Technical details

Session records are stored in `<instance-root>/sessions.json`. Each record stores:

| Field | Description |
|-------|-------------|
| `sessionId` | Unique Viben session ID |
| `agentSessionId` | ID assigned by the agent subprocess |
| `channelId` | Which adapter owns this session (`telegram`, `discord`, etc.) |
| `agentName` | Name of the agent (e.g. `claude`, `gemini`) |
| `workingDirectory` | Filesystem path the agent is working in |
| `status` | `initializing`, `active`, `idle`, `finished`, `error` |
| `name` | Display name auto-assigned after the first prompt |
| `threadId` | Platform thread or topic ID |
| `createdAt` / `lastActiveAt` | Timestamps for session lifecycle |

Writes are debounced to avoid excessive disk I/O. The file is flushed on process exit to prevent data loss. If the file is unreadable on startup, Viben logs the error and starts with an empty session map rather than crashing.
