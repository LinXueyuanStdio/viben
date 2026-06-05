# Chat Commands

Viben responds to commands sent in your chat platform. This page covers every available command, how to use it, and which platforms support it.

## Platform comparison

| Command | Telegram | Discord | Notes |
|---|---|---|---|
| `/new` | Yes | Yes (`/new`) | Create a new agent session |
| `/newchat` | Yes | Yes | New chat, same agent and workspace |
| `/cancel` | Yes | Yes | Cancel current session prompt |
| `/status` | Yes | Yes | Show session or system status |
| `/sessions` | Yes | Yes | List all sessions |
| `/agents` | Yes | Yes | Browse installed and available agents |
| `/install` | Yes | Yes | Install an agent |
| `/menu` | Yes | Yes | Show interactive menu |
| `/resume` | Yes | No | Resume from Entire checkpoints |
| `/settings` | Yes | Yes | Change configuration in-chat |
| `/doctor` | Yes | Yes | Run system diagnostics |
| `/tunnel` | Yes | No | Create a public URL for a local port |
| `/tunnels` | Yes | No | List active tunnels |
| `/enable_bypass` | Yes | No | Auto-approve all permissions |
| `/disable_bypass` | Yes | No | Restore normal permission prompts |
| `/bypass` | No | Yes | Toggle bypass permissions (Discord) |
| `/text_to_speech` | Yes | No | Toggle TTS for a session |
| `/tts` | No | Yes | Toggle TTS (Discord) |
| `/outputmode` | Yes | Yes | Set output detail level (replaces `/verbosity`) |
| `/verbosity` | Yes | Yes | Deprecated — use `/outputmode` instead |
| `/usage` | Yes | No | View token usage and cost |
| `/archive` | Yes | No | Archive a session topic |
| `/summary` | Yes | No | Generate an AI summary of a session |
| `/mode` | Yes | Yes | Switch agent mode (code, architect, etc.) |
| `/model` | Yes | Yes | Switch agent model |
| `/thought` | Yes | Yes | Toggle thinking/reasoning mode |
| `/dangerous` | Yes | Yes | Toggle dangerous/bypass permissions mode |
| `/switch` | Yes | Yes | Switch to a different agent mid-conversation |
| `/handoff` | Yes | Yes | Continue session in your terminal |
| `/integrate` | Yes | Yes | Manage agent integrations |
| `/restart` | Yes | Yes | Restart Viben |
| `/update` | Yes | Yes | Update to latest version |
| `/clear` | Yes | Yes | Clear assistant history |
| `/help` | Yes | Yes | Show help text |

---

## Command reference

### `/new [agent] [workspace]`

Create a new agent session. If you omit arguments, Viben walks you through an interactive picker: choose your agent, then your project directory.

```
/new                          # interactive picker
/new claude                   # pick workspace interactively
/new claude ~/code/my-project # create directly
```

On Telegram, each session gets its own topic. On Discord, a new thread is created in the configured channel.

### `/newchat`

Start a fresh conversation with the same agent and workspace as the current session. Run this inside an existing session topic or thread. Useful when you want a clean context without changing your setup.

### `/cancel`

Abort the currently running prompt. The session stays active — you can send another message immediately. Run this inside a session topic or thread.

### `/status`

Show status for the current session (when run inside a session topic) or a system-wide summary of all sessions (when run in the main chat).

Session status includes: name, agent, status, workspace path, and queue depth.

### `/sessions`

List all sessions with their status and names. On Telegram, this also provides cleanup buttons to remove finished, errored, or all sessions.

### `/agents`

Browse installed and available agents. Installed agents are shown first, then the full registry with install buttons. The registry is paginated six entries at a time.

### `/install <name>`

Install an agent by name.

```
/install claude
/install gemini
```

Progress updates appear in-line. After installation, a button lets you start a session with the new agent immediately. If post-install setup steps are needed (e.g. API key configuration), they appear as copyable commands.

### `/menu`

Display an interactive inline keyboard with quick access to: New Session, Sessions, Status, Agents, Settings, Integrate, Restart, Update, Help, and Doctor.

### `/resume` (Telegram only)

Resume a session with conversation history loaded from Entire checkpoints. Supports multiple query formats:

```
/resume                                    # latest 5 sessions
/resume pr 19                              # by pull request number
/resume branch main                        # by branch name
/resume commit e0dd2fa4                    # by commit hash
/resume f634acf05138                       # by checkpoint ID
/resume https://entire.io/gh/.../...       # by Entire URL
/resume https://github.com/org/repo/pull/19
```

After the query, a workspace picker lets you choose which repository to load context from.

### `/settings`

Open an interactive settings panel. Toggle and select configuration values without editing config files. Some changes take effect immediately; others require a restart. Changes that need a restart show a notification.

