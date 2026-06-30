---
sidebar_position: 1
title: Agent Development Guide
description: Complete Guide for Viben Agent Development
---

# Agent Development Guide

This document provides a complete development guide for Agent developers, including Agent core concepts, CLI commands, MCP development, Skill development, and more.

## Table of Contents

| Document | Description |
|----------|-------------|
| [MCP Development](./mcp-development.md) | MCP Server development guide |
| [Skill Development](./skill-development.md) | Skill development guide |
| [CLI Integration](./cli-integration.md) | Complete Viben CLI command reference |
| [Agent Templates](./templates/agent-templates.md) | Agent template development guide |
| [SSE 流式通信](./sse-streaming.md) | SSE streaming protocol for real-time agent response |
| [后台任务管理](./background-tasks.md) | Background task execution and status tracking |
| [沙箱执行](./sandbox-execution.md) | Isolated code execution via sandbox providers |
| [Best Practices](./best-practices.md) | Agent development best practices |

## Core Concepts

### What is an Agent?

An Agent is a core concept in Viben - an independent agent instance that has its own configuration, memory, and sessions.

| Concept | Description |
|---------|-------------|
| **Agent** | Independent agent instance with its own configuration, memory, sessions |
| **Executor** | Underlying coding agent tool (Claude Code, Cursor, etc.), Agents run on top of Executors |
| **Memory** | Agent's long-term memory (MEMORY.md + daily logs) |
| **Session** | Agent's session storage (conversation history, state) |
| **Skill** | Reusable capability unit for Agents |
| **MCP Server** | Bridge for Agents to interact with external data sources and tools |

### Relationship Between Agent and Executor

```
Agent = Executor + Skills + Prompts + MCP + Memory
```

- **Executor**: Underlying coding agent responsible for task execution (e.g., Claude Code, Cursor, Gemini CLI)
- **Agent**: Viben-configured agent instance that runs on top of an Executor

One Executor can support multiple Agent instances.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Viben Agent Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  Agent Instance (Independent agent instance)                 │
│      ├── config.yaml (agent configuration)                  │
│      ├── mcp_servers.json (MCP configuration)               │
│      ├── skills/ (agent-specific skills)                    │
│      ├── memory/ (agent memory)                             │
│      │   ├── MEMORY.md (main memory)                        │
│      │   └── YYYY-MM-DD.md (daily logs, append-only)        │
│      ├── .agentrc (startup configuration)                   │
│      ├── .agent_history (command history)                   │
│      └── .agent_sessions/<session_id>/ (session storage)    │
└─────────────────────────────────────────────────────────────┘
```


## Transport & Services

### Gateway API Transport

Agent communication is handled through the Viben Gateway:

| Transport | Protocol | Description |
|-----------|----------|-------------|
| **Gateway REST API** | HTTP/JSON | Agent CRUD, session management at `http://127.0.0.1:18790/api/agent` |
| **SSE Streaming** | Server-Sent Events | Real-time agent response streaming |
| **ACP WebSocket** | JSON-RPC 2.0 | `/ws/agent/acp` for ACP-compatible clients |
| **Agent Run WS** | Viben messages | `/ws/agent/run` for legacy executor flows |

### Sandbox Execution

Agents can execute code safely in isolated sandboxes. See [Sandbox Execution](./sandbox-execution.md).

### Marketplace Integration

Agents consume MCP/Skill packages from the web marketplace. See [MCP Development](./mcp-development.md) and [Skill Development](./skill-development.md).

## Quick Start

### 1. Create Agent

```bash
# Create new agent
viben agent create -n my-agent

# Create from template
viben agent create -n my-agent -f coding-assistant

# Clone existing agent
viben agent create -n my-agent --clone existing-agent

# Set agent as template
viben agent set-template -n my-agent --description "A general coding assistant template"

# List all templates
viben agent template list
```

### 2. Configure Agent

