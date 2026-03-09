# 沙箱系统规范

> 在隔离环境中安全执行代码的沙箱系统

---

## 概述

### 目标

实现可扩展的沙箱提供者系统，支持在隔离环境中安全执行代码。沙箱配置属于**会话级别**配置，不属于 Agent 配置。

### 参考实现

- WorkAny 沙箱系统: `docs/work/sandbox-system.md`
- WorkAny 源码: `/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/sandbox/`

---

## 架构设计

### 沙箱提供者类型

| 提供者 | 隔离级别 | 网络访问 | 适用场景 |
|--------|----------|----------|----------|
| **Native** | 无 | 是 | 开发测试，其他提供者回退 |
| **Codex** | OS级 (Seatbelt/Landlock) | 否 | 高安全性需求 |
| **Claude** | 进程级 | 是 | 一般安全需求 |

### 选择优先级

```
Codex (最安全) > Claude (中等) > Native (无隔离，回退)
```

### 系统架构

```
Desktop (React)               packages/core                   Sandbox Provider
     │                             │                              │
     │  /api/sandbox/exec          │                              │
     ├────────────────────────────►│                              │
     │                             │  SandboxService.exec()       │
     │                             ├─────────────────────────────►│
     │                             │                              │
     │  { stdout, stderr, ... }    │◄─────────────────────────────┤
     │◄────────────────────────────┤  SandboxExecResult           │
     │                             │                              │
```

---

## 类型定义

### packages/core/src/sandbox/types.ts

```typescript
/**
 * 沙箱提供者类型
 */
export type SandboxProviderType = 'native' | 'codex' | 'claude';

/**
 * 沙箱能力
 */
export interface SandboxCapabilities {
  /** 是否支持主机卷挂载 */
  supportsVolumeMounts: boolean;
  /** 是否有网络访问 */
  supportsNetworking: boolean;
  /** 隔离级别 */
  isolation: 'vm' | 'container' | 'process' | 'none';
  /** 支持的运行时 */
  supportedRuntimes: string[];
  /** 是否支持实例池 */
  supportsPooling: boolean;
}

/**
 * 执行选项
 */
export interface SandboxExecOptions {
  /** 要执行的命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间 (毫秒) */
  timeout?: number;
  /** 容器镜像 (Docker 提供者) */
  image?: string;
}

/**
 * 执行结果
 */
export interface SandboxExecResult {
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number;
  /** 执行时长 (毫秒) */
  duration: number;
  /** 执行提供者信息 */
  provider?: {
    type: SandboxProviderType;
    name: string;
  };
}

/**
 * 脚本执行选项
 */
export interface ScriptOptions {
  /** 脚本参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间 (毫秒) */
  timeout?: number;
  /** 执行前安装的包 */
  packages?: string[];
}

/**
 * 沙箱配置 (会话级别)
 */
export interface SandboxConfig {
  /** 是否启用沙箱模式 */
  enabled: boolean;
  /** 指定的沙箱提供者 */
  provider?: SandboxProviderType;
  /** 容器镜像 */
  image?: string;
  /** 提供者特定配置 */
  providerConfig?: Record<string, unknown>;
}

/**
 * 沙箱提供者接口
 */
export interface ISandboxProvider {
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
  runScript(filePath: string, workDir: string, options?: ScriptOptions): Promise<SandboxExecResult>;

  /** 停止当前执行 */
  stop(): Promise<void>;

  /** 关闭提供者 */
  shutdown(): Promise<void>;

  /** 获取能力 */
  getCapabilities(): SandboxCapabilities;
}
```

---

## 提供者实现

### Native 提供者

**文件**: `packages/core/src/sandbox/providers/native.ts`

特点:
- 无隔离，直接使用 `spawn()` 执行
- 自动检测运行时 (node, python, bash)
- 支持包安装 (npm, pip)
- 始终可用，作为其他提供者的回退

