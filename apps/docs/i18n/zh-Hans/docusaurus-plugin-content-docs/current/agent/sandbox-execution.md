---
sidebar_position: 7
title: "沙箱执行"
description: "在隔离环境中安全执行代码的沙箱系统"
---

# 沙箱执行

> 在隔离环境中安全执行代码的沙箱系统

## 概述

可扩展的沙箱提供者系统，支持在隔离环境中安全执行代码。沙箱配置属于**会话级别**配置，不属于 Agent 配置。

## 沙箱提供者类型

| 提供者 | 隔离级别 | 网络访问 | 适用场景 |
|--------|----------|----------|----------|
| **Native** | 无 | 是 | 开发测试，其他提供者回退 |
| **Codex** | OS级 (Seatbelt/Landlock) | 否 | 高安全性需求 |
| **Claude** | 进程级 | 是 | 一般安全需求 |

选择优先级：**Codex（最安全） > Claude（中等） > Native（无隔离，回退）**

## 系统架构

```
Desktop (React)        packages/core          Sandbox Provider
     │                      │                       │
     │ /api/sandbox/exec    │                       │
     ├─────────────────────►│                       │
     │                      │ SandboxService.exec() │
     │                      ├──────────────────────►│
     │                      │                       │
     │ { stdout, stderr }   │◄──────────────────────┤
     │◄─────────────────────┤                       │
```

## 核心类型

### SandboxExecOptions

```typescript
interface SandboxExecOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  image?: string;
}
```

### SandboxExecResult

```typescript
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

### ISandboxProvider 接口

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

## 提供者详情

### Native 提供者

- 无隔离，直接使用 `spawn()` 执行
- 自动检测运行时（node, python, bash, tsx）
- 支持包安装（npm, pip）
- 始终可用，作为其他提供者的回退

### Codex 提供者

- 使用 OpenAI Codex CLI 的 sandbox 功能
- OS 级别隔离（macOS: Seatbelt, Linux: Landlock）
- 不支持网络访问（安全优先）
- 需要安装 `@openai/codex`

### Claude 提供者

- 使用 Anthropic 的 sandbox-runtime（`srt`）
- 进程级隔离
- 支持网络访问
- 需要安装 `@anthropic-ai/sandbox-runtime`

## SandboxService

服务层管理所有提供者的注册、选择和执行：

```typescript
class SandboxService {
  async init(): Promise<void>
  async getBestProvider(preferred?: SandboxProviderType): Promise<ISandboxProvider>
  async exec(options: SandboxExecOptions, preferred?: SandboxProviderType): Promise<SandboxExecResult>
  async runScript(filePath: string, workDir: string, options?: ScriptOptions): Promise<SandboxExecResult>
  async getAvailableProviders(): Promise<SandboxProviderType[]>
  async shutdown(): Promise<void>
}
```

## Gateway 路由

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/sandbox/available` | GET | 获取可用提供者列表 |
| `/api/sandbox/exec` | POST | 执行命令 |
| `/api/sandbox/run/file` | POST | 运行脚本文件 |

## 使用示例

```bash
# 检查可用提供者
curl http://127.0.0.1:18790/api/sandbox/available

# 执行命令 (Native)
curl -X POST http://127.0.0.1:18790/api/sandbox/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "echo", "args": ["hello"]}'

# 运行脚本
curl -X POST http://127.0.0.1:18790/api/sandbox/run/file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/script.js", "workDir": "/tmp"}'
```

## 会话配置集成

`sandboxConfig` 通过 agent 执行请求传递，属于会话级别配置：

```typescript
interface AgentRunRequest {
  prompt: string;
  cwd?: string;
  sessionId?: string;
  sandboxConfig?: SandboxConfig; // 会话级别沙箱配置
}
```

## 常见问题

### Codex 提供者不可用

```bash
npm install -g @openai/codex
```

### Claude 提供者不可用

```bash
npm install -g @anthropic-ai/sandbox-runtime
```

### 网络访问问题

- Codex 提供者默认禁用网络访问（安全设计）
- 需要网络访问时使用 Claude 或 Native 提供者

## 参考

- 规范文件: `docs/specs/modules/chat/sandbox-spec.md`
- [SSE 流式通信](./sse-streaming.md)
- [后台任务管理](./background-tasks.md)