```bash
# View configuration
viben agent config -n my-agent

# Set model
viben agent config -n my-agent --set model=gpt-4

# Enable MCP
viben agent config -n my-agent --set mcp.enabled="[\"filesystem\",\"git\"]"
```

### 3. Install Skill

```bash
# Global installation
viben skill install code-review

# Install to specific agent
viben skill install code-review --agent my-agent
```

### 4. Configure MCP

```bash
# Add MCP server
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user

# View MCP list
viben mcp list --agent my-agent
```

### 5. Chat with Agent

```bash
# Non-interactive conversation
viben agent chat -n my-agent -p "Analyze this code"

# Read from stdin
echo "Write a sorting function" | viben agent chat -n my-agent

# Specify working directory
viben agent chat -n my-agent -p "Analyze project structure" -C /path/to/project
```

## Agent Storage Paths

```
~/.viben/agents/<agent-id>/
├── config.yaml              # Agent configuration
├── mcp_servers.json         # MCP servers configuration
├── skills/                  # Agent-specific skills
├── memory/                  # Agent memory
│   ├── MEMORY.md            # Main memory file (structured knowledge)
│   ├── 2024-01-15.md        # Daily log (append-only)
│   └── ...
├── .agentrc                 # Agent startup configuration
├── .agent_history           # Command history
└── .agent_sessions/         # Session storage
    └── <session_id>/
        ├── config.yaml      # Session configuration
        └── messages.rollout.jsonl  # Message history (JSONL)
```

## Agent Configuration File

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

# Agent metadata
id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

# Agent type (determines runtime behavior)
type: claude-code  # claude-code | cursor | gemini | codex | ...

# Type-specific configuration
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: "You are a helpful coding assistant."

# MCP configuration
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# Skills configuration
skills:
  enabled:
    - code-review
    - commit
```

## Supported Executor Types

| ID | CLI Tool | Description |
|----|----------|-------------|
| `CLAUDE_CODE` | `claude` | Claude Code CLI |
| `AMP` | `amp` | Amp Code Agent |
| `GEMINI` | `gemini` | Google Gemini CLI |
| `CODEX` | `codex` | OpenAI Codex |
| `OPENCODE` | `opencode` | Opencode CLI |
| `CURSOR_AGENT` | `cursor` | Cursor Agent |
| `QWEN_CODE` | `qwen` | Qwen Code |
| `COPILOT` | `copilot` | GitHub Copilot |
| `DROID` | `droid` | Droid Agent |

## Memory System

The Agent memory system uses a dual-layer design:

| File | Description | When Read |
|------|-------------|-----------|
| `memory/MEMORY.md` | Main memory file, structured knowledge | Every session startup |
| `memory/YYYY-MM-DD.md` | Daily log, append-only | Today + yesterday read at session startup |

**Daily Log Format**:

```markdown
# 2024-01-16

## 10:30 - Session started
- Working on feature X
- Discovered issue with Y

## 14:15 - Completed task
- Fixed bug in Z
- Updated documentation

## 17:00 - Session ended
- Next steps: review PR, deploy to staging
```

## Runtime Configuration Merging

When an Agent actually runs, configurations are merged in the following order:

```
1. ~/.viben/agents/<id>/config.yaml     # Agent base configuration
2. <project>/.claude/ (or other agent type)  # Workspace agent type configuration
3. Command line arguments                    # Runtime overrides
```

For example: Running agent `main` in the `/projects/my-app` directory will first load `~/.viben/agents/main/config.yaml`, and if the type is `claude-code`, then overlay the configuration from `/projects/my-app/.claude/`.

## Next Steps

- Read the [MCP Development Guide](./mcp-development.md) to learn how to develop MCP Servers
- Read the [Skill Development Guide](./skill-development.md) to learn how to develop Skills
- Read the [CLI Integration Guide](./cli-integration.md) for complete CLI commands
- Read [Best Practices](./best-practices.md) to learn development tips
