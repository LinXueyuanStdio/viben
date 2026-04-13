# Desktop Onboarding 完整重设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 参考 Qclaw 实现，完整重设计 viben desktop onboarding 流程，补齐所有缺失功能

**Architecture:**
- 新增 CLI 下载安装系统（支持 npm 镜像回退）
- 新增版本管控系统（最低/最高版本检查，自动升级/降级）
- 重构错误处理系统（14种错误类型，结构化故障视图）
- 重构轮询系统（指数退避，可中断）
- 新增系统对话框处理（Xcode CLT，管理员权限）
- 优化进度显示（加权任务，旋转提示）

**Tech Stack:** React, TypeScript, Tauri commands, i18n

---

## Qclaw 参考文件索引

### 核心页面组件
| 文件 | 用途 |
|------|------|
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` | 环境检查页面 (2104行) |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx` | Gateway 启动门控页面 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/Welcome.tsx` | 欢迎页面 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/App.tsx` | 主应用状态机 |

### Electron 主进程
| 文件 | 用途 |
|------|------|
| `/Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts` | CLI 执行层 (~2500行) |
| `/Users/lxy/Documents/GitHub/others/Qclaw/electron/main/node-installation-policy.ts` | Node.js 安装策略 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/electron/main/node-installer-checks.ts` | 安装包校验 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/electron/main/openclaw-gateway-service.ts` | Gateway 服务管理 (2278行) |

### 共享逻辑
| 文件 | 用途 |
|------|------|
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/openclaw-version-policy.ts` | 版本管控策略 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/openclaw-phase1.ts` | CLI 发现与安装决策 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts` | 14种错误类型定义 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-state.ts` | 18种 Gateway 运行时状态 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-diagnostics.ts` | Gateway 状态诊断 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-bootstrap-diagnostics.ts` | Bootstrap 故障视图 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/dashboard-entry-bootstrap.ts` | 加权进度计算 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/polling.ts` | 指数退避轮询 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/runtime-policies.ts` | 运行时策略常量 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/env-check-policy.ts` | 环境检查策略 |

---

## 文件结构规划

### 新增文件
```
apps/desktop/src/
├── lib/
│   └── onboarding/
│       ├── version-policy.ts          # 版本管控策略
│       ├── installer-issues.ts        # 错误类型定义
│       ├── gateway-diagnostics.ts     # Gateway 诊断
│       ├── bootstrap-diagnostics.ts   # Bootstrap 故障视图
│       ├── polling.ts                 # 指数退避轮询
│       └── runtime-policies.ts        # 运行时策略常量
├── components/
│   └── onboarding/
│       ├── loading-screen.tsx         # 加载屏幕（带动画）
│       ├── startup-issue-dialog.tsx   # 系统问题对话框
│       └── failure-view.tsx           # 结构化故障视图
└── hooks/
    └── use-cli-installer.ts           # CLI 安装 hook

apps/desktop/src-tauri/src/commands/
└── cli_installer.rs                   # CLI 下载安装命令

packages/core/src/
└── gateway/routes/
    └── version.ts                     # 版本检查路由
```

### 修改文件
```
apps/desktop/src/
├── components/onboarding/
│   ├── step-gateway.tsx               # 重构：加权进度、错误分类
│   ├── step-python.tsx                # 增强：版本检查
│   ├── onboarding-progress.tsx        # 增强：加权进度显示
│   └── onboarding-wizard.tsx          # 增强：进度持久化
├── hooks/
│   ├── use-gateway.ts                 # 增强：版本检查、诊断
│   └── use-gateway-status.ts          # 重构：指数退避
├── i18n/locales/
│   ├── en.json                        # 新增错误消息
│   └── zh-CN.json                     # 新增错误消息
└── src-tauri/src/commands/
    └── gateway.rs                      # 增强：版本检查
```

---

## 实现任务列表

### 模块一：基础设施 (Task 1-6)

#### Task 1: 创建运行时策略常量

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/runtime-policies.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/runtime-policies.ts`

- [ ] **Step 1: 创建运行时策略文件**

```typescript
/**
 * Runtime policies for onboarding
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/runtime-policies.ts
 */

// ============================================================================
// Polling Policies
// ============================================================================

export interface BackoffPollingPolicy {
  /** 总超时时间 (ms) */
  timeoutMs: number;
  /** 初始轮询间隔 (ms) */
  initialIntervalMs: number;
  /** 最大轮询间隔 (ms) */
  maxIntervalMs: number;
  /** 退避因子 */
  backoffFactor: number;
}

export const GATEWAY_READINESS_POLICY: BackoffPollingPolicy = {
  timeoutMs: 45_000,
  initialIntervalMs: 1_000,
  maxIntervalMs: 4_000,
  backoffFactor: 1.5,
};

export const CLI_AVAILABILITY_POLICY: BackoffPollingPolicy = {
  timeoutMs: 45_000,
  initialIntervalMs: 500,
  maxIntervalMs: 2_000,
  backoffFactor: 1.5,
};

// ============================================================================
// Timeout Policies
// ============================================================================

export const CLI_TIMEOUTS = {
  /** 默认命令超时 */
  defaultCommandTimeoutMs: 30_000,
  /** Gateway 启动超时 */
  gatewayStartTimeoutMs: 60_000,
  /** Gateway 停止超时 */
  gatewayStopTimeoutMs: 10_000,
  /** 版本检查超时 */
  versionCheckTimeoutMs: 5_000,
  /** 下载超时 */
  downloadTimeoutMs: 300_000, // 5 minutes
};

// ============================================================================
// UI Runtime Defaults
// ============================================================================

export const UI_RUNTIME_DEFAULTS = Object.freeze({
  envCheck: {
    /** 加载提示轮换间隔 (ms) */
    loadingTipRotateMs: 3_000,
    /** 进度条更新间隔 (ms) */
    progressTickMs: 50,
    /** 每次进度增量 */
    progressStep: 2,
    /** 启动延迟 (ms) */
    startupDelayMs: 0,
    /** 短过渡时间 (ms) */
    transitionShortMs: 300,
    /** 标准过渡时间 (ms) */
    transitionStandardMs: 500,
    /** 稳定过渡时间 (ms) */
    transitionSettleMs: 800,
  },
  gatewayBootstrap: {
    /** 基线进度百分比 */
    baselineProgress: 8,
    /** 进度条动画时间 (ms) */
    progressAnimationMs: 300,
  },
});

// ============================================================================
// Task Weights for Progress Calculation
// ============================================================================

export type OnboardingTaskKey = "gateway" | "config" | "python" | "claude";

export const ONBOARDING_TASK_WEIGHTS: Record<OnboardingTaskKey, number> = {
  gateway: 0.5,  // 50%
  config: 0.2,   // 20%
  python: 0.2,   // 20%
  claude: 0.1,   // 10%
};

// ============================================================================
// Retry Policies
// ============================================================================

export const RETRY_POLICIES = {
  /** Gateway 启动最大重试次数 */
  gatewayStartMaxRetries: 3,
  /** CLI 安装最大重试次数 */
  cliInstallMaxRetries: 2,
  /** npm 镜像回退重试次数 */
  npmMirrorFallbackRetries: 2,
};
```

- [ ] **Step 2: 保存文件**

---

#### Task 2: 创建指数退避轮询工具

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/polling.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/polling.ts`

- [ ] **Step 1: 创建轮询工具文件**

```typescript
/**
 * Polling utilities with exponential backoff
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/polling.ts
 */

import type { BackoffPollingPolicy } from "./runtime-policies";

// ============================================================================
// Types
// ============================================================================

export interface PollWithBackoffOptions<T> {
  /** 轮询策略 */
  policy: BackoffPollingPolicy;
  /** 执行轮询的函数，返回 { done: true, value } 或 { done: false } */
  poll: () => Promise<{ done: true; value: T } | { done: false }>;
  /** 是否应该中断轮询 */
  shouldAbort?: () => boolean;
  /** 每次尝试后的回调 */
  onAttempt?: (attempt: number, nextIntervalMs: number) => void;
}

export type PollWithBackoffResult<T> =
  | { success: true; value: T; attempts: number }
  | { success: false; reason: "timeout" | "aborted"; attempts: number };

// ============================================================================
// Implementation
// ============================================================================

/**
 * 使用指数退避策略进行轮询
 *
 * @example
 * ```typescript
 * const result = await pollWithBackoff({
 *   policy: GATEWAY_READINESS_POLICY,
 *   poll: async () => {
 *     const connected = await checkGatewayConnection();
 *     return connected ? { done: true, value: true } : { done: false };
 *   },
 *   shouldAbort: () => isCancelled,
 *   onAttempt: (attempt, nextInterval) => {
 *     console.log(`Attempt ${attempt}, next in ${nextInterval}ms`);
 *   },
 * });
 * ```
 */
export async function pollWithBackoff<T>(
  options: PollWithBackoffOptions<T>
): Promise<PollWithBackoffResult<T>> {
  const { policy, poll, shouldAbort, onAttempt } = options;
  const { timeoutMs, initialIntervalMs, maxIntervalMs, backoffFactor } = policy;

  const startTime = Date.now();
  let attempts = 0;
  let currentInterval = initialIntervalMs;

  while (true) {
    // 检查是否应该中断
    if (shouldAbort?.()) {
      return { success: false, reason: "aborted", attempts };
    }

    // 检查是否超时
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      return { success: false, reason: "timeout", attempts };
    }

    attempts++;

    try {
      const result = await poll();
      if (result.done) {
        return { success: true, value: result.value, attempts };
      }
    } catch {
      // 轮询失败，继续下一次尝试
    }

    // 计算下一次间隔
    const nextInterval = Math.min(currentInterval * backoffFactor, maxIntervalMs);

    // 回调
    onAttempt?.(attempts, nextInterval);

    // 等待
    await sleep(currentInterval);
    currentInterval = nextInterval;
  }
}

/**
 * 简单的 sleep 函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建一个可取消的轮询控制器
 */
export function createPollController() {
  let aborted = false;

  return {
    abort: () => { aborted = true; },
    shouldAbort: () => aborted,
    reset: () => { aborted = false; },
  };
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 3: 创建错误类型定义

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/installer-issues.ts`