```typescript
export class NativeProvider implements ISandboxProvider {
  readonly type: SandboxProviderType = 'native';
  readonly name = 'Native (No Isolation)';

  async isAvailable(): Promise<boolean> {
    return true; // 始终可用
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    const startTime = Date.now();
    const { command, args = [], cwd, env, timeout } = options;

    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        shell: true,
        timeout: timeout || 120000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          duration: Date.now() - startTime,
          provider: { type: 'native', name: this.name },
        });
      });
    });
  }

  async runScript(filePath: string, workDir: string, options?: ScriptOptions): Promise<SandboxExecResult> {
    // 自动检测运行时
    const ext = path.extname(filePath).toLowerCase();
    let runtime = 'node';
    let runtimeArgs: string[] = [];

    switch (ext) {
      case '.py': runtime = 'python3'; break;
      case '.ts':
      case '.mts': runtime = 'npx'; runtimeArgs = ['tsx']; break;
      case '.sh': runtime = 'bash'; break;
    }

    // 安装依赖包
    if (options?.packages?.length) {
      await this.exec({
        command: ext === '.py' ? 'pip3' : 'npm',
        args: ext === '.py'
          ? ['install', ...options.packages]
          : ['install', '--no-save', ...options.packages],
        cwd: workDir,
      });
    }

    return this.exec({
      command: runtime,
      args: [...runtimeArgs, filePath, ...(options?.args || [])],
      cwd: workDir,
      env: options?.env,
      timeout: options?.timeout,
    });
  }

  getCapabilities(): SandboxCapabilities {
    return {
      supportsVolumeMounts: false,
      supportsNetworking: true,
      isolation: 'none',
      supportedRuntimes: ['node', 'python', 'bun', 'bash'],
      supportsPooling: false,
    };
  }
}
```

### Codex 提供者

**文件**: `packages/core/src/sandbox/providers/codex.ts`

特点:
- 使用 OpenAI Codex CLI 的 sandbox 功能
- OS 级别隔离 (macOS 用 Seatbelt, Linux 用 Landlock)
- 不支持网络访问 (安全优先)
- 自动检测 codex 可执行文件路径

```typescript
export class CodexProvider implements ISandboxProvider {
  readonly type: SandboxProviderType = 'codex';
  readonly name = 'Codex CLI Sandbox';
  private codexPath: string | undefined;

  async isAvailable(): Promise<boolean> {
    this.codexPath = await getCodexPath();
    return this.codexPath !== undefined;
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    if (!this.codexPath) {
      return { stdout: '', stderr: 'Codex CLI not installed', exitCode: 1, duration: 0 };
    }

    const os = platform();
    const sandboxSubcommand = os === 'darwin' ? 'macos' : 'linux';

    // codex sandbox macos/linux --full-auto -- command args
    const spawnArgs = ['sandbox', sandboxSubcommand, '--full-auto', '--', options.command, ...(options.args || [])];

    return this.spawnAndWait(this.codexPath, spawnArgs, options);
  }

  getCapabilities(): SandboxCapabilities {
    return {
      supportsVolumeMounts: false,
      supportsNetworking: false, // 安全优先
      isolation: 'process',
      supportedRuntimes: ['node', 'python', 'bun'],
      supportsPooling: false,
    };
  }
}
```

### Claude 提供者

**文件**: `packages/core/src/sandbox/providers/claude.ts`

特点:
- 使用 Anthropic 的 sandbox-runtime (`srt`)
- 进程级隔离
- 支持网络访问
- 自动检测 srt 可执行文件路径

