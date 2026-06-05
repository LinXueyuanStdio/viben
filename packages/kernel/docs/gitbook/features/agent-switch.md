# Agent Switch

## What it is

Agent switch lets you change which AI agent is handling your session mid-conversation, without losing context. You start a conversation with one agent, then switch to another — the new agent receives the full conversation history and picks up where the previous one left off.

The thread or topic in your messaging platform stays the same. Only the agent handling the conversation changes.

---

## Use cases

- You are using Claude Code for a task and want to compare how Gemini CLI approaches the same problem.
- Your current agent is slow or hitting rate limits and you want to temporarily switch to another.
- You want to use a specialized agent for a sub-task, then return to your primary agent.

---

## Usage

Run `/switch` inside an existing session topic or thread:

```
/switch                        # show a menu of available agents
/switch claude                 # switch directly to the claude agent
/switch gemini                 # switch directly to the gemini agent
```

When you run `/switch <agent>`, Viben:

1. Collects the conversation history from the current session.
2. Starts a new session with the target agent (or resumes an existing one — see below).
3. Injects the conversation history into the new agent as context.
4. Routes all subsequent messages to the new agent.

---

## Session resume

If you switch back to an agent you used earlier in the same thread, and no new user prompts were sent since you last left that agent, Viben will attempt to resume the old session rather than creating a new one. This avoids redundant context injection and preserves any in-progress agent state.

Resume only applies when the agent supports it via ACP. If the agent does not support resume, a new session is always created with history injected.

---

## History labels

When conversation history is injected into the new agent, Viben can prefix each assistant message with the name of the agent that produced it. This helps the incoming agent distinguish between its own prior responses and those from a different model.

Labels are enabled by default. To toggle:

```
/switch label on               # enable agent name labels (default)
/switch label off              # disable agent name labels
```

This setting is also controlled by the `agentSwitch.labelHistory` config option:

```json
{
  "agentSwitch": {
    "labelHistory": true
  }
}
```

With labels enabled, injected history looks like:

```
[claude] Here is the refactored function...
[gemini] I would approach it differently...
```

With labels disabled, the history is injected as-is without any prefixes.

---

## Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `agentSwitch.labelHistory` | boolean | `true` | Prefix assistant messages in injected history with the agent name |

Configure via `<instance-root>/config.json` or the `/settings` command.

---

## Platform support

| Platform | Supported |
|---|---|
| Telegram | Yes |
| Discord | Yes |
| Slack | Yes |

---

## Notes

- Only agents that are installed and ready can be switched to. Use `/agents` to check what is installed.
- The original session thread or topic is preserved across all switches.
- Switching does not cancel an in-progress prompt. If the current agent is actively running, cancel it first with `/cancel` before switching.
- When a switch is in progress, Viben emits a "Switching from A to B..." system message and `session:agentSwitch` events (`starting` / `succeeded` / `failed`) so UIs can show loading and error states while the switch is running.