- [ ] **Step 1: 创建错误类型文件**

```typescript
/**
 * Installer issue types and error classification
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts
 */

// ============================================================================
// CLI Installer Issue Types (14 types)
// ============================================================================

export type CliInstallerIssueKind =
  | "missing-cli"              // CLI 未安装
  | "version-too-low"          // 版本过低
  | "version-too-high"         // 版本过高 (可能不兼容)
  | "missing-node"             // Node.js 未安装
  | "node-version-mismatch"    // Node.js 版本不匹配
  | "npm-not-found"            // npm 未找到
  | "npm-registry-error"       // npm 仓库错误
  | "download-failed"          // 下载失败
  | "install-failed"           // 安装失败
  | "permission-denied"        // 权限不足
  | "user-cancelled"           // 用户取消
  | "network-error"            // 网络错误
  | "xcode-clt-pending"        // macOS: Xcode CLT 待安装
  | "unknown-error";           // 未知错误

// ============================================================================
// CLI Installer Issue Structure
// ============================================================================

export interface CliInstallerIssue {
  kind: CliInstallerIssueKind;
  title: string;
  message: string;
  details?: string;
  /** 是否阻断流程 */
  blocking: boolean;
  /** 建议的操作 */
  suggestedActions: SuggestedAction[];
}

export type SuggestedAction =
  | { type: "retry" }
  | { type: "skip" }
  | { type: "manual-download"; url: string }
  | { type: "open-link"; url: string; label: string }
  | { type: "run-command"; command: string; label: string }
  | { type: "contact-support" };

// ============================================================================
// Issue Factory
// ============================================================================

export function createCliInstallerIssue(
  kind: CliInstallerIssueKind,
  details?: string
): CliInstallerIssue {
  return {
    kind,
    ...getIssueContent(kind),
    details,
    blocking: isBlockingIssue(kind),
    suggestedActions: getSuggestedActions(kind),
  };
}

function getIssueContent(kind: CliInstallerIssueKind): { title: string; message: string } {
  switch (kind) {
    case "missing-cli":
      return {
        title: "Viben CLI 未安装",
        message: "需要安装 Viben CLI 才能继续。系统将尝试自动安装。",
      };
    case "version-too-low":
      return {
        title: "Viben CLI 版本过低",
        message: "当前安装的 Viben CLI 版本不满足最低要求，需要升级。",
      };
    case "version-too-high":
      return {
        title: "Viben CLI 版本过高",
        message: "当前安装的 Viben CLI 版本可能与此应用不兼容。",
      };
    case "missing-node":
      return {
        title: "Node.js 未安装",
        message: "Viben CLI 需要 Node.js 运行环境。请先安装 Node.js。",
      };
    case "node-version-mismatch":
      return {
        title: "Node.js 版本不匹配",
        message: "当前 Node.js 版本不满足要求。建议使用 Node.js 18 或更高版本。",
      };
    case "npm-not-found":
      return {
        title: "npm 未找到",
        message: "无法找到 npm 命令。请确保 Node.js 正确安装。",
      };
    case "npm-registry-error":
      return {
        title: "npm 仓库错误",
        message: "无法连接到 npm 仓库。将尝试使用镜像源。",
      };
    case "download-failed":
      return {
        title: "下载失败",
        message: "下载 Viben CLI 失败。请检查网络连接后重试。",
      };
    case "install-failed":
      return {
        title: "安装失败",
        message: "安装 Viben CLI 失败。请查看详细错误信息。",
      };
    case "permission-denied":
      return {
        title: "权限不足",
        message: "安装需要更高权限。请以管理员身份运行或手动安装。",
      };
    case "user-cancelled":
      return {
        title: "已取消",
        message: "安装已被取消。",
      };
    case "network-error":
      return {
        title: "网络错误",
        message: "网络连接失败。请检查网络设置后重试。",
      };
    case "xcode-clt-pending":
      return {
        title: "等待 Xcode Command Line Tools 安装完成",
        message: "已触发 Xcode 命令行工具安装。请在系统弹窗中完成安装，然后点击重试。",
      };
    case "unknown-error":
    default:
      return {
        title: "未知错误",
        message: "发生了未知错误。请查看详细信息或联系支持。",
      };
  }
}

function isBlockingIssue(kind: CliInstallerIssueKind): boolean {
  // 以下错误不阻断流程，可以跳过
  const nonBlockingIssues: CliInstallerIssueKind[] = [
    "version-too-high",
    "user-cancelled",
  ];
  return !nonBlockingIssues.includes(kind);
}

function getSuggestedActions(kind: CliInstallerIssueKind): SuggestedAction[] {
  switch (kind) {
    case "missing-cli":
    case "version-too-low":
      return [{ type: "retry" }];
    case "version-too-high":
      return [{ type: "skip" }, { type: "retry" }];
    case "missing-node":
      return [
        { type: "open-link", url: "https://nodejs.org/", label: "下载 Node.js" },
        { type: "retry" },
      ];
    case "npm-registry-error":
    case "network-error":
    case "download-failed":
      return [{ type: "retry" }];
    case "install-failed":
    case "permission-denied":
      return [
        { type: "manual-download", url: "https://github.com/LinXueyuanStdio/viben" },
        { type: "retry" },
      ];
    case "user-cancelled":
      return [{ type: "retry" }, { type: "skip" }];
    case "xcode-clt-pending":
      return [{ type: "retry" }];
    case "unknown-error":
    default:
      return [{ type: "retry" }, { type: "contact-support" }];
  }
}

// ============================================================================
// Error Classification from Raw Error
// ============================================================================

/**
 * 从原始错误信息分类错误类型
 *
 * Qclaw 参考: classifyMacNodeInstallerFailure in node-installer-issues.ts:176-230
 */
export function classifyInstallerError(rawError: string): CliInstallerIssueKind {
  const normalized = rawError.toLowerCase();

  // 用户取消
  if (normalized.includes("user canceled") || normalized.includes("(-128)") || normalized.includes("cancelled")) {
    return "user-cancelled";
  }

  // 权限问题
  if (normalized.includes("permission denied") || normalized.includes("eacces") || normalized.includes("eperm")) {
    return "permission-denied";
  }

  // 网络问题
  if (
    normalized.includes("network") ||
    normalized.includes("enotfound") ||
    normalized.includes("etimedout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset")
  ) {
    return "network-error";
  }

  // npm 仓库问题
  if (normalized.includes("npm err") || normalized.includes("registry")) {
    return "npm-registry-error";
  }

  // Xcode CLT (macOS)
  if (
    normalized.includes("xcode-select") ||
    normalized.includes("command line tools") ||
    normalized.includes("developer tools")
  ) {
    return "xcode-clt-pending";
  }

  // 下载失败
  if (normalized.includes("download") || normalized.includes("fetch")) {
    return "download-failed";
  }

  return "unknown-error";
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 4: 创建 Gateway 运行时状态类型

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-state.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/gateway-diagnostics.ts`

- [ ] **Step 1: 创建 Gateway 诊断文件**

