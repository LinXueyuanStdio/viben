# Agents

Agents are the AI processes that Viben connects you to. Each agent implements the Agent Client Protocol (ACP) and exposes a prompt interface. Viben manages spawning, communication, and lifecycle.

## Browsing available agents

Use `/agents` to see what is installed and what is available to install:

```
/agents
```

The response has two sections:

- **Installed** — agents ready to use, with a checkmark
- **Available to install** — agents from the registry, with install buttons

The available list is paginated (6 per page) with Prev/Next navigation. Agents marked with a warning icon have unmet dependencies — tap the warning to see what is missing.

The registry is fetched from `cdn.agentclientprotocol.com` and cached locally for 24 hours.

## Installing an agent

From the `/agents` list, tap the install button next to any agent. Or use the command directly:

```
/install claude
/install gemini
/install codex
```

Progress updates appear in-line as the installation runs — downloading, extracting, configuring. After success, a button lets you start a session with the new agent immediately.

Some agents require additional setup after installation. Setup steps appear as copyable commands, for example:

```
Install Claude CLI: npm install -g @anthropic-ai/claude-code
Login: claude login (opens browser)
```

## Uninstalling an agent

Agents can be uninstalled from the CLI (see [CLI Commands](../api-reference/cli-commands.md) for the full command reference):

```
viben agents uninstall <name>
```

This removes the agent's binary and configuration from `~/.viben/agents/`. Any existing sessions using that agent are not affected until they end.

## Switching agent per session

Pass the agent name to `/new` to use a specific agent for a session:

```
/new claude
/new gemini ~/code/my-project
```

If you have only one agent installed, it is selected automatically.

## Switching agents mid-conversation

Use `/switch` to change the agent handling the current session without starting a new thread or topic:

```
/switch                        # show a menu of available agents
/switch claude                 # switch directly to the claude agent
/switch gemini                 # switch directly to the gemini agent
```

The conversation history from the current session is automatically injected into the new agent, so it has full context of what was discussed. If you switch back to a previously used agent without having sent any new user prompts since the last switch, the old session is resumed (provided the agent supports resume). Otherwise a new session is started with the history prepended.

To label messages in the history with the agent name that produced them, use:

```
/switch label on               # enable agent name labels
/switch label off              # disable agent name labels
```

This is controlled globally by the `agentSwitch.labelHistory` config option (default: `true`).

For full details see [Agent Switch](../features/agent-switch.md).

## Default agent

The default agent is used when you create a session without specifying one. Configure it in `<instance-root>/config.json` (e.g. `~/viben-workspace/.viben/config.json`):

```json
{
  "defaultAgent": "claude"
}
```

Or use `/settings` to change it in-chat.

## Agent types

Agents are distributed in four ways:

| Type | Description | Example |
|---|---|---|
| `npx` | Runs via Node.js package runner | `npx @anthropic-ai/claude-code` |
| `uvx` | Runs via Python package runner (uv) | `uvx goose` |
| `binary` | Platform-specific binary download | `codex` |
| `custom` | User-defined command and arguments | Any local tool |

Viben detects which distribution method is appropriate for your platform and handles installation automatically. If a required runtime (`node`, `npx`, `uv`, `uvx`) is missing, the agent shows as unavailable with an install hint.

## Popular agents

| Agent | Distribution | Notes |
|---|---|---|
| Claude (claude-code) | npx | Requires Anthropic API key or Claude login |
| Gemini CLI | npx | Requires Google AI API key |
| Codex CLI | binary | Requires OpenAI API key |
| Goose | uvx | Requires Python / uv |

Use `/agents` for the current full list — the registry is updated independently of Viben releases.

## Agent capabilities

Some agents declare capabilities that Viben uses to enable features:

- **Audio** — If an agent supports native audio input, voice attachments are passed directly rather than transcribed
- **Commands** — Agents can publish a list of slash commands that appear as skill shortcuts in the session topic

Capabilities are detected automatically when a session starts.

## Custom agents

You can add a custom agent directly to your config without going through the registry:

```json
{
  "agents": {
    "my-agent": {
      "command": "node",
      "args": ["/path/to/my-agent.js"],
      "workingDirectory": "~/code",
      "env": {
        "MY_API_KEY": "..."
      }
    }
  }
}
```

The agent must implement the ACP protocol to communicate with Viben.
