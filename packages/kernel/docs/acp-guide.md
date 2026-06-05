# Agent Client Protocol (ACP) — Reference Documentation

> Protocol version: v0.11.3 (March 2026)
> Source: agentclientprotocol.com | GitHub: agentclientprotocol/agent-client-protocol

---

## 1. What is ACP?

Agent Client Protocol (ACP) is a protocol that standardizes communication between **code editors/IDEs** (Client) and **AI coding agents** (Agent). Inspired by Language Server Protocol (LSP) — which standardized autocomplete, go-to-definition, etc. for all editors — ACP does the same for AI coding agents.

**Before ACP:** Each agent-editor pair needed its own custom integration → N agents × M editors = N×M integrations.

**After ACP:** An agent implements ACP once → works on every editor that supports ACP. An editor implements ACP once → works with every agent that supports ACP.


## 2. Why is ACP needed?

ACP solves 3 main problems:

- **Integration overhead**: Each new agent-editor combo requires custom work. With ACP, implement once and you're done.
- **Limited compatibility**: Agents only work on certain editors. ACP breaks this limitation.
- **Developer lock-in**: Choosing agent A means being forced to use editor X. ACP allows free combination.

**Relationship with MCP:** MCP (Model Context Protocol) handles **what** — what data and tools the agent accesses. ACP handles **where** — where the agent lives in the developer's workflow. The two protocols complement each other.


## 3. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   USER (Developer)               │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              CLIENT (Code Editor/IDE)            │
│                                                  │
│  - Sends user prompts to the Agent              │
│  - Renders responses (text, diff, tool calls)   │
│  - Manages permissions for tool execution       │
│  - Provides filesystem access                   │
│  - Exposes MCP servers to the Agent             │
└──────────────────────┬──────────────────────────┘
                       │  JSON-RPC
                       │  (stdio / HTTP / WebSocket)
┌──────────────────────▼──────────────────────────┐
│                 AGENT (AI Coding Agent)           │
│                                                  │
│  - Receives prompts, calls LLM                  │
│  - Executes tool calls (edit file, run cmd...)  │
│  - Sends realtime updates to Client             │
│  - Connects to MCP servers for context          │
└─────────────────────────────────────────────────┘
```

### 3.1 Transport Layer

| Mode | Transport | Use case |
|------|-----------|----------|
| **Local** | JSON-RPC over stdio | Agent runs as a subprocess of the editor |
| **Remote** | HTTP or WebSocket | Agent runs on a separate cloud/server |

**Local mode** is the most common currently. The editor launches the agent process and communicates via stdin/stdout. A single connection can manage multiple sessions simultaneously.

**Remote mode** is being further developed, suitable for enterprise deployment or shared agent infrastructure.

### 3.2 Trust Model

ACP works best when the editor communicates with a **trusted agent**. The user still retains control:
- Approve/reject tool execution
- Control filesystem access
- Manage MCP server configurations


## 4. Detailed Protocol Flow

### 4.1 Initialization (Handshake)

When the editor connects to the agent, the initialization process occurs:

```
Client                              Agent
  │                                   │
  │──── initialize ──────────────────►│
  │     {                             │
  │       protocolVersion: 1,         │
  │       clientCapabilities: {...},  │
  │       name: "my-editor",         │
  │       version: "1.0"             │
  │     }                             │
  │                                   │
  │◄──── initialize response ────────│
  │     {                             │
  │       protocolVersion: 1,         │
  │       agentCapabilities: {...},   │
  │       name: "my-agent",          │
  │       version: "2.0"             │
  │     }                             │
  │                                   │