```typescript
/**
 * Gateway runtime state and diagnostics
 *
 * Qclaw 参考:
 * - /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-state.ts
 * - /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-diagnostics.ts
 */

// ============================================================================
// Gateway Runtime State Codes (18 types)
// ============================================================================

export type GatewayRuntimeStateCode =
  | "healthy"                      // 正常运行
  | "not_running"                  // 未运行
  | "starting"                     // 正在启动
  | "stopping"                     // 正在停止
  | "port_conflict_same"           // 端口被同一 Gateway 占用
  | "port_conflict_foreign"        // 端口被其他进程占用
  | "token_mismatch"               // Token 不匹配
  | "auth_missing"                 // 认证信息缺失
  | "config_invalid"               // 配置无效
  | "version_mismatch"             // 版本不匹配
  | "cli_not_found"                // CLI 未找到
  | "cli_error"                    // CLI 执行错误
  | "connection_refused"           // 连接被拒绝
  | "connection_timeout"           // 连接超时
  | "websocket_error"              // WebSocket 错误
  | "network_blocked"              // 网络被阻断
  | "service_stale"                // 服务过期
  | "unknown_error";               // 未知错误

// ============================================================================
// Gateway State
// ============================================================================

export interface GatewayRuntimeState {
  code: GatewayRuntimeStateCode;
  /** 是否健康 */
  healthy: boolean;
  /** 进程 ID (如果运行中) */
  pid?: number;
  /** 端口号 */
  port?: number;
  /** Gateway URL */
  url?: string;
  /** 版本号 */
  version?: string;
  /** 错误详情 */
  error?: string;
  /** 最后检查时间 */
  lastChecked: number;
}

// ============================================================================
// State Classification
// ============================================================================

/**
 * 判断状态是否允许继续
 */
export function isRecoverableState(code: GatewayRuntimeStateCode): boolean {
  const recoverableCodes: GatewayRuntimeStateCode[] = [
    "not_running",
    "starting",
    "port_conflict_same",
    "token_mismatch",
    "service_stale",
  ];
  return recoverableCodes.includes(code);
}

/**
 * 判断状态是否为致命错误
 */
export function isFatalState(code: GatewayRuntimeStateCode): boolean {
  const fatalCodes: GatewayRuntimeStateCode[] = [
    "cli_not_found",
    "config_invalid",
    "network_blocked",
  ];
  return fatalCodes.includes(code);
}

/**
 * 判断状态是否为软警告 (可继续但有问题)
 */
export function isWarningState(code: GatewayRuntimeStateCode): boolean {
  const warningCodes: GatewayRuntimeStateCode[] = [
    "version_mismatch",
    "port_conflict_foreign",
  ];
  return warningCodes.includes(code);
}

// ============================================================================
// Error Pattern Matching
// ============================================================================

/**
 * 从错误输出分类 Gateway 状态
 *
 * Qclaw 参考: gateway-runtime-diagnostics.ts
 */
export function classifyGatewayError(errorOutput: string): GatewayRuntimeStateCode {
  const normalized = errorOutput.toLowerCase();

  // 端口冲突
  if (normalized.includes("eaddrinuse") || normalized.includes("port") && normalized.includes("in use")) {
    if (normalized.includes("viben") || normalized.includes("gateway")) {
      return "port_conflict_same";
    }
    return "port_conflict_foreign";
  }

  // Token/认证问题
  if (normalized.includes("token") || normalized.includes("unauthorized") || normalized.includes("401")) {
    return "token_mismatch";
  }
  if (normalized.includes("auth") || normalized.includes("authentication")) {
    return "auth_missing";
  }

  // 连接问题
  if (normalized.includes("econnrefused") || normalized.includes("connection refused")) {
    return "connection_refused";
  }
  if (normalized.includes("etimedout") || normalized.includes("timeout")) {
    return "connection_timeout";
  }
  if (normalized.includes("websocket") || normalized.includes("ws://") || normalized.includes("1006")) {
    return "websocket_error";
  }

  // CLI 问题
  if (normalized.includes("command not found") || normalized.includes("not found")) {
    return "cli_not_found";
  }

  // 配置问题
  if (normalized.includes("config") || normalized.includes("invalid")) {
    return "config_invalid";
  }

  return "unknown_error";
}

// ============================================================================
// Human-Readable State Description
// ============================================================================

export interface GatewayStateDescription {
  title: string;
  detail: string;
  severity: "info" | "warning" | "error";
}

export function getGatewayStateDescription(code: GatewayRuntimeStateCode): GatewayStateDescription {
  switch (code) {
    case "healthy":
      return { title: "Gateway 运行正常", detail: "所有服务正常运行中。", severity: "info" };
    case "not_running":
      return { title: "Gateway 未运行", detail: "Gateway 服务尚未启动。", severity: "warning" };
    case "starting":
      return { title: "Gateway 正在启动", detail: "请稍候...", severity: "info" };
    case "stopping":
      return { title: "Gateway 正在停止", detail: "请稍候...", severity: "info" };
    case "port_conflict_same":
      return { title: "端口被占用", detail: "检测到另一个 Gateway 实例正在运行。", severity: "warning" };
    case "port_conflict_foreign":
      return { title: "端口冲突", detail: "端口被其他程序占用。建议更换端口或关闭冲突程序。", severity: "error" };
    case "token_mismatch":
      return { title: "认证 Token 不匹配", detail: "尝试重新启动 Gateway 以刷新认证。", severity: "warning" };
    case "auth_missing":
      return { title: "认证信息缺失", detail: "需要重新配置认证信息。", severity: "error" };
    case "config_invalid":
      return { title: "配置无效", detail: "Gateway 配置文件存在问题。请检查配置。", severity: "error" };
    case "version_mismatch":
      return { title: "版本不匹配", detail: "Gateway 版本与应用不兼容。建议更新。", severity: "warning" };
    case "cli_not_found":
      return { title: "CLI 未找到", detail: "无法找到 Viben CLI。请先安装。", severity: "error" };
    case "cli_error":
      return { title: "CLI 执行错误", detail: "执行 Viben CLI 命令时出错。", severity: "error" };
    case "connection_refused":
      return { title: "连接被拒绝", detail: "无法连接到 Gateway。服务可能未启动。", severity: "error" };
    case "connection_timeout":
      return { title: "连接超时", detail: "连接 Gateway 超时。请检查网络或重试。", severity: "error" };
    case "websocket_error":
      return { title: "WebSocket 错误", detail: "WebSocket 连接异常。", severity: "error" };
    case "network_blocked":
      return { title: "网络被阻断", detail: "网络连接被防火墙或代理阻断。", severity: "error" };
    case "service_stale":
      return { title: "服务过期", detail: "Gateway 服务状态过期，需要重新启动。", severity: "warning" };
    case "unknown_error":
    default:
      return { title: "未知错误", detail: "发生未知错误。请查看日志获取详情。", severity: "error" };
  }
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 5: 创建结构化故障视图

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-bootstrap-diagnostics.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/bootstrap-diagnostics.ts`

- [ ] **Step 1: 创建 Bootstrap 诊断文件**

