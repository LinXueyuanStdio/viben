# Assistant Mode

## What it is

Assistant mode is a dedicated agent session that runs in a special "Assistant" topic inside your Telegram forum group. Unlike regular coding sessions — where each topic is a direct line to a specific agent working on a specific project — the Assistant topic is a management interface. It understands your Viben setup and can create sessions, check status, cancel stuck sessions, manage configuration, install agents, and troubleshoot issues, all through natural language.

---

## The Assistant topic

When Viben starts with the Telegram adapter, it automatically creates (or finds an existing) "Assistant" forum topic. This happens before any user sessions are created.

On startup, the Assistant sends a welcome message summarizing the current state:

- Number of active and total sessions
- Installed agents and which is the default
- Any sessions in error state

A dedicated agent session is spawned for the Assistant topic using the configured `defaultAgent`. A system prompt is injected that gives the agent full awareness of Viben's current state: active session count, topic status breakdown, installed agents, available agents in the ACP Registry, workspace base directory, and STT configuration.

---

## Difference from regular sessions

| | Regular session | Assistant topic |
|---|---|---|
| Purpose | Work on a coding task | Manage Viben itself |
| Workspace | A specific project directory | Viben's workspace base directory |
| Auto-naming | Yes, after first prompt | Fixed name: "Assistant" |
| Commands available | Agent-specific | Full `viben api ...` command set |
| One per user | No, unlimited | Yes, one global Assistant |

The Assistant runs `viben api ...` commands silently and presents results as natural language. Users never see raw CLI output unless they ask for it.

---

## What you can ask the Assistant

- "Create a new session for my React app in `~/code/my-app`"
- "What sessions are currently running?"
- "Cancel the stuck session"
- "Clean up all finished topics"
- "Install the Gemini agent"
- "Set my monthly budget to $30"
- "Enable voice transcription with Groq"
- "Why is session X in error state?"
- "Restart the daemon"

---

## Configuration

The Assistant uses the `defaultAgent` from your config. No special configuration is needed. If you want to change which agent powers the Assistant, update `defaultAgent` in `<instance-root>/config.json`:

```json
{
  "defaultAgent": "claude"
}
```

The Assistant topic is created with `initialName: "Assistant"` to prevent the auto-naming system from renaming it based on the first message content.
