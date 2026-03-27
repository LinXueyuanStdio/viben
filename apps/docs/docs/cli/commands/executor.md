---
sidebar_position: 7
title: "viben executor"
description: "Discover and view executors (Claude Code, Cursor, etc.)"
---

# viben executor

Discover and view executors. Executors are the coding agents that actually run Agents, such as Claude Code, Cursor, etc.

## Concept Overview

### What is an Executor?

An Executor is the underlying coding agent that runs an Agent. Viben assembles feature-rich Agents by configuring skills, prompts, MCP servers, etc. for these executors.

| Concept | Description | Examples |
|---------|-------------|----------|
| **Executor** | Underlying coding agent responsible for task execution | Claude Code, Cursor, Gemini CLI, Codex, Windsurf |
| **Agent** | Viben-configured agent instance based on an executor | `main` agent (based on Claude Code) |
| **Relationship** | Agent = Executor + Skills + Prompts + MCP + Memory | One executor can support multiple agents |

**Executor Responsibilities**:
- Receive user instructions
- Call LLM for reasoning
- Execute tool calls (code writing, file operations, etc.)
- Communicate with MCP servers

**Viben Responsibilities**:
- Discover locally installed executors
- Configure skills, prompts, MCP for executors
- Manage agent instances (based on executors)
- Provide unified configuration and memory management

## Supported Executors

| ID | Name | Description | Detection Method |
|----|------|-------------|------------------|
| `CLAUDE_CODE` | Claude Code | Anthropic official CLI | `claude --version` |
| `CURSOR` | Cursor | AI-first editor | `cursor --version` |
| `GEMINI_CLI` | Gemini CLI | Google Gemini CLI | `gemini --version` |
| `CODEX` | OpenAI Codex | OpenAI Codex CLI | `codex --version` |
| `WINDSURF` | Windsurf | Codeium IDE | `windsurf --version` |
| `AMP` | Amp | Sourcegraph Amp | `amp --version` |
| `OPENCODE` | OpenCode | Open source coding agent | `opencode --version` |
| `QWEN_CODE` | Qwen Code | Alibaba Qwen coding agent | `qwen-code --version` |
| `AIDER` | Aider | AI pair programming | `aider --version` |
| `CONTINUE` | Continue | IDE plugin | `continue --version` |

## Commands

```bash
# ============================================================
# Executor Discovery (Discovery Only)
# ============================================================

# List supported executor types
viben executor types
viben executor types --json

# List all discovered executors (with installation status)
viben executor list
viben executor list --json

# View specific executor details
viben executor show -n <executor-id>
viben executor show -n CLAUDE_CODE
viben executor show -n CURSOR --json

# ============================================================
# Executor Chat (Non-interactive execution)
# ============================================================

# Basic usage
viben executor chat -n CLAUDE_CODE -p "Analyze this code"

# Read from stdin
echo "Write a sorting function" | viben executor chat -n CLAUDE_CODE

# JSON stream input/output (for programmatic calls)
viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# Resume session
viben executor chat -n CLAUDE_CODE -p "Continue" --resume <session-id>
```

:::note
Discovery functionality does not implement installation; users should install via each executor's official channels.
:::

## Output Examples

**`viben executor types` (Human-readable):**

```
TYPE          DESCRIPTION
------------  -----------------------
CLAUDE_CODE   Claude Code (Anthropic)
AMP           Amp
GEMINI        Gemini CLI (Google)
CODEX         Codex CLI (OpenAI)
OPENCODE      Opencode
CURSOR_AGENT  Cursor Agent
QWEN_CODE     Qwen Code (Alibaba)
COPILOT       GitHub Copilot
DROID         Droid
```

**`viben executor types --json`:**

```json
{
  "success": true,
  "data": {
    "types": [
      { "id": "CLAUDE_CODE", "name": "Claude Code (Anthropic)" },
      { "id": "AMP", "name": "Amp" },
      { "id": "GEMINI", "name": "Gemini CLI (Google)" },
      { "id": "CODEX", "name": "Codex CLI (OpenAI)" },
      { "id": "OPENCODE", "name": "Opencode" },
      { "id": "CURSOR_AGENT", "name": "Cursor Agent" },
      { "id": "QWEN_CODE", "name": "Qwen Code (Alibaba)" },
      { "id": "COPILOT", "name": "GitHub Copilot" },
      { "id": "DROID", "name": "Droid" }
    ]
  }
}
```

**`viben executor list` (Human-readable):**

```
Executors:

  Installed:
    CLAUDE_CODE     Claude Code      v1.0.25    Anthropic's official CLI
    CURSOR          Cursor           v0.45.2    AI-first code editor

  Not Installed:
    GEMINI_CLI      Gemini CLI       -          Google Gemini CLI
    CODEX           OpenAI Codex     -          OpenAI Codex CLI
    WINDSURF        Windsurf         -          Codeium IDE
    AMP             Amp              -          Sourcegraph Amp
    OPENCODE        OpenCode         -          Open source coding agent
    QWEN_CODE       Qwen Code        -          Alibaba Qwen coding agent
    AIDER           Aider            -          AI pair programming
    CONTINUE        Continue         -          IDE plugin for AI coding

Tip: Use 'viben executor show -n <id>' to see details.
```

**`viben executor show -n CLAUDE_CODE` (Human-readable):**

