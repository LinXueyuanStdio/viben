---
sidebar_position: 25
title: "Sandbox System"
description: "Extensible sandbox provider system for safe code execution in isolated environments"
---

# Sandbox System

Extensible sandbox provider system for safe code execution in isolated environments.

---

## Overview

The sandbox system provides an extensible provider architecture for executing code safely in isolated environments. Sandbox configuration is a **session-level** configuration, not an Agent configuration.

---

## Provider Types

| Provider | Isolation Level | Network Access | Use Case |
|----------|----------------|----------------|----------|
| **Native** | None | Yes | Development/testing, fallback for other providers |
| **Codex** | OS-level (Seatbelt/Landlock) | No | High security requirements |
| **Claude** | Process-level | Yes | General security requirements |

### Selection Priority

```
Codex (most secure) > Claude (moderate) > Native (no isolation, fallback)
```

---

## Architecture

```
Desktop (React)               packages/core                   Sandbox Provider
     |                             |                              |
     |  /api/sandbox/exec          |                              |
     +----------------------------->                              |
     |                             |  SandboxService.exec()       |
     |                             +------------------------------>
     |                             |                              |
     |  { stdout, stderr, ... }    |<------------------------------
     |<----------------------------  SandboxExecResult            |
     |                             |                              |
```

---

## Type Definitions

### Core Types

```typescript
type SandboxProviderType = 'native' | 'codex' | 'claude';

interface SandboxCapabilities {
  supportsVolumeMounts: boolean;
  supportsNetworking: boolean;
  isolation: 'vm' | 'container' | 'process' | 'none';
  supportedRuntimes: string[];
  supportsPooling: boolean;
}

interface SandboxExecOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  image?: string;
}

interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  provider?: {
    type: SandboxProviderType;
    name: string;
  };
}
```

### Sandbox Config (Session-Level)

```typescript
interface SandboxConfig {
  enabled: boolean;
  provider?: SandboxProviderType;
  image?: string;
  providerConfig?: Record<string, unknown>;
}
```

### Provider Interface

```typescript
interface ISandboxProvider {
  readonly type: SandboxProviderType;
  readonly name: string;

  isAvailable(): Promise<boolean>;
  init(config?: Record<string, unknown>): Promise<void>;
  exec(options: SandboxExecOptions): Promise<SandboxExecResult>;
  runScript(filePath: string, workDir: string, options?: ScriptOptions): Promise<SandboxExecResult>;
  stop(): Promise<void>;
  shutdown(): Promise<void>;
  getCapabilities(): SandboxCapabilities;
}
```

---

## Provider Implementations

### Native Provider

**File**: `packages/core/src/sandbox/providers/native.ts`

- No isolation, uses `spawn()` directly
- Auto-detects runtime (node, python, bash)
- Supports package installation (npm, pip)
- Always available as fallback

### Codex Provider

**File**: `packages/core/src/sandbox/providers/codex.ts`

- Uses OpenAI Codex CLI sandbox functionality
- OS-level isolation (macOS: Seatbelt, Linux: Landlock)
- No network access (security-first)
- Auto-detects codex executable path

### Claude Provider

**File**: `packages/core/src/sandbox/providers/claude.ts`

- Uses Anthropic sandbox-runtime (`srt`)
- Process-level isolation
- Supports network access
- Auto-detects srt executable path

---

## Service Layer

### SandboxService

```typescript
export class SandboxService {
  async init(): Promise<void>;
  async getBestProvider(preferred?: SandboxProviderType): Promise<ISandboxProvider>;
  async exec(options: SandboxExecOptions, preferred?: SandboxProviderType): Promise<SandboxExecResult>;
  async runScript(filePath: string, workDir: string, options?: ScriptOptions, preferred?: SandboxProviderType): Promise<SandboxExecResult>;
  async getAvailableProviders(): Promise<SandboxProviderType[]>;
  async shutdown(): Promise<void>;
}
```

---

## Gateway Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sandbox/available` | GET | Get available provider list |
| `/api/sandbox/exec` | POST | Execute a command |
| `/api/sandbox/run/file` | POST | Run a script file |

### Example Requests

```bash
# Check available providers
curl http://127.0.0.1:18790/api/sandbox/available

# Execute command (Native)
curl -X POST http://127.0.0.1:18790/api/sandbox/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "echo", "args": ["hello"]}'

# Run script
curl -X POST http://127.0.0.1:18790/api/sandbox/run/file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/script.js", "workDir": "/tmp"}'
```

---

## Session Configuration Integration

The `sandboxConfig` is passed at the request level, not as part of Agent configuration:

```typescript
interface AgentRunRequest {
  prompt: string;
  cwd?: string;
  agentConfigPath?: string;
  agentConfig?: AgentConfigPayload;
  sessionId?: string;
  taskId?: string;
  sandboxConfig?: SandboxConfig;
}
```

---

## File Structure

```
packages/core/src/sandbox/
+-- types.ts                    # Type definitions
+-- providers/
    +-- index.ts                # Provider registration and exports
    +-- native.ts               # Native provider
    +-- codex.ts                # Codex provider
    +-- claude.ts               # Claude provider

packages/core/src/services/
+-- sandbox.ts                  # Sandbox service

packages/core/src/gateway/routes/
+-- sandbox.ts                  # Sandbox API routes
```

---

## Troubleshooting

### Codex Provider Not Available

Check if Codex CLI is installed:
```bash
which codex
# or
npm install -g @openai/codex
```

### Claude Provider Not Available

Check if sandbox-runtime is installed:
```bash
which srt
# or
npm install -g @anthropic-ai/sandbox-runtime
```

### Network Access Issues

- Codex provider disables network access by design (security)
- Use Claude or Native provider when network access is needed

---

## Related Documentation

- [SSE Streaming](./sse-streaming.md) - SSE communication protocol
- [Agent Hooks](./agent-hooks.md) - Agent data source hooks