```typescript
export class ClaudeProvider implements ISandboxProvider {
  readonly type: SandboxProviderType = 'claude';
  readonly name = 'Claude Sandbox';
  private srtPath: string | undefined;

  async isAvailable(): Promise<boolean> {
    this.srtPath = await getSrtPath();
    return this.srtPath !== undefined;
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    if (!this.srtPath) {
      return { stdout: '', stderr: 'srt not installed', exitCode: 1, duration: 0 };
    }

    // srt run -- command args
    const spawnArgs = ['run', '--', options.command, ...(options.args || [])];

    return this.spawnAndWait(this.srtPath, spawnArgs, options);
  }

  getCapabilities(): SandboxCapabilities {
    return {
      supportsVolumeMounts: false,
      supportsNetworking: true,
      isolation: 'process',
      supportedRuntimes: ['node', 'python', 'bun'],
      supportsPooling: false,
    };
  }
}
```

---

## 服务层

### packages/core/src/services/sandbox.ts

```typescript
import type { ISandboxProvider, SandboxExecOptions, SandboxExecResult, SandboxProviderType, ScriptOptions } from '../sandbox/types';
import { NativeProvider } from '../sandbox/providers/native';
import { CodexProvider } from '../sandbox/providers/codex';
import { ClaudeProvider } from '../sandbox/providers/claude';

export class SandboxService {
  private providers = new Map<SandboxProviderType, ISandboxProvider>();
  private initialized = false;

  /**
   * 初始化并检测可用提供者
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 注册所有提供者
    const providers: ISandboxProvider[] = [
      new NativeProvider(),
      new CodexProvider(),
      new ClaudeProvider(),
    ];

    for (const provider of providers) {
      const available = await provider.isAvailable();
      if (available) {
        await provider.init();
        this.providers.set(provider.type, provider);
        console.log(`[SandboxService] Provider available: ${provider.name}`);
      }
    }

    this.initialized = true;
  }

  /**
   * 获取最佳可用提供者
   * 优先级: codex > claude > native
   */
  async getBestProvider(preferred?: SandboxProviderType): Promise<ISandboxProvider> {
    await this.init();

    // 如果指定了首选提供者且可用，使用它
    if (preferred && this.providers.has(preferred)) {
      return this.providers.get(preferred)!;
    }

    // 按优先级选择
    const priority: SandboxProviderType[] = ['codex', 'claude', 'native'];
    for (const type of priority) {
      if (this.providers.has(type)) {
        return this.providers.get(type)!;
      }
    }

    throw new Error('No sandbox provider available');
  }

  /**
   * 执行命令
   */
  async exec(options: SandboxExecOptions, preferred?: SandboxProviderType): Promise<SandboxExecResult> {
    const provider = await this.getBestProvider(preferred);
    return provider.exec(options);
  }

  /**
   * 运行脚本
   */
  async runScript(filePath: string, workDir: string, options?: ScriptOptions, preferred?: SandboxProviderType): Promise<SandboxExecResult> {
    const provider = await this.getBestProvider(preferred);
    return provider.runScript(filePath, workDir, options);
  }

  /**
   * 获取可用提供者列表
   */
  async getAvailableProviders(): Promise<SandboxProviderType[]> {
    await this.init();
    return Array.from(this.providers.keys());
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.shutdown();
    }
    this.providers.clear();
    this.initialized = false;
  }
}

// 单例
let sandboxService: SandboxService | null = null;

export function getSandboxService(): SandboxService {
  if (!sandboxService) {
    sandboxService = new SandboxService();
  }
  return sandboxService;
}
```

---

## Gateway 路由

### packages/core/src/gateway/routes/sandbox.ts

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/sandbox/available` | GET | 获取可用提供者列表 |
| `/api/sandbox/exec` | POST | 执行命令 |
| `/api/sandbox/run/file` | POST | 运行脚本文件 |

```typescript
import type { FastifyInstance } from "fastify";
import { getSandboxService } from "../../services/sandbox";