```
Executor: CLAUDE_CODE
Name: Claude Code
Description: Anthropic's official CLI for Claude

Status: ✓ Installed
Version: 1.0.25
Path: /usr/local/bin/claude

Configuration:
  Config Dir:    ~/.claude/
  MCP Config:    ~/.claude/mcp_servers.json
  Settings:      ~/.claude/settings.json

Agents using this executor:
  main          3 sessions    default
  my-agent      1 session

Capabilities:
  - Tool use (Bash, Read, Write, Edit, etc.)
  - MCP server support
  - Multi-turn conversations
  - Extended thinking
  - Image understanding
```

**`viben executor list --json`:**

```json
{
  "success": true,
  "data": {
    "executors": [
      {
        "id": "CLAUDE_CODE",
        "name": "Claude Code",
        "description": "Anthropic's official CLI for Claude",
        "installed": true,
        "version": "1.0.25",
        "path": "/usr/local/bin/claude",
        "configDir": "~/.claude/",
        "mcpConfigPath": "~/.claude/mcp_servers.json",
        "settingsPath": "~/.claude/settings.json"
      },
      {
        "id": "CURSOR",
        "name": "Cursor",
        "description": "AI-first code editor",
        "installed": true,
        "version": "0.45.2",
        "path": "/Applications/Cursor.app/Contents/MacOS/Cursor",
        "configDir": "~/.cursor/",
        "mcpConfigPath": "~/.cursor/mcp.json",
        "settingsPath": "~/.cursor/settings.json"
      },
      {
        "id": "GEMINI_CLI",
        "name": "Gemini CLI",
        "description": "Google Gemini CLI",
        "installed": false
      }
    ]
  }
}
```

## Executor Chat

Non-interactive conversation with an executor.

### Command Interface

```
viben executor chat [OPTIONS] -n <EXECUTOR_NAME>

OPTIONS:
    -n, --name <NAME>           Executor name (e.g., CLAUDE_CODE, GEMINI)
    -p, --prompt <PROMPT>       Prompt (optional, reads from stdin if not provided)
    -C, --cwd <DIR>             Working directory (default: current directory)

    --input-format <FORMAT>     Input format: text (default), stream-json
    --output-format <FORMAT>    Output format: text (default), stream-json
    --verbose                   Verbose output

    --session-id <ID>           Specify session ID
    --resume <SESSION_ID>       Resume existing session

    --model <MODEL>             Specify model (if executor supports)
    --dangerously-skip-permissions  Skip permission checks
```

### Usage Examples

```bash
# Basic usage
viben executor chat -n CLAUDE_CODE -p "Analyze this code"

# Read plain text from stdin
echo "Write a sorting function" | viben executor chat -n CLAUDE_CODE

# JSON stream input/output (for programmatic calls)
echo '{"type":"user","message":{"role":"user","content":"Analyze code"}}' | \
  viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# Resume session
viben executor chat -n CLAUDE_CODE -p "Continue previous work" --resume abc123
```

## Relationship with Agents

```
┌─────────────────────────────────────────────────────────────┐
│                    Viben Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  viben executor list          viben agent list              │
│       ↓                            ↓                        │
│  ┌─────────────┐             ┌─────────────┐                │
│  │  Executor   │─────────────│   Agent     │                │
│  │ CLAUDE_CODE │   1:N       │   main      │                │
│  │ (Installed) │             │  my-agent   │                │
│  └─────────────┘             └─────────────┘                │
│       │                            │                        │
│       │ Runtime env                │ Configuration          │
│       ↓                            ↓                        │
│  ┌─────────────┐             ┌─────────────┐                │
│  │  ~/.claude/ │             │ ~/.viben/   │                │
│  │ (executor   │◄────────────│ agents/xxx/ │                │
│  │  native cfg)│  overlay    │ (skills,mcp │                │
│  └─────────────┘             │  memory)    │                │
│                              └─────────────┘                │
│                                                             │
│  Workflow:                                                  │
│  1. viben executor list  → Discover locally installed       │
│  2. viben agent create -n xxx -e CLAUDE_CODE                │
│     → Create agent instance based on Claude Code            │
│  3. viben agent config → Configure skills, mcp, prompts     │
│  4. When running agent, executor config + viben config merge│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Differences**:

| Dimension | Executor | Agent |
|-----------|----------|-------|
| Definition | Underlying coding agent tool | Viben-configured agent instance |
| Quantity | Few (typically 1-3 installed) | Many (can create any number) |
| Management | System-level install, Viben only discovers | Viben creates and manages |
| Configuration | Native config (e.g., ~/.claude/) | Viben config (overlays native) |
| Operations | `list`, `show` (read-only) | `create`, `remove`, `config` (read-write) |

## executor chat vs agent chat

| Feature | `viben executor chat` | `viben agent chat` |
|---------|----------------------|-------------------|
| Target | Directly call underlying executor | Call configured Agent |
| Memory | None | Automatically loads Agent memory |
| Configuration | Command line args only | Agent config + workspace + command line |
| Session | Temporary | Persisted to Agent directory |
| MCP | Manual configuration needed | Uses Agent's MCP configuration |
| Skills | None | Uses Agent's Skills |
| Use Case | One-off calls, script integration | Ongoing conversations, project development |

## Related Commands

- [viben agent](./agent) - Agent management
- [viben agent chat](./agent-chat) - Agent chat