### `/doctor`

Run system diagnostics. Checks configuration, agent dependencies, disk access, and connectivity. Results are shown inline with pass/warn/fail status. Fixable issues show a "Fix" button.

### `/tunnel <port> [label]` (Telegram only)

Create a public HTTPS URL for a local port. Useful when an agent starts a dev server and you need to access it from outside.

```
/tunnel 3000
/tunnel 3000 my-app
/tunnel stop 3000
```

### `/tunnels` (Telegram only)

List all active tunnels with their public URLs and stop buttons.

### `/enable_bypass` / `/disable_bypass` (Telegram) · `/bypass` (Discord)

Toggle bypass permissions for the current session. When enabled, all permission requests are auto-approved without showing buttons. Run inside a session topic. See [Permissions](permissions.md) for details.

### `/text_to_speech [on|off]` (Telegram) · `/tts [on|off]` (Discord)

Toggle text-to-speech for the current session. Without an argument, enables TTS for the next message only. With `on`, enables persistently. With `off`, disables.

### `/outputmode low|medium|high`

Set how much detail Viben shows for agent activity. Supports a 3-level cascade: session override → adapter default → global default.

```
/outputmode low              # set adapter default to low
/outputmode high             # set adapter default to high
/outputmode reset            # reset adapter default to global default
/outputmode session high     # override for the current session only
/outputmode session reset    # clear the session override
```

- `low` — compact icon grid (minimal noise)
- `medium` — tool titles, descriptions, output summaries (default)
- `high` — full inline output, plan list, viewer links for long results, thinking viewer link

On Discord, an action row with `[🔇 Low] [📊 Medium] [🔍 High] [❌ Cancel]` buttons appears below the tool card while the agent is working, so you can switch mode without typing a command.

### `/verbosity low|medium|high` (deprecated)

Alias for `/outputmode`. Use `/outputmode` instead.

### `/usage [today|week|month]` (Telegram only)

Show a token usage and cost report. Without arguments, shows today, this week, and this month. Pass a period to see just that range.

### `/archive` (Telegram only)

Archive the current session: stops the agent, marks the session as cancelled, and permanently deletes the Telegram topic. This cannot be undone.

### `/summary` (Telegram only)

Ask the agent to summarize what it has accomplished in the current session. Works inside a session topic.

### `/mode [mode-name]`

Switch the agent's operating mode. Without an argument, shows a menu of available modes declared by the agent (e.g., `code`, `architect`, `ask`).

```
/mode                          # show available modes
/mode code                     # switch to code mode
/mode architect                # switch to architect mode
```

Available modes depend on the agent — they are declared via the ACP config options protocol.

### `/model [model-name]`

Switch the agent's model. Without an argument, shows available models.

```
/model                         # show available models
/model claude-sonnet           # switch to a specific model
```

### `/thought [on|off]`

Toggle the agent's thinking/reasoning mode. When enabled, the agent shows its reasoning process.

```
/thought                       # toggle thinking mode
/thought on                    # enable thinking
/thought off                   # disable thinking
```

### `/dangerous [on|off]`

Toggle dangerous/bypass permissions mode for the current session. When enabled, the agent can perform destructive operations without confirmation prompts. This is equivalent to `/bypass` but routed through the agent's config options when available.

```
/dangerous                     # toggle dangerous mode
/dangerous on                  # enable (auto-approve all permissions)
/dangerous off                 # disable (restore normal prompts)
```

### `/switch [agent-name | label on|off]`

Switch to a different agent mid-conversation. The current conversation history is injected into the new agent so context is preserved.

```
/switch                        # show a menu of available agents
/switch claude                 # switch directly to the claude agent
/switch gemini                 # switch directly to the gemini agent
/switch label on               # enable agent name labels in history during switches
/switch label off              # disable agent name labels
```

If you switch back to a previously used agent without having sent any user prompts in the current session, the old session is resumed (if the agent supports resume). Otherwise a new session is created with the conversation history injected.

The session thread or topic remains the same across all switches — only the agent handling the conversation changes.

See [Agent Switch](../features/agent-switch.md) for the full feature guide.

### `/handoff`

Generate a terminal command to continue the current session in your local terminal. The agent session ID is included so context is preserved.

### `/integrate`

Manage agent integrations — for example, installing the handoff integration that lets you resume sessions from the terminal.

### `/restart`

Restart Viben. Use this after configuration changes that cannot be hot-reloaded, or when something is stuck.

### `/update`

Check for a newer version and update in place. Viben restarts automatically after a successful update.

### `/clear`

Reset the assistant session history. Only works in the Assistant topic on Telegram.

### `/help`

Show a quick-reference help message.