```typescript
/**
 * Bootstrap failure view generation
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-bootstrap-diagnostics.ts
 */

import type { GatewayRuntimeStateCode } from "./gateway-diagnostics";
import type { CliInstallerIssueKind } from "./installer-issues";

// ============================================================================
// Failure View Structure
// ============================================================================

export interface FailureView {
  /** 标题 - 简短描述问题 */
  title: string;
  /** 详情 - 技术解释 */
  detail: string;
  /** 提示 - 可操作的建议列表 */
  hints: string[];
  /** 严重程度 */
  severity: "warning" | "error" | "fatal";
  /** 是否可恢复 */
  recoverable: boolean;
}

// ============================================================================
// Factory Function
// ============================================================================

function createView(
  title: string,
  detail: string,
  hints: string[],
  options: { severity?: FailureView["severity"]; recoverable?: boolean } = {}
): FailureView {
  return {
    title,
    detail,
    hints,
    severity: options.severity ?? "error",
    recoverable: options.recoverable ?? true,
  };
}

// ============================================================================
// Gateway State to Failure View
// ============================================================================

export function createGatewayFailureView(
  stateCode: GatewayRuntimeStateCode,
  context?: { port?: number; version?: string; error?: string }
): FailureView {
  switch (stateCode) {
    case "port_conflict_same":
      return createView(
        "检测到另一个 Gateway 实例",
        `端口 ${context?.port ?? 18790} 已被另一个 Viben Gateway 占用。`,
        [
          "点击"重试"将尝试接管现有实例",
          "或在设置中更改 Gateway 端口",
        ],
        { severity: "warning" }
      );

    case "port_conflict_foreign":
      return createView(
        "端口被其他程序占用",
        `端口 ${context?.port ?? 18790} 被其他程序占用，无法启动 Gateway。`,
        [
          `查找并关闭占用端口 ${context?.port ?? 18790} 的程序`,
          "或在设置中更改 Gateway 端口",
          `可以运行 'lsof -i :${context?.port ?? 18790}' (macOS/Linux) 查看占用进程`,
        ],
        { severity: "error" }
      );

    case "token_mismatch":
    case "auth_missing":
      return createView(
        "认证信息需要刷新",
        "Gateway 的认证 Token 已过期或不匹配。",
        [
          "点击"重试"将重新加载认证信息",
          "如果问题持续，尝试重新启动 Gateway",
        ],
        { severity: "warning" }
      );

    case "config_invalid":
      return createView(
        "配置文件无效",
        "Gateway 配置文件存在问题，无法启动服务。",
        [
          "检查 ~/.viben/config.yaml 配置文件",
          "尝试删除配置文件后重新设置",
          "查看日志获取详细错误信息",
        ],
        { severity: "error", recoverable: false }
      );

    case "cli_not_found":
      return createView(
        "Viben CLI 未安装",
        "无法找到 Viben CLI，需要先安装才能启动 Gateway。",
        [
          "点击"安装 Viben CLI"自动安装",
          "或手动运行: npm install -g viben",
          "访问 https://github.com/LinXueyuanStdio/viben 获取更多安装方式",
        ],
        { severity: "fatal", recoverable: false }
      );

    case "version_mismatch":
      return createView(
        "版本不兼容",
        `当前 Viben CLI 版本 ${context?.version ?? "未知"} 与应用不兼容。`,
        [
          "点击"升级"将自动更新到兼容版本",
          "或手动运行: npm update -g viben",
        ],
        { severity: "warning" }
      );

    case "connection_refused":
      return createView(
        "无法连接到 Gateway",
        "Gateway 服务可能未正常启动或已崩溃。",
        [
          "点击"重试"将尝试重新启动 Gateway",
          "检查系统日志是否有错误信息",
        ],
        { severity: "error" }
      );

    case "connection_timeout":
      return createView(
        "连接超时",
        "连接 Gateway 超时，服务响应过慢。",
        [
          "检查系统资源是否充足",
          "点击"重试"再次尝试连接",
        ],
        { severity: "warning" }
      );

    case "network_blocked":
      return createView(
        "网络连接被阻断",
        "本地网络连接被防火墙或安全软件阻断。",
        [
          "检查防火墙设置，允许 localhost 连接",
          "如果使用 VPN 或代理，尝试暂时禁用",
          "检查是否有安全软件阻止本地服务",
        ],
        { severity: "error", recoverable: false }
      );

    case "service_stale":
      return createView(
        "服务状态过期",
        "Gateway 服务状态异常，需要重新启动。",
        [
          "点击"重试"将重新启动 Gateway",
        ],
        { severity: "warning" }
      );

    case "unknown_error":
    default:
      return createView(
        "启动 Gateway 时出错",
        context?.error ?? "发生了未知错误。",
        [
          "点击"重试"再次尝试",
          "查看应用日志获取详细信息",
          "如果问题持续，请联系支持",
        ],
        { severity: "error" }
      );
  }
}

// ============================================================================
// CLI Installer Issue to Failure View
// ============================================================================

export function createInstallerFailureView(
  issueKind: CliInstallerIssueKind,
  context?: { error?: string; version?: string }
): FailureView {
  switch (issueKind) {
    case "missing-cli":
      return createView(
        "需要安装 Viben CLI",
        "系统中未检测到 Viben CLI，需要安装后才能继续。",
        [
          "点击"自动安装"将通过 npm 安装",
          "或手动运行: npm install -g viben",
        ],
        { severity: "warning" }
      );

    case "version-too-low":
      return createView(
        "Viben CLI 版本过低",
        `当前版本 ${context?.version ?? "未知"} 不满足最低要求。`,
        [
          "点击"升级"自动更新到最新版本",
          "或手动运行: npm update -g viben",
        ],
        { severity: "warning" }
      );

    case "version-too-high":
      return createView(
        "Viben CLI 版本可能不兼容",
        `当前版本 ${context?.version ?? "未知"} 高于测试版本，可能存在兼容性问题。`,
        [
          "可以继续使用，但某些功能可能异常",
          "如遇问题，可降级到推荐版本",
        ],
        { severity: "warning" }
      );

    case "missing-node":
      return createView(
        "需要安装 Node.js",
        "Viben CLI 需要 Node.js 运行环境，但系统中未检测到。",
        [
          "访问 https://nodejs.org 下载安装 Node.js",
          "推荐使用 Node.js 18 LTS 或更高版本",
          "如果已安装，请确保 node 命令在 PATH 中",
        ],
        { severity: "fatal", recoverable: false }
      );

    case "npm-registry-error":
      return createView(
        "npm 仓库连接失败",
        "无法连接到 npm 仓库，将尝试使用镜像源。",
        [
          "检查网络连接",
          "点击"重试"将使用备用镜像源",
        ],
        { severity: "warning" }
      );

    case "download-failed":
      return createView(
        "下载失败",
        context?.error ?? "下载过程中出错。",
        [
          "检查网络连接后重试",
          "如果问题持续，尝试手动安装",
        ],
        { severity: "error" }
      );

    case "install-failed":
      return createView(
        "安装失败",
        context?.error ?? "安装过程中出错。",
        [
          "查看详细错误信息",
          "尝试手动运行安装命令",
          "检查是否有权限问题",
        ],
        { severity: "error" }
      );

    case "permission-denied":
      return createView(
        "权限不足",
        "安装操作需要更高权限。",
        [
          "macOS/Linux: 尝试使用 sudo 运行",
          "Windows: 以管理员身份运行",
          "或使用 nvm 安装 Node.js 避免权限问题",
        ],
        { severity: "error" }
      );

    case "xcode-clt-pending":
      return createView(
        "等待 Xcode Command Line Tools 安装",
        "已触发 Xcode 命令行工具安装，请在系统弹窗中完成安装。",
        [
          "在弹出的系统对话框中点击\"安装\"",
          "如果没有弹窗，点击屏幕右上角的安装图标",
          "安装完成后，点击\"重试\"继续",
        ],
        { severity: "warning" }
      );

    case "user-cancelled":
      return createView(
        "安装已取消",
        "您取消了安装操作。",
        [
          "点击\"重试\"重新开始安装",
          "或点击\"跳过\"继续（部分功能可能不可用）",
        ],
        { severity: "warning" }
      );

    case "network-error":
      return createView(
        "网络连接失败",
        "无法建立网络连接。",
        [
          "检查网络连接",
          "如果使用代理，请检查代理设置",
          "点击\"重试\"再次尝试",
        ],
        { severity: "error" }
      );

    case "unknown-error":
    default:
      return createView(
        "安装时出错",
        context?.error ?? "发生了未知错误。",
        [
          "查看详细错误信息",
          "点击\"重试\"再次尝试",
          "如果问题持续，请联系支持",
        ],
        { severity: "error" }
      );
  }
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 6: 创建版本管控策略

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/openclaw-version-policy.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/version-policy.ts`

- [ ] **Step 1: 创建版本策略文件**

```typescript
/**
 * Version policy for Viben CLI
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/openclaw-version-policy.ts
 */

// ============================================================================
// Version Constants
// ============================================================================

/** 最低支持版本 */
export const MIN_SUPPORTED_VERSION = "0.5.0";

/** 最高支持版本 (超过此版本可能不兼容) */
export const MAX_SUPPORTED_VERSION = "1.0.0";

/** 推荐安装版本 */
export const PINNED_VERSION = "0.5.0";

// ============================================================================
// Version Enforcement Types
// ============================================================================

export type VersionEnforcement =
  | "none"              // 版本符合要求，无需操作
  | "optional_upgrade"  // 可选升级 (有新版本可用)
  | "required_upgrade"  // 必须升级 (低于最低版本)
  | "auto_downgrade"    // 自动降级 (高于最高版本)
  | "manual_block";     // 阻断需手动处理

export type VersionPolicyState =
  | "supported_target"    // 版本正好是推荐版本
  | "supported_not_target" // 版本在支持范围内但不是推荐版本
  | "below_min"           // 低于最低版本
  | "above_max";          // 高于最高版本

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * 比较两个版本号
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const normalize = (v: string) => v.replace(/^v/, "").split("-")[0]; // 移除 v 前缀和预发布标签
  const partsA = normalize(a).split(".").map(Number);
  const partsB = normalize(b).split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * 检查版本是否满足最低要求
 */
export function meetsMinVersion(version: string): boolean {
  return compareVersions(version, MIN_SUPPORTED_VERSION) >= 0;
}

/**
 * 检查版本是否超过最高版本
 */
export function exceedsMaxVersion(version: string): boolean {
  return compareVersions(version, MAX_SUPPORTED_VERSION) > 0;
}

// ============================================================================
// Version Policy Classification
// ============================================================================

/**
 * 分类版本状态
 *
 * Qclaw 参考: classifyOpenClawVersionLockState
 */
export function classifyVersionState(version: string | null | undefined): VersionPolicyState {
  if (!version) {
    return "below_min"; // 无版本视为低于最低要求
  }

  const normalized = version.replace(/^v/, "");

  if (compareVersions(normalized, MIN_SUPPORTED_VERSION) < 0) {
    return "below_min";
  }

  if (compareVersions(normalized, MAX_SUPPORTED_VERSION) > 0) {
    return "above_max";
  }

  if (compareVersions(normalized, PINNED_VERSION) === 0) {
    return "supported_target";
  }

  return "supported_not_target";
}

/**
 * 根据版本状态确定执行策略
 */
export function getVersionEnforcement(state: VersionPolicyState): VersionEnforcement {
  switch (state) {
    case "supported_target":
      return "none";
    case "supported_not_target":
      return "optional_upgrade";
    case "below_min":
      return "required_upgrade";
    case "above_max":
      return "auto_downgrade"; // 或 "manual_block" 根据配置
  }
}

// ============================================================================
// Version Check Result
// ============================================================================

export interface VersionCheckResult {
  /** 当前版本 */
  currentVersion: string | null;
  /** 版本状态 */
  state: VersionPolicyState;
  /** 执行策略 */
  enforcement: VersionEnforcement;
  /** 是否需要操作 */
  actionRequired: boolean;
  /** 目标版本 (如果需要升级/降级) */
  targetVersion: string | null;
  /** 人类可读的描述 */
  message: string;
}

export function checkVersion(version: string | null | undefined): VersionCheckResult {
  const state = classifyVersionState(version);
  const enforcement = getVersionEnforcement(state);
  const actionRequired = enforcement !== "none" && enforcement !== "optional_upgrade";

  let message: string;
  let targetVersion: string | null = null;

  switch (state) {
    case "supported_target":
      message = `当前版本 ${version} 是推荐版本`;
      break;
    case "supported_not_target":
      message = `当前版本 ${version} 可用，推荐升级到 ${PINNED_VERSION}`;
      targetVersion = PINNED_VERSION;
      break;
    case "below_min":
      message = `当前版本 ${version ?? "未知"} 低于最低要求 ${MIN_SUPPORTED_VERSION}，需要升级`;
      targetVersion = PINNED_VERSION;
      break;
    case "above_max":
      message = `当前版本 ${version} 高于测试版本 ${MAX_SUPPORTED_VERSION}，可能存在兼容性问题`;
      targetVersion = PINNED_VERSION;
      break;
  }

  return {
    currentVersion: version ?? null,
    state,
    enforcement,
    actionRequired,
    targetVersion,
    message,
  };
}

// ============================================================================
// Install Source Detection
// ============================================================================

export type CliInstallSource =
  | "npm-global"    // npm -g 安装
  | "npx"           // npx 运行
  | "homebrew"      // Homebrew 安装
  | "bundled"       // 应用内置
  | "manual"        // 手动安装
  | "unknown";      // 未知

/**
 * 判断安装来源是否支持自动版本修正
 */
export function supportsAutoCorrection(source: CliInstallSource): boolean {
  // npm-global 和 bundled 支持自动修正
  // homebrew 需要手动操作
  // manual 和 unknown 不确定
  return source === "npm-global" || source === "bundled";
}
```

