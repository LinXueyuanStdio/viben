# WorkAny 沙箱系统

## 概述

WorkAny 实现了可扩展的沙箱提供者系统，支持在隔离环境中安全执行代码。

## 沙箱类型定义

**文件**: [`workany/src-api/src/core/sandbox/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/sandbox/types.ts)

### 提供者类型

```typescript
// 行 18-29
type BuiltinSandboxProviderType =
  | 'docker'   // Docker 容器
  | 'native'   // 本地进程
  | 'e2b'      // E2B 云沙箱
  | 'codex'    // Codex 进程
  | 'claude';  // Claude 容器

// 可扩展的字符串类型
type SandboxProviderType = BuiltinSandboxProviderType | (string & {});
```

### 沙箱能力

```typescript
// 行 31-42
interface SandboxCapabilities {
  /** 是否支持主机卷挂载 */
  supportsVolumeMounts: boolean;
  /** 是否有网络访问 */
  supportsNetworking: boolean;
  /** 隔离级别 */
  isolation: 'vm' | 'container' | 'process' | 'none';
  /** 支持的运行时 */
  supportedRuntimes: string[]; // ["node", "python", "bun"]
  /** 是否支持实例池 */
  supportsPooling: boolean;
}
```

### 执行选项

```typescript
// 行 48-61
interface SandboxExecOptions {
  /** 要执行的命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 沙箱内工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间 (毫秒) */
  timeout?: number;
  /** 容器/VM 镜像 */
  image?: string;
}
```

### 执行结果

```typescript
// 行 63-78
interface SandboxExecResult {
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number;
  /** 执行时长 (毫秒) */
  duration: number;
  /** 执行提供者信息 (用于 UI 显示) */
  provider?: {
    type: SandboxProviderType;
    name: string;
    isolation: 'vm' | 'container' | 'process' | 'none';
  };
}
```

### 脚本选项

```typescript
// 行 80-89
interface ScriptOptions {
  /** 脚本参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间 (毫秒) */
  timeout?: number;
  /** 执行前安装的包 */
  packages?: string[];
}
```

### 卷挂载

```typescript
// 行 95-102
interface VolumeMount {
  /** 主机路径 */
  hostPath: string;
  /** 沙箱内路径 */
  guestPath: string;
  /** 是否只读 */
  readOnly?: boolean;
}
```

---

## 沙箱提供者接口

```typescript
// 行 164-214
interface ISandboxProvider {
  /** 提供者类型标识 */
  readonly type: SandboxProviderType;
  /** 人类可读名称 */
  readonly name: string;

  /** 检查当前平台是否可用 */
  isAvailable(): Promise<boolean>;

  /** 初始化提供者 */
  init(config?: Record<string, unknown>): Promise<void>;

  /** 执行命令 */
  exec(options: SandboxExecOptions): Promise<SandboxExecResult>;

  /** 运行脚本文件 */
  runScript(
    filePath: string,
    workDir: string,
    options?: ScriptOptions
  ): Promise<SandboxExecResult>;

  /** 停止并清理 */
  stop(): Promise<void>;

  /** 关闭提供者 */
  shutdown(): Promise<void>;

  /** 获取能力 */
  getCapabilities(): SandboxCapabilities;

  /** 设置卷挂载 (可选) */
  setVolumes?(volumes: VolumeMount[]): void;
}
```

---

## 提供者配置

### Docker 提供者

```typescript
// 行 119-131
interface DockerProviderConfig extends SandboxProviderConfig {
  type: 'docker';
  config: {
    /** Docker socket 路径 */
    socketPath?: string;
    /** 默认容器镜像 */
    defaultImage?: string;
    /** 内存限制 (如 "1g") */
    memoryLimit?: string;
    /** CPU 限制 (如 "1.0") */
    cpuLimit?: string;
  };
}
```

### Native 提供者

```typescript
// 行 133-143
interface NativeProviderConfig extends SandboxProviderConfig {
  type: 'native';
  config: {
    /** 允许执行的目录 */
    allowedDirectories?: string[];
    /** 使用的 shell */
    shell?: string;
    /** 默认超时时间 */
    defaultTimeout?: number;
  };
}
```

### E2B 提供者

```typescript
// 行 145-155
interface E2BProviderConfig extends SandboxProviderConfig {
  type: 'e2b';
  config: {
    /** E2B API 密钥 */
    apiKey?: string;
    /** 沙箱模板 ID */
    templateId?: string;
    /** 沙箱超时 */
    timeout?: number;
  };
}
```

---

## 沙箱配置

```typescript
// 行 243-254
interface SandboxConfig {
  /** 是否启用沙箱模式 */
  enabled: boolean;
  /** 使用的沙箱提供者 */
  provider?: SandboxProviderType;
  /** 容器镜像 */
  image?: string;
  /** 沙箱服务 API 端点 (已弃用，使用 provider) */
  apiEndpoint?: string;
  /** 提供者特定配置 */
  providerConfig?: Record<string, unknown>;
}
```

---

## 默认镜像

```typescript
// 行 235-239
const SANDBOX_IMAGES = {
  node: 'node:18-alpine',
  python: 'python:3.11-slim',
  bun: 'oven/bun:latest',
} as const;
```

---

## 沙箱 MCP 工具

**文件**: [`workany/src-api/src/extensions/agent/claude/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/agent/claude/index.ts) 行 718-946