```

**Client Capabilities (declared by the editor):**
- `fileSystem.readTextFile` — allows the agent to read files
- `fileSystem.writeTextFile` — allows the agent to write files
- `terminal` — allows the agent to run shell commands

**Agent Capabilities (declared by the agent):**
- `loadSession` — supports reloading previous sessions
- `promptCapabilities` — supported content types: Image, Audio, embedded context
- `mcp` — supports HTTP/SSE transport for MCP
- Session methods — supported operations (list, fork, configure...)

**Version Negotiation:** Protocol version is an integer (MAJOR version). If there's a mismatch, the agent returns the highest version it supports. The client should close the connection if incompatible.


### 4.2 Prompt Turn (Main Loop)

This is the core interaction cycle. Each prompt turn consists of 6 steps:

```
Client                              Agent                    LLM
  │                                   │                       │
  │─── session/prompt ──────────────►│                       │
  │    { user message + resources }   │                       │
  │                                   │─── forward prompt ──►│
  │                                   │                       │
  │                                   │◄── response ─────────│
  │                                   │    (text + tool calls)│
  │◄── session/update (notification)─│                       │
  │    { plan, text, tool calls }     │                       │
  │                                   │                       │
  │    [If there's a tool call]       │                       │
  │◄── permission request ───────────│                       │
  │──── permission response ────────►│                       │
  │                                   │── execute tool ──────►│
  │◄── session/update (tool status)──│                       │
  │    { in_progress / completed }    │                       │
  │                                   │                       │
  │    [Tool result → LLM → loop]     │                       │
  │                                   │                       │
  │◄── session/prompt response ──────│                       │
  │    { StopReason }                 │                       │
```

**Stop Reasons:**
- `end_turn` — Completed normally
- `max_tokens` — Token limit reached
- `max_turn_requests` — Exceeded maximum model call count
- `refusal` — Agent refused to continue
- `cancelled` — Client cancelled the turn

### 4.3 Session Management

```
session/new        → Create a new session
session/prompt     → Send a prompt
session/update     → Agent sends update (notification)
session/cancel     → Cancel processing
session/list       → List sessions
session/load       → Reload a previous session
session/fork       → Fork a session (branching)
session/configure  → Configure a session
```


## 5. MCP Integration

ACP integrates tightly with MCP:

- The editor passes MCP server configs to the Agent during initialization
- The agent connects directly to MCP servers
- When the editor exposes tools via MCP, it deploys a **proxy tunnel** — routing requests back to the editor
- Supports both stdio-based and HTTP/SSE MCP transport

```
Editor ──(ACP)──► Agent ──(MCP)──► MCP Server (DB, API, tools...)
  │                                      ▲
  └──── proxy tunnel (for editor tools)──┘
```


## 6. Current Ecosystem

### 6.1 Editors supporting ACP (Clients)
- **Zed** — Native ACP support
- **JetBrains IDEs** — Via AI Assistant plugin
- **Neovim** — Community plugin
- **Marimo** — Notebook editor
- **Cursor** — ACP documentation available

### 6.2 Agents supporting ACP (40+)
- **Claude Code** (Anthropic)
- **Codex CLI** (OpenAI)
- **Gemini** (Google)
- **Goose** (Block)
- **GitHub Copilot** (public preview since Jan 2026)
- **Cline**, **OpenHands**, **Factory Droid**, **Docker cagent**
- And many more...

### 6.3 Official SDKs
| Language | Package | Registry |
|----------|---------|----------|
| Rust | `agent-client-protocol` | crates.io |
| TypeScript | `@agentclientprotocol/sdk` | npm |
| Python | `python-sdk` | PyPI |
| Java | `java-sdk` | Maven |
| Kotlin | `acp-kotlin` | Maven (JVM) |


## 7. Approaches for Building Products

### 7.1 Build a New Agent

If you want to create your own AI coding agent:

**Approach:**
1. Choose an appropriate SDK (TypeScript or Python are most common)
2. Implement the ACP protocol: initialize handshake, prompt turn loop, session management
3. Connect an LLM backend (OpenAI, Anthropic, local model...)
4. Implement tool execution (file edit, terminal, search...)
5. The agent automatically becomes compatible with all ACP-supporting editors

**Example use cases:**
- An agent specialized for a specific language/framework
- An agent integrated with company-specific tools (CI/CD, internal APIs)
- An agent with specialized reasoning (security audit, performance optimization)

### 7.2 Build a New Editor/Client

If you want to create an IDE or coding tool:

**Approach:**
1. Implement the ACP client protocol
2. Support local agent launch (subprocess + stdio)
3. Render agent output (markdown text, diffs, tool status)
4. Implement permission UI for tool execution
5. Automatically compatible with all ACP agents

### 7.3 Build an Agent Platform / Registry

**Idea:** A marketplace or registry where developers discover, install, and manage ACP agents.

**Reference:** ACP already has a Registry concept — you can build on that or create your own curated experience.

### 7.4 Build Enterprise Agent Infrastructure

**Idea:** Remote ACP agent hosting for teams/enterprises:
- Shared agent instances on a server
- Centralized MCP server management
- Usage tracking, audit logs
- Custom tool permissions per team/role

### 7.5 Build an Agent Development Framework

**Idea:** A framework that makes it easy for developers to build ACP agents:
- Boilerplate handling (protocol, session management)
- Plugin system for tools
- Testing utilities
- Deployment tools (local + remote)

### 7.6 Bridge ACP with Non-Coding Domains

ACP currently focuses on coding, but this pattern can be applied to:
- Document editing agents
- Design tool agents
- Data analysis agents
- DevOps/infrastructure agents


## 8. Technical Notes for Implementation

### 8.1 JSON-RPC Basics

ACP uses JSON-RPC 2.0. Each message has the following format:

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": { ... }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}

// Notification (no id, no response expected)
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": { ... }
}
```

### 8.2 Content Types

Text defaults to **Markdown**. Additionally supports:
- Image content
- Audio content
- Embedded context (file references)

### 8.3 MCP Type Reuse

ACP reuses JSON structures from MCP when possible, but adds custom types for coding-specific features like diff display.

### 8.4 Feature Flags

The protocol uses feature flags to indicate features under development. Check agent capabilities in the initialize response.


## 9. Resources

- **Specification:** https://agentclientprotocol.com
- **GitHub:** https://github.com/agentclientprotocol/agent-client-protocol
- **LLM-friendly docs:** https://agentclientprotocol.com/llms.txt
- **OpenAPI spec:** Available in the repo
- **SDKs:** See section 6.3
- **License:** Apache 2.0
- **RFDs (Requests for Dialog):** Official process for proposing protocol changes


## 10. Quick Summary

| Concept | Explanation |
|---------|-------------|
| ACP | Protocol standardizing editor ↔ agent communication |
| Client | Code editor/IDE (Zed, JetBrains, Neovim...) |
| Agent | AI coding tool (Claude Code, Codex, Gemini...) |
| Transport | stdio (local) or HTTP/WebSocket (remote) |
| Protocol | JSON-RPC 2.0 |
| Session | A working session between client and agent |
| Prompt Turn | A complete request-response cycle |
| MCP | Complementary protocol — provides data/tools to the agent |
| SDK | Rust, TypeScript, Python, Java, Kotlin |
| License | Apache 2.0 |