export function registerSandboxRoutes(fastify: FastifyInstance): void {
  const sandboxService = getSandboxService();

  // GET /api/sandbox/available
  fastify.get("/api/sandbox/available", async () => {
    const providers = await sandboxService.getAvailableProviders();
    return { providers };
  });

  // POST /api/sandbox/exec
  fastify.post<{
    Body: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      provider?: string;
    };
  }>("/api/sandbox/exec", async (request) => {
    const { command, args, cwd, env, timeout, provider } = request.body;
    const result = await sandboxService.exec(
      { command, args, cwd, env, timeout },
      provider as any
    );
    return result;
  });

  // POST /api/sandbox/run/file
  fastify.post<{
    Body: {
      filePath: string;
      workDir: string;
      args?: string[];
      packages?: string[];
      timeout?: number;
      provider?: string;
    };
  }>("/api/sandbox/run/file", async (request) => {
    const { filePath, workDir, args, packages, timeout, provider } = request.body;
    const result = await sandboxService.runScript(
      filePath,
      workDir,
      { args, packages, timeout },
      provider as any
    );
    return result;
  });
}
```

---

## 会话配置集成

### sandboxConfig 作为会话配置

`sandboxConfig` 属于会话级别配置，不属于 Agent 配置。在 agent 执行请求中通过会话配置传递。

**注意**: 不修改 `Agent` 接口或 `AgentConfig`，而是在请求层面传递 sandboxConfig。

```typescript
// POST /api/agent/run 请求体 (增加 sandboxConfig)
interface AgentRunRequest {
  prompt: string;
  cwd?: string;
  agentConfigPath?: string;  // 智能体配置文件路径 (e.g., /path/to/agents/myagent/AGENTS.md)
  agentConfig?: AgentConfigPayload;
  sessionId?: string;
  taskId?: string;
  // 会话级别沙箱配置
  sandboxConfig?: SandboxConfig;
}
```

---

## 文件结构

### 新增文件

```
packages/core/src/sandbox/
├── types.ts                    # 沙箱类型定义
└── providers/
    ├── index.ts                # 提供者注册和导出
    ├── native.ts               # Native 提供者
    ├── codex.ts                # Codex 提供者
    └── claude.ts               # Claude 提供者

packages/core/src/services/
└── sandbox.ts                  # 沙箱服务

packages/core/src/gateway/routes/
└── sandbox.ts                  # 沙箱 API 路由
```

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `packages/core/src/gateway/index.ts` | 注册 sandbox 路由 |
| `packages/core/src/services/index.ts` | 导出 sandbox 服务 |

---

## 实现顺序

1. **Phase 1**: 类型定义 (`sandbox/types.ts`)
2. **Phase 2**: Native 提供者 (`sandbox/providers/native.ts`)
3. **Phase 3**: Codex 提供者 (`sandbox/providers/codex.ts`)
4. **Phase 4**: Claude 提供者 (`sandbox/providers/claude.ts`)
5. **Phase 5**: 提供者注册 (`sandbox/providers/index.ts`)
6. **Phase 6**: 沙箱服务 (`services/sandbox.ts`)
7. **Phase 7**: Gateway 路由 (`gateway/routes/sandbox.ts`)

---

## 验证步骤

1. `pnpm typecheck` - 确保类型编译通过
2. `pnpm build` - 确保所有包构建成功
3. 测试 API 端点:
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

---

## 常见问题

### Codex 提供者不可用

检查 Codex CLI 是否安装:
```bash
which codex
# 或
npm install -g @openai/codex
```

### Claude 提供者不可用

检查 sandbox-runtime 是否安装:
```bash
which srt
# 或
npm install -g @anthropic-ai/sandbox-runtime
```

### 网络访问问题

- Codex 提供者默认禁用网络访问 (安全设计)
- 需要网络访问时使用 Claude 或 Native 提供者

---

## 参考文档

- WorkAny 沙箱系统: `/docs/work/sandbox-system.md`
- WorkAny 后端 API: `/docs/work/backend-api.md`
- WorkAny 迁移规范: `.trellis/spec/modules/chat/workany-migration.md`