### sandbox_run_script 工具

```typescript
tool(
  'sandbox_run_script',
  `Run a script file in an isolated sandbox container. Automatically detects the runtime (Python, Node.js, Bun) based on file extension.

IMPORTANT: The sandbox is isolated and CANNOT write files to the host filesystem.
- Scripts should output results to stdout (print/console.log)
- After execution, use the Write tool to save stdout content to files if needed
- Do NOT write files inside the script - it will fail with PermissionError

Example workflow:
1. Write script that prints results to stdout
2. Run script with sandbox_run_script
3. Use Write tool to save the stdout output to a file`,
  {
    filePath: z.string().describe('Absolute path to the script file to execute'),
    workDir: z.string().describe('Working directory containing the script'),
    args: z.array(z.string()).optional().describe('Optional command line arguments'),
    packages: z.array(z.string()).optional().describe('Optional packages to install'),
    timeout: z.number().optional().describe('Execution timeout in milliseconds'),
  },
  async (args) => {
    const response = await fetch(`${SANDBOX_API_URL}/sandbox/run/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args, provider: sandboxProvider }),
    });
    // 处理响应...
  }
)
```

### sandbox_run_command 工具

```typescript
tool(
  'sandbox_run_command',
  `Execute a shell command in an isolated sandbox container.

IMPORTANT: The sandbox is isolated and CANNOT write files to the host filesystem.
- Commands should output results to stdout
- Use Write tool to save any output to files after execution
- File write operations inside sandbox will fail with PermissionError`,
  {
    command: z.string().describe("The command to execute"),
    args: z.array(z.string()).optional().describe('Arguments for the command'),
    workDir: z.string().describe('Working directory for command execution'),
    image: z.string().optional().describe('Container image'),
    timeout: z.number().optional().describe('Execution timeout in milliseconds'),
  },
  async (args) => {
    const response = await fetch(`${SANDBOX_API_URL}/sandbox/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: args.command,
        args: args.args,
        cwd: args.workDir,
        image: args.image,
        timeout: args.timeout,
        provider: sandboxProvider,
      }),
    });
    // 处理响应...
  }
)
```

---

## 沙箱执行流程

```
用户请求执行脚本
        │
        ▼
┌─────────────────┐
│  Claude Agent   │
│  (工具调用)      │
└────────┬────────┘
         │
         │ sandbox_run_script / sandbox_run_command
         ▼
┌─────────────────┐
│  Sandbox MCP    │
│    Server       │
└────────┬────────┘
         │
         │ HTTP POST /sandbox/run/file 或 /sandbox/exec
         ▼
┌─────────────────┐
│  Sandbox API    │
│    Routes       │
└────────┬────────┘
         │
         │ 选择提供者
         ▼
┌─────────────────────────────────────────┐
│           Sandbox Provider              │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Docker │ │ Native │ │  E2B   │ ... │
│  └────────┘ └────────┘ └────────┘      │
└─────────────────┬───────────────────────┘
                  │
                  │ 执行脚本/命令
                  ▼
┌─────────────────┐
│ 隔离环境执行     │
│ - stdout/stderr │
│ - exitCode      │
│ - duration      │
└────────┬────────┘
         │
         │ 返回结果
         ▼
┌─────────────────┐
│  Claude Agent   │
│  (处理输出)      │
└────────┬────────┘
         │
         │ 如需保存文件，使用 Write 工具
         ▼
┌─────────────────┐
│  最终结果       │
└─────────────────┘
```

---

## 沙箱隔离限制

| 限制 | 说明 |
|------|------|
| **文件写入** | 沙箱内无法写入主机文件系统，会报 PermissionError |
| **网络访问** | 取决于提供者配置，可能受限 |
| **执行时长** | 默认 120 秒超时 |
| **资源限制** | Docker 可配置 CPU/内存限制 |

### 推荐工作流

1. **生成内容**: 脚本应通过 `print()` 或 `console.log()` 输出结果到 stdout
2. **保存文件**: 执行后使用 Write 工具将 stdout 内容保存到文件
3. **避免内部写入**: 不要在脚本内部尝试写文件

---

## 原始文件引用

- 沙箱类型: [`workany/src-api/src/core/sandbox/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/sandbox/types.ts)
- 沙箱 MCP 工具: [`workany/src-api/src/extensions/agent/claude/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/agent/claude/index.ts) 行 718-946
