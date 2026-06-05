# Context & Resume

## What it is

When you start a new coding session, the agent has no memory of what happened in previous sessions. The context resume feature solves this by injecting a structured summary of past conversations — what you asked, what the agent did, which files it touched — directly into the new session's context window.

This lets you continue work naturally. The agent knows the history without you having to re-explain the project, the decisions already made, or the state of in-progress tasks.

---

## How it works

When you resume a session, Viben collects conversation history from your previous sessions — what you asked, what the agent did, and which files were changed. This history is formatted as a summary and injected into the new session so the agent has full context.

Viben automatically records conversation history for every session. It captures your prompts, the agent's responses, tool calls, file edits, and permission decisions. History is stored locally in `<instance-root>/history/`, one file per session.

When multiple past sessions are relevant, history is merged chronologically. Viben automatically adjusts the level of detail based on how many sessions are included — recent sessions get full detail, older ones get shorter summaries. If the combined history is too large, the oldest sessions are trimmed first.

### Entire.io support

Viben can also read conversation history from [Entire.io](https://entire.io) git checkpoints. This is used as a fallback when local history is not available.

---

## Technical details

Under the hood, the `ContextManager` maintains a list of registered context providers. Two are built in:

- **HistoryProvider** — records conversation history directly within Viben via middleware hooks (`agent:beforePrompt`, `agent:afterEvent`, `permission:afterResolve`).
- **EntireProvider** — reads conversation history from Entire.io git checkpoints.

Results are cached on disk at `<instance-root>/cache/entire/` so that repeated requests for the same query do not re-read and re-parse transcript files. Providers are pluggable — plugins can register custom context providers.

---

## Adaptive rendering modes

Conversation history can be long. To avoid consuming the entire context window, Viben automatically selects a rendering mode based on how many conversation turns are included:

| Mode | Turns | What is included |
|------|-------|-----------------|
| `full` | up to 10 | Full text of all user messages and assistant responses; full diffs and file writes |
| `balanced` | 11 to 25 | User messages in full; diffs truncated to 12 lines; file writes truncated to 15 lines |
| `compact` | more than 25 | User messages in full; edits shown as a one-line summary with line counts; writes shown as filename and line count only |

If the history is still too large after switching to `compact` mode, the oldest sessions are dropped until it fits.

A note is always appended reminding the agent that the history may be outdated and should not be taken as ground truth for current file contents.

---

## /resume command

Send `/resume` in any session topic to attach context from recent sessions to your next prompt. The command accepts the same query types as the provider:

```
/resume                          # Latest 5 sessions (default)
/resume branch main              # All sessions on branch main
/resume pr 42                    # Sessions for PR #42
/resume latest 10                # Latest 10 sessions
/resume session sess_abc123      # A specific session
```

The injected context appears as a collapsible block above your message so you can verify what was included before the agent processes it.

---

## Token estimation

Token counts are estimated as `floor(characters / 4)`, which approximates GPT-style tokenization. This estimate is used both to select the rendering mode and to decide whether to truncate. The estimate is intentionally conservative — actual token counts vary by model and content type.

To see how many tokens a context block would consume before sending, use:

```
/resume --dry-run branch main
```

This reports the session count, turn count, rendering mode, and estimated token count without attaching the context.