- [ ] **Step 2: 保存文件**

---

### 模块二：UI 组件 (Task 7-10)

#### Task 7: 创建结构化故障视图组件

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx` (错误显示部分)

**Files:**
- Create: `apps/desktop/src/components/onboarding/failure-view.tsx`

- [ ] **Step 1: 创建故障视图组件**

```tsx
/**
 * Structured failure view component
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  SkipForward,
  Terminal,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FailureView } from "@/lib/onboarding/bootstrap-diagnostics";
import type { SuggestedAction } from "@/lib/onboarding/installer-issues";

// ============================================================================
// Props
// ============================================================================

interface FailureViewProps {
  failure: FailureView;
  actions?: SuggestedAction[];
  onRetry?: () => void;
  onSkip?: () => void;
  isRetrying?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FailureViewDisplay({
  failure,
  actions,
  onRetry,
  onSkip,
  isRetrying,
  className,
}: FailureViewProps) {
  const { t } = useTranslation();

  const severityConfig = {
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
      iconColor: "text-yellow-500",
      titleColor: "text-yellow-700 dark:text-yellow-400",
    },
    error: {
      icon: AlertCircle,
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
      iconColor: "text-destructive",
      titleColor: "text-destructive",
    },
    fatal: {
      icon: XCircle,
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      iconColor: "text-red-600",
      titleColor: "text-red-700 dark:text-red-400",
    },
  };

  const config = severityConfig[failure.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-4",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", config.iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className={cn("font-medium", config.titleColor)}>
            {failure.title}
          </h3>
          <p className="text-sm text-muted-foreground">{failure.detail}</p>
        </div>
      </div>

      {/* Hints */}
      {failure.hints.length > 0 && (
        <div className="pl-8 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("onboarding.failure.suggestions")}
          </p>
          <ul className="space-y-1.5">
            {failure.hints.map((hint, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-muted-foreground/50">•</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {(actions && actions.length > 0) || onRetry || onSkip ? (
        <div className="flex flex-wrap gap-2 pl-8 pt-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")}
              />
              {isRetrying ? t("common.retrying") : t("common.retry")}
            </Button>
          )}

          {actions?.map((action, index) => (
            <ActionButton key={index} action={action} />
          ))}

          {onSkip && failure.recoverable && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <SkipForward className="mr-2 h-4 w-4" />
              {t("common.skip")}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Action Button
// ============================================================================

function ActionButton({ action }: { action: SuggestedAction }) {
  const { t } = useTranslation();

  switch (action.type) {
    case "open-link":
      return (
        <Button variant="outline" size="sm" asChild>
          <a href={action.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {action.label}
          </a>
        </Button>
      );

    case "manual-download":
      return (
        <Button variant="outline" size="sm" asChild>
          <a href={action.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("onboarding.failure.manualDownload")}
          </a>
        </Button>
      );

    case "run-command":
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(action.command)}
        >
          <Terminal className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      );

    case "contact-support":
      return (
        <Button variant="ghost" size="sm" asChild>
          <a
            href="https://github.com/LinXueyuanStdio/viben/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            {t("onboarding.failure.contactSupport")}
          </a>
        </Button>
      );

    default:
      return null;
  }
}

export { FailureViewDisplay as FailureView };
```

- [ ] **Step 2: 保存文件**

---

#### Task 8: 创建加载屏幕组件 (带动画和旋转提示)

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/components/LoadingScreen.tsx`

**Files:**
- Create: `apps/desktop/src/components/onboarding/loading-screen.tsx`

- [ ] **Step 1: 创建加载屏幕组件**

```tsx
/**
 * Loading screen with bouncing animation and rotating tips
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/components/LoadingScreen.tsx
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { UI_RUNTIME_DEFAULTS } from "@/lib/onboarding/runtime-policies";

// ============================================================================
// Loading Tips
// ============================================================================

const LOADING_TIPS = [
  "正在检查系统环境...",
  "Viben 支持 Claude Code、Cursor、Codex 等多种 AI 客户端",
  "所有配置和数据仅保存在您的电脑上",
  "Gateway 是 Viben 的本地后端服务",
  "安装过程可能需要网络连接",
  "请确保网络连接正常",
];

// ============================================================================
// Props
// ============================================================================

interface LoadingScreenProps {
  /** 当前进度 (0-100) */
  progress?: number;
  /** 状态文字 */
  status?: string;
  /** 是否显示进度条 */
  showProgress?: boolean;
  /** 是否显示旋转提示 */
  showTips?: boolean;
  /** 自定义提示列表 */
  tips?: string[];
  /** Logo 组件 */
  logo?: React.ReactNode;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function LoadingScreen({
  progress,
  status,
  showProgress = true,
  showTips = true,
  tips = LOADING_TIPS,
  logo,
  className,
}: LoadingScreenProps) {
  const [currentTipIndex, setCurrentTipIndex] = React.useState(0);

  // 旋转提示
  React.useEffect(() => {
    if (!showTips || tips.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, UI_RUNTIME_DEFAULTS.envCheck.loadingTipRotateMs);

    return () => clearInterval(interval);
  }, [showTips, tips]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[300px] space-y-8",
        className
      )}
    >
      {/* Logo with bounce animation */}
      <div className="animate-bounce-gentle">
        {logo ?? <DefaultLogo />}
      </div>

      {/* Status */}
      {status && (
        <p className="text-lg font-medium text-foreground">{status}</p>
      )}

      {/* Progress bar */}
      {showProgress && progress !== undefined && (
        <div className="w-full max-w-xs space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Rotating tips */}
      {showTips && tips.length > 0 && (
        <div className="h-6 overflow-hidden">
          <p
            key={currentTipIndex}
            className="text-sm text-muted-foreground text-center animate-fade-in"
          >
            {tips[currentTipIndex]}
          </p>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Default Logo
// ============================================================================

function DefaultLogo() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
      <span className="text-3xl">🚀</span>
    </div>
  );
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 9: 创建系统问题对话框组件

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` (StartupIssueDialog 部分)

**Files:**
- Create: `apps/desktop/src/components/onboarding/startup-issue-dialog.tsx`

- [ ] **Step 1: 创建系统问题对话框组件**

```tsx
/**
 * Startup issue dialog for system-level problems
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx (StartupIssueDialog)
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, ExternalLink, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CliInstallerIssueKind } from "@/lib/onboarding/installer-issues";

// ============================================================================
// Props
// ============================================================================

interface StartupIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKind: CliInstallerIssueKind;
  onRetry: () => void;
  isRetrying?: boolean;
}

// ============================================================================
// Issue Content
// ============================================================================

interface IssueContent {
  title: string;
  description: string;
  steps: string[];
  showTerminalHint?: boolean;
  externalLink?: { url: string; label: string };
}

function getIssueContent(kind: CliInstallerIssueKind): IssueContent {
  switch (kind) {
    case "xcode-clt-pending":
      return {
        title: "等待 Xcode Command Line Tools 安装",
        description:
          "已触发 Xcode 命令行工具安装。这是 macOS 开发所需的基础工具。",
        steps: [
          "在弹出的系统对话框中点击「安装」",
          "等待安装完成（可能需要几分钟）",
          "如果没有看到弹窗，请点击屏幕右上角的安装图标",
          "安装完成后，点击下方「重试检测」按钮",
        ],
        showTerminalHint: true,
      };

    case "missing-node":
      return {
        title: "需要安装 Node.js",
        description: "Viben CLI 需要 Node.js 运行环境才能工作。",
        steps: [
          "访问 nodejs.org 下载 Node.js",
          "推荐下载 LTS (长期支持) 版本",
          "运行安装程序并完成安装",
          "安装完成后，点击下方「重试检测」按钮",
        ],
        externalLink: {
          url: "https://nodejs.org/",
          label: "下载 Node.js",
        },
      };

    case "permission-denied":
      return {
        title: "权限不足",
        description: "安装操作需要更高的系统权限。",
        steps: [
          "macOS/Linux: 尝试在终端中使用 sudo 运行命令",
          "Windows: 右键点击终端，选择「以管理员身份运行」",
          "或者使用 nvm 管理 Node.js 以避免权限问题",
        ],
        showTerminalHint: true,
        externalLink: {
          url: "https://github.com/nvm-sh/nvm",
          label: "了解 nvm",
        },
      };

    case "network-error":
    case "npm-registry-error":
      return {
        title: "网络连接问题",
        description: "无法连接到 npm 仓库，可能是网络问题。",
        steps: [
          "检查网络连接是否正常",
          "如果使用代理，请检查代理设置",
          "尝试切换网络环境",
          "稍后重试",
        ],
      };

    default:
      return {
        title: "遇到问题",
        description: "安装过程中遇到了问题。",
        steps: [
          "查看详细错误信息",
          "尝试手动安装",
          "如果问题持续，请联系支持",
        ],
        externalLink: {
          url: "https://github.com/LinXueyuanStdio/viben/issues",
          label: "报告问题",
        },
      };
  }
}

// ============================================================================
// Component
// ============================================================================

export function StartupIssueDialog({
  open,
  onOpenChange,
  issueKind,
  onRetry,
  isRetrying,
}: StartupIssueDialogProps) {
  const { t } = useTranslation();
  const content = getIssueContent(issueKind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <DialogTitle>{content.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Steps */}
          <div className="space-y-2">
            <p className="text-sm font-medium">操作步骤：</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {content.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Terminal hint */}
          {content.showTerminalHint && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                也可以在终端中运行{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  xcode-select --install
                </code>
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {content.externalLink && (
            <Button variant="outline" asChild>
              <a
                href={content.externalLink.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {content.externalLink.label}
              </a>
            </Button>
          )}
          <Button onClick={onRetry} disabled={isRetrying}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "检测中..." : "重试检测"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 10: 添加 i18n 故障视图翻译

**Files:**
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: 添加英文翻译**

在 `apps/desktop/src/i18n/locales/en.json` 的 `onboarding` 部分添加：

```json
"failure": {
  "suggestions": "Suggestions",
  "manualDownload": "Manual Download",
  "contactSupport": "Contact Support",
  "copyCommand": "Copy Command"
}
```

- [ ] **Step 2: 添加中文翻译**

在 `apps/desktop/src/i18n/locales/zh-CN.json` 的 `onboarding` 部分添加：

```json
"failure": {
  "suggestions": "建议",
  "manualDownload": "手动下载",
  "contactSupport": "联系支持",
  "copyCommand": "复制命令"
}
```

- [ ] **Step 3: 添加通用翻译**

在 `common` 部分添加：

en.json:
```json
"retrying": "Retrying...",
"skip": "Skip"
```

zh-CN.json:
```json
"retrying": "重试中...",
"skip": "跳过"
```

- [ ] **Step 4: 保存文件**

---

### 模块三：Hooks 与后端 (Task 11-14)

#### Task 11: 创建 CLI 安装 Hook

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts` (installEnv 函数)

**Files:**
- Create: `apps/desktop/src/hooks/use-cli-installer.ts`

- [ ] **Step 1: 创建 CLI 安装 hook**

```typescript
/**
 * Hook for CLI installation with npm mirror fallback
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CliInstallerIssueKind, CliInstallerIssue } from "@/lib/onboarding/installer-issues";
import { createCliInstallerIssue, classifyInstallerError } from "@/lib/onboarding/installer-issues";
import type { VersionCheckResult } from "@/lib/onboarding/version-policy";
import { checkVersion, PINNED_VERSION } from "@/lib/onboarding/version-policy";

// ============================================================================
// Types
// ============================================================================

export type CliInstallState =
  | "idle"
  | "checking"
  | "installing"
  | "upgrading"
  | "success"
  | "error";

export interface CliInstallProgress {
  stage: "download" | "install" | "verify";
  percent: number;
  message: string;
}

export interface UseCliInstallerReturn {
  /** 当前状态 */
  state: CliInstallState;
  /** 安装进度 */
  progress: CliInstallProgress | null;
  /** 版本检查结果 */
  versionCheck: VersionCheckResult | null;
  /** 当前问题 */
  issue: CliInstallerIssue | null;
  /** 是否已安装 */
  isInstalled: boolean;
  /** 当前版本 */
  currentVersion: string | null;
  /** 检查 CLI */
  checkCli: () => Promise<void>;
  /** 安装 CLI */
  installCli: () => Promise<void>;
  /** 升级 CLI */
  upgradeCli: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// npm 镜像源
// ============================================================================

const NPM_MIRRORS = [
  { name: "npm", url: "https://registry.npmjs.org" },
  { name: "taobao", url: "https://registry.npmmirror.com" },
  { name: "tencent", url: "https://mirrors.cloud.tencent.com/npm/" },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCliInstaller(): UseCliInstallerReturn {
  const [state, setState] = React.useState<CliInstallState>("idle");
  const [progress, setProgress] = React.useState<CliInstallProgress | null>(null);
  const [versionCheck, setVersionCheck] = React.useState<VersionCheckResult | null>(null);
  const [issue, setIssue] = React.useState<CliInstallerIssue | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [currentVersion, setCurrentVersion] = React.useState<string | null>(null);

  /**
   * 检查 CLI 是否已安装及版本
   */
  const checkCli = React.useCallback(async () => {
    setState("checking");
    setIssue(null);

    try {
      // 调用 Tauri 命令检查 CLI
      const result = await invoke<{
        installed: boolean;
        version: string | null;
        path: string | null;
        source: string | null;
      }>("check_viben_cli");

      setIsInstalled(result.installed);
      setCurrentVersion(result.version);

      if (!result.installed) {
        setIssue(createCliInstallerIssue("missing-cli"));
        setState("error");
        return;
      }

      // 检查版本
      const versionResult = checkVersion(result.version);
      setVersionCheck(versionResult);

      if (versionResult.actionRequired) {
        if (versionResult.enforcement === "required_upgrade") {
          setIssue(createCliInstallerIssue("version-too-low", result.version ?? undefined));
        } else if (versionResult.enforcement === "auto_downgrade") {
          setIssue(createCliInstallerIssue("version-too-high", result.version ?? undefined));
        }
        setState("error");
        return;
      }

      setState("success");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      const issueKind = classifyInstallerError(errorStr);
      setIssue(createCliInstallerIssue(issueKind, errorStr));
      setState("error");
    }
  }, []);

  /**
   * 安装 CLI (带镜像回退)
   */
  const installCli = React.useCallback(async () => {
    setState("installing");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: "准备安装..." });

    // 尝试每个镜像源
    for (let i = 0; i < NPM_MIRRORS.length; i++) {
      const mirror = NPM_MIRRORS[i];

      try {
        setProgress({
          stage: "download",
          percent: 10 + (i * 20),
          message: `正在从 ${mirror.name} 下载...`,
        });

        // 调用 Tauri 命令安装
        await invoke("install_viben_cli", {
          version: PINNED_VERSION,
          registry: mirror.url,
        });

        setProgress({ stage: "verify", percent: 90, message: "验证安装..." });

        // 验证安装
        await checkCli();

        if (isInstalled) {
          setProgress({ stage: "verify", percent: 100, message: "安装完成" });
          setState("success");
          return;
        }
      } catch (error) {
        // 如果不是最后一个镜像，继续尝试
        if (i < NPM_MIRRORS.length - 1) {
          console.warn(`Mirror ${mirror.name} failed, trying next...`);
          continue;
        }

        // 最后一个镜像也失败了
        const errorStr = error instanceof Error ? error.message : String(error);
        const issueKind = classifyInstallerError(errorStr);
        setIssue(createCliInstallerIssue(issueKind, errorStr));
        setState("error");
      }
    }
  }, [checkCli, isInstalled]);

  /**
   * 升级 CLI
   */
  const upgradeCli = React.useCallback(async () => {
    setState("upgrading");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: "准备升级..." });

    try {
      // 使用 installCli 逻辑，但状态不同
      await invoke("install_viben_cli", {
        version: PINNED_VERSION,
        registry: NPM_MIRRORS[0].url,
      });

      setProgress({ stage: "verify", percent: 90, message: "验证升级..." });
      await checkCli();
      setProgress({ stage: "verify", percent: 100, message: "升级完成" });
      setState("success");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      const issueKind = classifyInstallerError(errorStr);
      setIssue(createCliInstallerIssue(issueKind, errorStr));
      setState("error");
    }
  }, [checkCli]);

  /**
   * 重置状态
   */
  const reset = React.useCallback(() => {
    setState("idle");
    setProgress(null);
    setIssue(null);
  }, []);

  return {
    state,
    progress,
    versionCheck,
    issue,
    isInstalled,
    currentVersion,
    checkCli,
    installCli,
    upgradeCli,
    reset,
  };
}
```

- [ ] **Step 2: 保存文件**

---

#### Task 12: 添加 Tauri CLI 安装命令

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/cli_installer.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (注册命令)

- [ ] **Step 1: 创建 Rust 命令文件**

创建 `apps/desktop/src-tauri/src/commands/cli_installer.rs`:

```rust
//! CLI installer commands for Viben CLI
//!
//! Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// CLI 检查结果
#[derive(Debug, Serialize, Deserialize)]
pub struct CliCheckResult {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub source: Option<String>,
}

/// 检查 Viben CLI 是否已安装
#[command]
pub async fn check_viben_cli() -> Result<CliCheckResult, String> {
    // 尝试运行 viben --version
    let output = Command::new("viben")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();

            // 获取路径
            let path = get_cli_path();

            Ok(CliCheckResult {
                installed: true,
                version: Some(version),
                path,
                source: Some("npm-global".to_string()),
            })
        }
        _ => {
            Ok(CliCheckResult {
                installed: false,
                version: None,
                path: None,
                source: None,
            })
        }
    }
}

/// 安装 Viben CLI
#[command]
pub async fn install_viben_cli(version: String, registry: String) -> Result<(), String> {
    // 构建 npm install 命令
    let install_cmd = if cfg!(target_os = "windows") {
        "npm.cmd"
    } else {
        "npm"
    };

    let output = Command::new(install_cmd)
        .args([
            "install",
            "-g",
            &format!("viben@{}", version),
            "--registry",
            &registry,
        ])
        .output()
        .map_err(|e| format!("Failed to run npm: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("npm install failed: {}", stderr))
    }
}

/// 获取 CLI 路径
fn get_cli_path() -> Option<String> {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    Command::new(which_cmd)
        .arg("viben")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// 检查 Node.js 是否已安装
#[command]
pub async fn check_node() -> Result<bool, String> {
    let node_cmd = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };

    Command::new(node_cmd)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .map_err(|e| e.to_string())
}

/// 触发 macOS Xcode CLT 安装
#[command]
pub async fn trigger_xcode_clt_install() -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(()); // 非 macOS 直接返回
    }

    // 运行 xcode-select --install
    Command::new("xcode-select")
        .arg("--install")
        .spawn()
        .map_err(|e| format!("Failed to trigger xcode-select: {}", e))?;

    Ok(())
}

/// 检查 Xcode CLT 是否已安装
#[command]
pub async fn check_xcode_clt() -> Result<bool, String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(true); // 非 macOS 返回 true
    }

    Command::new("xcode-select")
        .arg("-p")
        .output()
        .map(|o| o.status.success())
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 在 lib.rs 中注册命令**

在 `apps/desktop/src-tauri/src/lib.rs` 的 `tauri::Builder` 中添加：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令
    commands::cli_installer::check_viben_cli,
    commands::cli_installer::install_viben_cli,
    commands::cli_installer::check_node,
    commands::cli_installer::trigger_xcode_clt_install,
    commands::cli_installer::check_xcode_clt,
])
```

- [ ] **Step 3: 在 commands/mod.rs 中导出模块**

```rust
pub mod cli_installer;
```

- [ ] **Step 4: 保存文件**

---

#### Task 13: 重构 useGatewayStatus 使用指数退避

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/polling.ts`

**Files:**
- Modify: `apps/desktop/src/hooks/use-gateway-status.ts`

- [ ] **Step 1: 导入轮询工具**

在文件顶部添加导入：

```typescript
import { pollWithBackoff, createPollController } from "@/lib/onboarding/polling";
import { GATEWAY_READINESS_POLICY } from "@/lib/onboarding/runtime-policies";
```

- [ ] **Step 2: 重构 checkConnection 方法**

将现有的固定间隔轮询替换为指数退避：

```typescript
/**
 * 使用指数退避检查 Gateway 连接
 */
const checkConnectionWithBackoff = React.useCallback(async (): Promise<boolean> => {
  const controller = createPollController();

  const result = await pollWithBackoff({
    policy: GATEWAY_READINESS_POLICY,
    poll: async () => {
      try {
        const response = await fetch(`${gatewayUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          return { done: true, value: true };
        }
        return { done: false };
      } catch {
        return { done: false };
      }
    },
    shouldAbort: controller.shouldAbort,
    onAttempt: (attempt, nextInterval) => {
      console.log(`Gateway connection attempt ${attempt}, next in ${nextInterval}ms`);
    },
  });

  return result.success;
}, [gatewayUrl]);
```

- [ ] **Step 3: 更新连接检查逻辑**

替换现有的 `checkConnection` 实现使用新的退避逻辑。

- [ ] **Step 4: 保存文件**

---

#### Task 14: 增强 useGateway 添加版本检查

**Files:**
- Modify: `apps/desktop/src/hooks/use-gateway.ts`

- [ ] **Step 1: 导入版本检查工具**

```typescript
import { checkVersion, type VersionCheckResult } from "@/lib/onboarding/version-policy";
import { classifyGatewayError, type GatewayRuntimeStateCode } from "@/lib/onboarding/gateway-diagnostics";
```

- [ ] **Step 2: 添加版本检查状态**

在 hook 中添加：

```typescript
const [versionCheck, setVersionCheck] = React.useState<VersionCheckResult | null>(null);
const [runtimeState, setRuntimeState] = React.useState<GatewayRuntimeStateCode>("not_running");
```

- [ ] **Step 3: 在 refreshStatus 中添加版本检查**

```typescript
const refreshStatus = React.useCallback(async () => {
  setIsLoading(true);
  try {
    const status = await invoke<GatewayStatus>("get_gateway_status", {
      vibenPath,
    });
    setStatus(status);

    // 检查版本
    if (status?.version) {
      const vResult = checkVersion(status.version);
      setVersionCheck(vResult);
    }

    // 分类运行时状态
    if (status?.running) {
      setRuntimeState("healthy");
    } else if (status?.error) {
      setRuntimeState(classifyGatewayError(status.error));
    } else {
      setRuntimeState("not_running");
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    setRuntimeState("unknown_error");
  } finally {
    setIsLoading(false);
  }
}, [vibenPath]);
```

- [ ] **Step 4: 导出新状态**

在返回对象中添加：

```typescript
return {
  // ... 现有返回值
  versionCheck,
  runtimeState,
};
```

- [ ] **Step 5: 保存文件**

---

### 模块四：重构 StepGateway 组件 (Task 15-17)

#### Task 15: 重构 StepGateway 使用新的基础设施

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx`

**Files:**
- Modify: `apps/desktop/src/components/onboarding/step-gateway.tsx`

- [ ] **Step 1: 更新导入**

```tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertCircle, Loader2, Server, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGateway } from "@/hooks/use-gateway";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import { useCliInstaller } from "@/hooks/use-cli-installer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FailureView } from "./failure-view";
import { LoadingScreen } from "./loading-screen";
import { StartupIssueDialog } from "./startup-issue-dialog";
import { pollWithBackoff, createPollController } from "@/lib/onboarding/polling";
import { GATEWAY_READINESS_POLICY, UI_RUNTIME_DEFAULTS, ONBOARDING_TASK_WEIGHTS } from "@/lib/onboarding/runtime-policies";
import { createGatewayFailureView, createInstallerFailureView } from "@/lib/onboarding/bootstrap-diagnostics";
import type { GatewayRuntimeStateCode } from "@/lib/onboarding/gateway-diagnostics";
```

- [ ] **Step 2: 定义加权进度计算**

```tsx
// ============================================================================
// 加权进度计算
// Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/dashboard-entry-bootstrap.ts
// ============================================================================

type TaskKey = "cli" | "gateway" | "connection";
type TaskStatus = "pending" | "active" | "done" | "error";

interface TaskState {
  cli: TaskStatus;
  gateway: TaskStatus;
  connection: TaskStatus;
}

const TASK_WEIGHTS: Record<TaskKey, number> = {
  cli: 0.3,       // 30%
  gateway: 0.4,   // 40%
  connection: 0.3, // 30%
};

function resolveProgressUnit(status: TaskStatus): number {
  if (status === "done") return 1;
  if (status === "active") return 0.45;
  if (status === "error") return 0.2;
  return 0; // pending
}

function calculateProgress(tasks: TaskState): number {
  const baseline = UI_RUNTIME_DEFAULTS.gatewayBootstrap.baselineProgress; // 8%
  let progress = baseline;

  for (const [key, status] of Object.entries(tasks) as [TaskKey, TaskStatus][]) {
    const weight = TASK_WEIGHTS[key];
    const unit = resolveProgressUnit(status);
    progress += (100 - baseline) * weight * unit;
  }

  return Math.min(100, Math.round(progress));
}
```

- [ ] **Step 3: 重构组件状态和流程**

```tsx
interface StepGatewayProps {
  onComplete: () => void;
}

type BootstrapPhase = "cli-check" | "cli-install" | "gateway-start" | "connection-check" | "done" | "error";

export function StepGateway({ onComplete }: StepGatewayProps) {
  const { t } = useTranslation();

  // Hooks
  const {
    status: gatewayProcess,
    isLoading: gatewayLoading,
    isActioning,
    error: gatewayError,
    vibenPath,
    startGateway,
    runtimeState,
    versionCheck,
  } = useGateway();

  const { isConnected, checkConnection } = useGatewayStatus();

  const {
    state: cliState,
    issue: cliIssue,
    isInstalled: cliInstalled,
    currentVersion,
    checkCli,
    installCli,
    progress: cliProgress,
  } = useCliInstaller();

  // Local state
  const [phase, setPhase] = React.useState<BootstrapPhase>("cli-check");
  const [tasks, setTasks] = React.useState<TaskState>({
    cli: "pending",
    gateway: "pending",
    connection: "pending",
  });
  const [failure, setFailure] = React.useState<ReturnType<typeof createGatewayFailureView> | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [showIssueDialog, setShowIssueDialog] = React.useState(false);
  const [issueDialogKind, setIssueDialogKind] = React.useState<string | null>(null);

  const maxRetries = 3;
  const progress = calculateProgress(tasks);

  // ============================================================================
  // Bootstrap 流程
  // ============================================================================

  const runBootstrap = React.useCallback(async () => {
    setFailure(null);

    // Phase 1: CLI 检查
    setPhase("cli-check");
    setTasks((t) => ({ ...t, cli: "active" }));

    await checkCli();

    if (!cliInstalled) {
      // 需要安装 CLI
      setPhase("cli-install");
      setTasks((t) => ({ ...t, cli: "active" }));

      // 检查是否需要特殊处理 (如 Xcode CLT)
      if (cliIssue?.kind === "xcode-clt-pending") {
        setIssueDialogKind("xcode-clt-pending");
        setShowIssueDialog(true);
        setTasks((t) => ({ ...t, cli: "error" }));
        setPhase("error");
        return;
      }

      await installCli();

      if (cliState === "error" && cliIssue) {
        setTasks((t) => ({ ...t, cli: "error" }));
        setFailure(createInstallerFailureView(cliIssue.kind, { error: cliIssue.details }));
        setPhase("error");
        return;
      }
    }

    setTasks((t) => ({ ...t, cli: "done" }));

    // Phase 2: 启动 Gateway
    setPhase("gateway-start");
    setTasks((t) => ({ ...t, gateway: "active" }));

    try {
      await startGateway();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTasks((t) => ({ ...t, gateway: "error" }));
      setFailure(createGatewayFailureView(runtimeState, { error: errorMsg }));
      setPhase("error");
      return;
    }

    setTasks((t) => ({ ...t, gateway: "done" }));

    // Phase 3: 检查连接
    setPhase("connection-check");
    setTasks((t) => ({ ...t, connection: "active" }));

    const controller = createPollController();
    const result = await pollWithBackoff({
      policy: GATEWAY_READINESS_POLICY,
      poll: async () => {
        const connected = await checkConnection();
        return connected ? { done: true, value: true } : { done: false };
      },
      shouldAbort: controller.shouldAbort,
    });

    if (result.success) {
      setTasks((t) => ({ ...t, connection: "done" }));
      setPhase("done");
    } else {
      setTasks((t) => ({ ...t, connection: "error" }));
      setFailure(createGatewayFailureView("connection_timeout"));
      setPhase("error");
    }
  }, [
    checkCli,
    cliInstalled,
    cliIssue,
    cliState,
    installCli,
    startGateway,
    runtimeState,
    checkConnection,
  ]);

  // 自动启动
  React.useEffect(() => {
    runBootstrap();
  }, []);

  // ============================================================================
  // 事件处理
  // ============================================================================

  const handleRetry = async () => {
    if (retryCount >= maxRetries) return;
    setRetryCount((c) => c + 1);
    setTasks({ cli: "pending", gateway: "pending", connection: "pending" });
    await runBootstrap();
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleContinue = () => {
    onComplete();
  };

  const canContinue = phase === "done";
  const canRetry = phase === "error" && retryCount < maxRetries;
  const isBootstrapping = phase !== "done" && phase !== "error";

  // ============================================================================
  // 渲染
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.gateway.title")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.gateway.description")}
        </p>
      </div>

      {/* 加载中状态 */}
      {isBootstrapping && (
        <LoadingScreen
          progress={progress}
          status={getPhaseStatus(phase, t)}
          showTips={true}
        />
      )}

      {/* 成功状态 */}
      {phase === "done" && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <div className="font-medium text-green-700 dark:text-green-400">
                {t("onboarding.gateway.connected")}
              </div>
              {gatewayProcess?.port && (
                <div className="text-sm text-muted-foreground">
                  {t("onboarding.gateway.port")}: {gatewayProcess.port}
                </div>
              )}
              {currentVersion && (
                <div className="text-sm text-muted-foreground">
                  Version: {currentVersion}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {phase === "error" && failure && (
        <FailureView
          failure={failure}
          onRetry={canRetry ? handleRetry : undefined}
          onSkip={handleSkip}
          isRetrying={isBootstrapping}
        />
      )}

      {/* 版本警告 */}
      {versionCheck?.enforcement === "optional_upgrade" && (
        <div className="flex items-center gap-2 rounded bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="h-4 w-4" />
          <span>{versionCheck.message}</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <div>
          {phase === "error" && (
            <Button variant="ghost" onClick={handleSkip}>
              {t("onboarding.gateway.skip")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {canRetry && (
            <Button variant="outline" onClick={handleRetry} disabled={isBootstrapping}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isBootstrapping && "animate-spin")} />
              {t("onboarding.gateway.retry")} ({maxRetries - retryCount} left)
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!canContinue}>
            {t("common.next")}
          </Button>
        </div>
      </div>

      {/* 系统问题对话框 */}
      <StartupIssueDialog
        open={showIssueDialog}
        onOpenChange={setShowIssueDialog}
        issueKind={issueDialogKind as any}
        onRetry={() => {
          setShowIssueDialog(false);
          handleRetry();
        }}
        isRetrying={isBootstrapping}
      />
    </div>
  );
}

// ============================================================================
// 辅助函数
// ============================================================================

function getPhaseStatus(phase: BootstrapPhase, t: (key: string) => string): string {
  switch (phase) {
    case "cli-check":
      return t("onboarding.gateway.checking");
    case "cli-install":
      return "正在安装 Viben CLI...";
    case "gateway-start":
      return t("onboarding.gateway.starting");
    case "connection-check":
      return "正在验证连接...";
    default:
      return "";
  }
}
```

- [ ] **Step 4: 保存文件**

---

#### Task 16: 导出新组件

**Files:**
- Modify: `apps/desktop/src/components/onboarding/index.ts`

- [ ] **Step 1: 添加新组件导出**

```typescript
export { OnboardingProgress, type OnboardingStep } from "./onboarding-progress";
export { OnboardingWizard } from "./onboarding-wizard";
export { StepPython } from "./step-python";
export { StepClaude } from "./step-claude";
export { StepLogin } from "./step-login";
export { StepGateway } from "./step-gateway";
export { FailureView } from "./failure-view";
export { LoadingScreen } from "./loading-screen";
export { StartupIssueDialog } from "./startup-issue-dialog";
```

- [ ] **Step 2: 保存文件**

---

#### Task 17: 创建 lib/onboarding/index.ts 导出

**Files:**
- Create: `apps/desktop/src/lib/onboarding/index.ts`

- [ ] **Step 1: 创建统一导出文件**

```typescript
/**
 * Onboarding library exports
 */

// Runtime policies
export * from "./runtime-policies";

// Polling utilities
export * from "./polling";

// Error types
export * from "./installer-issues";

// Gateway diagnostics
export * from "./gateway-diagnostics";

// Bootstrap diagnostics (failure views)
export * from "./bootstrap-diagnostics";

// Version policy
export * from "./version-policy";
```

- [ ] **Step 2: 保存文件**

---

### 模块五：验证与测试 (Task 18-19)

#### Task 18: TypeScript 类型检查

**Files:**
- None (verification only)

- [ ] **Step 1: 运行类型检查**

```bash
cd apps/desktop && pnpm tsc --noEmit
```

Expected: PASS with no errors

- [ ] **Step 2: 修复任何类型错误**

---

#### Task 19: 构建验证

**Files:**
- None (verification only)

- [ ] **Step 1: 运行构建**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 2: 手动测试**

测试用例：
1. 首次启动 - CLI 未安装场景
2. CLI 已安装但 Gateway 未运行场景
3. 所有组件正常场景
4. 网络错误场景
5. 重试功能
6. 跳过功能
7. macOS Xcode CLT 提示（如适用）

- [ ] **Step 3: 提交更改**

```bash
git add apps/desktop/src/lib/onboarding/
git add apps/desktop/src/components/onboarding/
git add apps/desktop/src/hooks/use-cli-installer.ts
git add apps/desktop/src-tauri/src/commands/cli_installer.rs
git add apps/desktop/src/i18n/locales/
git commit -m "feat(desktop): complete onboarding redesign with CLI installer

- Add runtime policies with exponential backoff polling
- Add 14 error types with structured failure views
- Add 18 gateway runtime state classification
- Add version policy with min/max/pinned version checks
- Add CLI installer hook with npm mirror fallback
- Add Tauri commands for CLI install/check
- Add LoadingScreen with bouncing animation and rotating tips
- Add StartupIssueDialog for system-level problems (Xcode CLT)
- Add FailureView for structured error display
- Refactor StepGateway with weighted task progress
- Support auto-retry with exponential backoff

Qclaw reference implementation patterns adopted."
```

---

## 总结

### 任务清单

| 模块 | Task | 描述 | 文件 |
|------|------|------|------|
| **基础设施** | 1 | 运行时策略常量 | `lib/onboarding/runtime-policies.ts` |
| | 2 | 指数退避轮询工具 | `lib/onboarding/polling.ts` |
| | 3 | 错误类型定义 (14种) | `lib/onboarding/installer-issues.ts` |
| | 4 | Gateway 运行时状态 (18种) | `lib/onboarding/gateway-diagnostics.ts` |
| | 5 | 结构化故障视图 | `lib/onboarding/bootstrap-diagnostics.ts` |
| | 6 | 版本管控策略 | `lib/onboarding/version-policy.ts` |
| **UI 组件** | 7 | 故障视图组件 | `components/onboarding/failure-view.tsx` |
| | 8 | 加载屏幕组件 | `components/onboarding/loading-screen.tsx` |
| | 9 | 系统问题对话框 | `components/onboarding/startup-issue-dialog.tsx` |
| | 10 | i18n 翻译 | `i18n/locales/*.json` |
| **Hooks/后端** | 11 | CLI 安装 Hook | `hooks/use-cli-installer.ts` |
| | 12 | Tauri CLI 命令 | `src-tauri/src/commands/cli_installer.rs` |
| | 13 | 重构 useGatewayStatus | `hooks/use-gateway-status.ts` |
| | 14 | 增强 useGateway | `hooks/use-gateway.ts` |
| **重构** | 15 | 重构 StepGateway | `components/onboarding/step-gateway.tsx` |
| | 16 | 导出新组件 | `components/onboarding/index.ts` |
| | 17 | 统一导出 | `lib/onboarding/index.ts` |
| **验证** | 18 | TypeScript 检查 | - |
| | 19 | 构建与测试 | - |

### 关键 Qclaw 参考文件

| 功能 | Qclaw 文件 |
|------|-----------|
| 运行时策略 | `src/shared/runtime-policies.ts` |
| 轮询工具 | `src/shared/polling.ts` |
| 错误类型 | `src/shared/node-installer-issues.ts` |
| Gateway 状态 | `src/shared/gateway-runtime-state.ts` |
| Gateway 诊断 | `src/shared/gateway-runtime-diagnostics.ts` |
| 故障视图 | `src/shared/gateway-bootstrap-diagnostics.ts` |
| 加权进度 | `src/shared/dashboard-entry-bootstrap.ts` |
| 版本策略 | `src/shared/openclaw-version-policy.ts` |
| CLI 安装 | `electron/main/cli.ts` |
| 环境检查 UI | `src/pages/EnvCheck.tsx` |
| Gateway 启动 UI | `src/pages/GatewayBootstrapGate.tsx` |

