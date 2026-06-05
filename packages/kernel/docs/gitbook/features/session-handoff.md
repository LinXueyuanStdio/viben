# Session Handoff

## What it is

Session handoff lets you transfer a running agent session from your terminal to your phone (or any other device with Telegram or Discord), or in the other direction. You start a session in the terminal, realize you want to continue the conversation on the go, and hand it off to your messaging app with a single command.

No state is lost. The agent process keeps running; only the "owner" of the session changes from the terminal to the chat interface.

---

## Use case: terminal to phone

A typical flow:

1. You are working at your desk with Claude Code or OpenCode open in the terminal.
2. You need to step away but want to keep supervising the agent.
3. You run `viben integrate` (or trigger the `/viben:handoff` slash command from inside the agent).
4. The session appears as a new topic in your Telegram group or Discord server.
5. You continue sending prompts and approving permission requests from your phone.

---

## How to set up handoff

### Step 1: Install the integration

Run the integrate command and follow the prompts:

```bash
viben integrate
```

You will be asked which agent to integrate (Claude Code, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Cline, Codex, etc.). The command installs the needed integration so your agent can hand off sessions to Viben.

To uninstall later:

```bash
viben integrate --uninstall
```

### Step 2: Use the handoff command

Once integrated, you can hand off any session from your terminal to your messaging app:

```
/viben:handoff              # hand off to the default platform
/viben:handoff telegram     # hand off specifically to Telegram
/viben:handoff discord      # hand off to Discord
```

The session appears as a new topic in your Telegram group or Discord server. You can continue sending prompts and approving permission requests from your phone.

---

## Requirements

- The Viben daemon must be running (`viben start`) on the same machine as the terminal agent.
- At least one messaging adapter (Telegram, Discord, or Slack) must be configured and connected.
- `jq` is required only for hook-based integrations (Claude/Cursor/Gemini/Cline). OpenCode plugin integration does not require `jq`.

---

## Supported agents

Currently supported agents include Claude Code, OpenCode, Cursor, Gemini CLI, GitHub Copilot CLI, Cline, OpenAI Codex, and others. Run `viben integrate --list` to see the full list.

---

## Technical details

Most handoff integrations rely on two shell scripts installed by `viben integrate`:

- **Inject hook** (`viben-inject-session.sh`) — runs as an agent hook on every conversation turn, reads the agent's session ID from the hook payload, and injects it as a context variable.
- **Handoff script** (`viben-handoff.sh`) — calls `viben adopt <agent> <session_id>` to register the terminal session with the running Viben daemon, making it visible in the messaging platform.

For OpenCode, handoff is installed via a command + plugin pair under `~/.config/opencode/`:

- **Command** (`commands/viben-handoff.md`) — provides `/viben:handoff`.
- **Plugin** (`plugins/viben-handoff.js`) — injects current OpenCode session ID so the command can call `viben adopt opencode <session_id>`.

If OpenCode is started with `--pure`, plugins are disabled and session ID injection is unavailable. In this mode, `/viben:handoff` is not supported.
