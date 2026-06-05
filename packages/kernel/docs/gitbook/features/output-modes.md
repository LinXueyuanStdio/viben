# Output Modes

## What are output modes?

When your AI agent works on a task, it does many things behind the scenes: reading files, editing code, running commands, thinking through problems. Output modes let you choose **how much of that activity you want to see** in your chat.

Think of it like a camera zoom:

- **Zoomed out** (`low`) — you see the big picture only. The agent is working, and you will see the final result.
- **Normal view** (`medium`) — you see what the agent is doing at a glance: which files it is reading, what commands it is running, and short summaries of the results.
- **Zoomed in** (`high`) — you see everything: the agent's reasoning, full command output, complete file diffs, and detailed progress.

---

## The three modes

### Low — "Just tell me when it is done"

Best for: non-technical users, managers, or when you are on mobile and do not want chat noise.

What you see:
- A compact row of small icons showing the types of tools the agent is using (file, terminal, search, etc.)
- The agent's final text response

What you do not see:
- File names and contents
- Command output
- The agent's thinking process

### Medium — "Show me the highlights" (default)

Best for: most users, day-to-day coding.

What you see:
- Tool names and short descriptions ("Editing `src/app.ts`", "Running `npm test`")
- File names involved in each operation
- Short summaries of command output
- The agent's final text response

What you do not see:
- Full command output (available via viewer links when output is large)
- The agent's internal reasoning

### High — "Show me everything"

Best for: developers debugging issues, reviewing agent work in detail, or when you want to understand exactly what the agent is doing.

What you see:
- Everything from medium mode, plus:
- Full command output inline
- The agent's thinking/reasoning process
- Complete code diffs
- Detailed plan steps
- Links to the viewer for very large output

---

## Changing the output mode

### Quick change in chat

Type this in any chat where Viben is active:

```
/outputmode low
/outputmode medium
/outputmode high
```

This changes the default for all sessions on that platform (Telegram, Discord, or Slack).

To change it for **just the current session** (without affecting other sessions):

```
/outputmode session low
/outputmode session high
```

To go back to the default:

```
/outputmode reset              # reset the platform default
/outputmode session reset      # reset this session's override
```

### On Discord

While the agent is working, buttons appear below the activity card: **Low**, **Medium**, **High**. Tap one to switch instantly — no command needed.

### On Slack

Type `/outputmode` to open a settings panel where you can pick a mode with radio buttons and choose whether the change applies to just this session or all sessions.

---

## How defaults work

Output mode follows a simple priority rule — the most specific setting wins:

1. **This session** — if you set `/outputmode session high`, this session shows full detail.
2. **This platform** — if you set `/outputmode low` in Telegram, all Telegram sessions default to low (unless a session has its own override).
3. **Global default** — the fallback when nothing else is set. Default is `medium`.

**Example**: You set Telegram to `low` because you check it on your phone. Discord stays at `medium`. But for one tricky debugging session in Telegram, you set `/outputmode session high` to see everything. That session shows full detail while all other Telegram sessions stay quiet.

---

## Which mode should I use?

| Situation | Recommended mode |
|-----------|-----------------|
| Checking progress on your phone | `low` |
| Normal coding sessions | `medium` |
| Debugging why something failed | `high` |
| Sharing your screen with a non-technical audience | `low` |
| Reviewing what the agent changed before merging | `high` |
| Running many sessions simultaneously | `low` or `medium` |
