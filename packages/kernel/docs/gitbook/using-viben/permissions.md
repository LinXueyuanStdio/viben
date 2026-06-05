# Permissions

AI agents sometimes need to perform actions that could have side effects — running shell commands, writing files, making network requests, or modifying system state. Viben gates these actions with explicit permission requests so you stay in control.

## Why permissions exist

Agents operating autonomously can take actions with real consequences: deleting files, pushing code, installing packages, or calling external APIs. Permissions give you a checkpoint before anything consequential happens. You decide whether to allow or deny each action before the agent proceeds.

## How permission requests work

When an agent needs to perform a gated action, it sends a permission request to Viben. Viben forwards this to your chat as an inline keyboard message:

1. A description of the action the agent wants to take appears in the session topic
2. Buttons show the available options — typically "Allow" and "Deny", but some agents offer additional choices
3. Tap a button to respond
4. The agent receives your decision and continues (or stops)

The agent is paused while waiting for your response. No further processing happens until the permission is resolved.

## Timeout

If you do not respond to a permission request within **10 minutes**, it is automatically denied. The agent receives a rejection and the action does not proceed. You can then send a new message to continue working.

This timeout exists to prevent sessions from blocking indefinitely when you are not present.

## Bypass permissions

If you trust the agent completely for a session and do not want to approve each action individually, you can enable bypass permissions:

**Telegram:**
```
/enable_bypass   # enable auto-approval
/disable_bypass  # restore normal prompts
```

**Via the session control keyboard:** Tap the "Enable Bypass Permissions" button that appears in the session setup message.

When bypass permissions is on, all permission requests are auto-approved immediately without showing buttons. The session topic shows a warning.

Bypass permissions is **per-session** — it does not affect other sessions and resets when the session ends.

Use this only when you have reviewed the agent's plan and are confident in what it will do. Common use case: running a long automated task where interruptions for permission approval would be impractical.

## Reviewing what was approved

Permission approvals are logged. Use `/status` to see the current session state, or check the session topic history to review what was approved during a session.

For server-wide access controls (user allowlists, session limits), see [Security](../self-hosting/security.md).

## Disabling bypass permissions

Run `/disable_bypass` (Telegram) or `/bypass` (Discord) inside the session topic, or tap the "Disable Bypass Permissions" button in the session control keyboard.

Normal permission prompts resume immediately.
