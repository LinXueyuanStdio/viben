# Desktop Onboarding 完整优化计划 (基于 Qclaw)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Qclaw 的完整实现，优化 Viben desktop onboarding 流程

**Architecture:** 采用 Qclaw 的多阶段引导模式：Welcome → EnvCheck → Setup → GatewayBootstrap → Dashboard。新增 Welcome 页面进行首次启动免责声明，分离 EnvCheck 页面独立处理 Node.js 和 CLI 环境检查，支持取消操作和历史环境恢复。

**Tech Stack:** React, TypeScript, Tauri, i18n, shadcn/ui

---

## Qclaw 参考文件

| 功能 | Qclaw 文件路径 |
|------|---------------|
| 应用状态机 | `/Users/lxy/Documents/GitHub/others/Qclaw/src/App.tsx` |
| Welcome 页面 | `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/Welcome.tsx` |
| EnvCheck 页面 | `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` |
| 环境检查策略 | `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/env-check-policy.ts` |
| Node 安装问题 | `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts` |

---

## 功能清单

| # | 功能 | Viben 现状 | 目标 |
|---|------|-----------|------|
| 1 | Welcome 页面 | ❌ 缺失 | 首次启动免责声明、权限说明、风险警告 |
| 2 | Node.js 检查 | ❌ 缺失 | 版本检查、自动安装、NVM 支持 |
| 3 | EnvCheck 分离 | ❌ 合并在 step-gateway | 独立环境检查页面 |
| 4 | 取消操作支持 | ❌ 缺失 | 每个步骤可取消 |
| 5 | 历史环境恢复 | ❌ 缺失 | 检测历史安装并恢复 |
| 6 | CLI 发现机制 | ⚠️ 简化 | 扫描多个位置查找 CLI |
| 7 | Fatal/Soft 错误分层 | ⚠️ 简化 | 区分阻断/非阻断错误 |

---

## 文件结构

### 新增文件

```
apps/desktop/src/
├── components/onboarding/
│   ├── welcome-page.tsx           # Welcome 页面组件
│   ├── env-check-page.tsx         # EnvCheck 页面组件
│   └── env-check-step-item.tsx    # 检查步骤项组件
├── lib/onboarding/
│   ├── node-installer-issues.ts   # Node.js 安装问题分类
│   ├── env-check-policy.ts        # 环境检查策略配置
│   ├── cli-discovery.ts           # CLI 发现机制
│   └── cancellation.ts            # 取消操作支持
├── hooks/
│   └── use-node-installer.ts      # Node.js 安装 hook
└── i18n/locales/
    ├── en.json                    # 新增 welcome/envCheck 翻译
    └── zh-CN.json                 # 新增 welcome/envCheck 翻译
```

### 修改文件

```
apps/desktop/src/
├── components/onboarding/
│   ├── onboarding-wizard.tsx      # 添加 Welcome 和 EnvCheck 步骤
│   ├── onboarding-progress.tsx    # 添加新步骤指示
│   └── step-gateway.tsx           # 简化，移除环境检查逻辑
├── hooks/
│   └── use-cli-installer.ts       # 增加取消和历史恢复支持
└── src-tauri/src/commands/
    └── cli_installer.rs           # 添加 Node.js 检查命令
```

---

## 模块一：Node.js 安装问题分类 (Task 1-2)

### Task 1: 创建 Node.js 安装问题类型定义

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/node-installer-issues.ts`

- [ ] **Step 1: 创建 Node.js 安装问题类型**

```typescript
/**
 * Node.js installer issue types and classification
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Node.js 安装问题类型
 * 参考 Qclaw: 13 种问题类型
 */
export type NodeInstallerIssueKind =
  | "missing-installer"           // 安装包不存在
  | "corrupted-installer"         // 安装包损坏
  | "missing-system-command"      // 缺少系统命令
  | "xcode-clt-pending"           // 等待 Xcode CLT 安装
  | "git-unavailable"             // Git 不可用
  | "developer-tools-prepare-failed" // 开发者工具准备失败
  | "not-admin-user"              // 非管理员用户
  | "blocked-by-policy"           // 被安全策略阻止
  | "unsupported-macos"           // macOS 版本不支持
  | "user-cancelled"              // 用户取消
  | "permission-denied"           // 权限不足
  | "installer-failed"            // 安装器执行失败
  | "download-failed";            // 下载失败

/**
 * Node.js 安装问题
 */
export interface NodeInstallerIssue {
  kind: NodeInstallerIssueKind;
  title: string;
  message: string;
  details?: string;
}

/**
 * Node.js 安装就绪结果
 */
export interface NodeInstallerReadinessResult {
  ok: boolean;
  issue?: NodeInstallerIssue;
}

// ============================================================================
// Issue Factory
// ============================================================================

function normalizeDetails(details: string): string | undefined {
  const normalized = String(details || "").trim();
  return normalized || undefined;
}

/**
 * 创建 Node.js 安装问题
 */
export function createNodeInstallerIssue(
  kind: NodeInstallerIssueKind,
  details = ""
): NodeInstallerIssue {
  const normalizedDetails = normalizeDetails(details);

  const issueMap: Record<NodeInstallerIssueKind, { title: string; message: string }> = {
    "missing-installer": {
      title: "Node 安装包不存在",
      message: "已下载的 Node.js 安装包没有找到，安装无法继续。请点击「继续安装」再次尝试。",
    },
    "corrupted-installer": {
      title: "Node 安装包无效或已损坏",
      message: "下载到的 Node.js 安装包未通过签名/完整性检查，可能已损坏或被代理替换。请检查网络环境后重试。",
    },
    "missing-system-command": {
      title: "系统缺少安装预检命令",
      message: "当前系统缺少 Node.js 自动安装所需的系统命令，无法继续自动预检。请联系管理员修复系统工具，或改为手动安装 Node.js。",
    },
    "xcode-clt-pending": {
      title: "等待 Xcode Command Line Tools 安装完成",
      message: "已尝试触发 Xcode 命令行工具系统安装弹窗。如果没有弹窗，请点击屏幕右下角的安装图标继续安装；安装完成后，点击「重试检测」刷新状态。",
    },
    "git-unavailable": {
      title: "Git 命令不可用",
      message: "当前系统无法使用 Git，无法继续环境准备。请先修复 Git 或安装 Xcode Command Line Tools 后重试。",
    },
    "developer-tools-prepare-failed": {
      title: "macOS 开发者工具预检失败",
      message: "在准备 Git / Xcode Command Line Tools 时遇到问题。请稍后重试；如果仍失败，请手动检查系统开发者工具状态。",
    },
    "not-admin-user": {
      title: "当前账户没有管理员权限",
      message: "自动安装 Node.js 需要 macOS 管理员权限。请使用管理员账户登录，或联系设备管理员处理。",
    },
    "blocked-by-policy": {
      title: "系统策略阻止了安装",
      message: "这台电脑的安全策略阻止了 Node.js 安装。请联系管理员处理，或改为手动安装 Node.js。",
    },
    "unsupported-macos": {
      title: "当前 macOS 版本不支持该 Node 安装包",
      message: "当前系统版本与目标 Node.js 安装包不兼容，无法继续自动安装。请先升级系统，或手动安装兼容的 Node.js 版本。",
    },
    "user-cancelled": {
      title: "已取消 Node 安装",
      message: "你已取消管理员授权或安装流程，因此 Node.js 未安装。",
    },
    "permission-denied": {
      title: "没有足够权限安装 Node.js",
      message: "安装 Node.js 时权限不足。请确认当前账号具备管理员权限，并允许系统弹出的安装授权。",
    },
    "installer-failed": {
      title: "Node 安装器执行失败",
      message: "Node.js 安装器执行时报错。请稍后重试；如果仍然失败，建议去 Node.js 官网手动安装。",
    },
    "download-failed": {
      title: "Node 安装包下载失败",
      message: "自动下载 Node.js 安装包失败。请检查网络、代理或证书设置；如果仍然失败，可前往 Node.js 官网手动下载。",
    },
  };

  const { title, message } = issueMap[kind] || issueMap["installer-failed"];

  return {
    kind,
    title,
    message,
    details: normalizedDetails,
  };
}

// ============================================================================
// Issue Classification
// ============================================================================

/**
 * 分类 macOS Git 工具问题
 */
export function classifyMacGitToolsIssue(result: {
  errorCode?: "xcode_clt_pending" | "git_unavailable" | "prepare_failed";
  stderr?: string;
  stdout?: string;
}): NodeInstallerIssue {
  const details = [String(result.stderr || "").trim(), String(result.stdout || "").trim()]
    .filter(Boolean)
    .join("\n");

  if (result.errorCode === "xcode_clt_pending") {
    return createNodeInstallerIssue("xcode-clt-pending", details);
  }

  if (result.errorCode === "git_unavailable") {
    return createNodeInstallerIssue("git-unavailable", details);
  }

  return createNodeInstallerIssue("developer-tools-prepare-failed", details);
}

/**
 * 分类 macOS Node.js 安装失败
 */
export function classifyMacNodeInstallerFailure(rawError: string): NodeInstallerIssue {
  const raw = String(rawError || "").trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return createNodeInstallerIssue("installer-failed");
  }

  // 用户取消
  if (
    normalized.includes("user canceled") ||
    normalized.includes("user cancelled") ||
    normalized.includes("(-128)")
  ) {
    return createNodeInstallerIssue("user-cancelled", raw);
  }

  // macOS 版本不支持
  if (
    normalized.includes("requires macos") ||
    normalized.includes("requires os x") ||
    normalized.includes("incompatible with this version of macos") ||
    normalized.includes("can't be installed on this disk") ||
    normalized.includes("this package is incompatible")
  ) {
    return createNodeInstallerIssue("unsupported-macos", raw);
  }

  // 权限不足
  if (
    normalized.includes("administrator privileges") ||
    normalized.includes("not authorized") ||
    normalized.includes("authorization") ||
    normalized.includes("permission denied")
  ) {
    return createNodeInstallerIssue("permission-denied", raw);
  }

  // 被安全策略阻止
  if (
    normalized.includes("assessment denied") ||
    normalized.includes("rejected") ||
    normalized.includes("untrusted") ||
    normalized.includes("notar") ||
    normalized.includes("cannot be opened because") ||
    normalized.includes("source=no usable signature")
  ) {
    return createNodeInstallerIssue("blocked-by-policy", raw);
  }

  // 安装包不存在
  if (
    normalized.includes("no such file or directory") ||
    normalized.includes("does not exist")
  ) {
    return createNodeInstallerIssue("missing-installer", raw);
  }

  return createNodeInstallerIssue("installer-failed", raw);
}

/**
 * 分类 Node.js 下载失败
 */
export function classifyNodeInstallerDownloadFailure(rawError: string): NodeInstallerIssue {
  return createNodeInstallerIssue("download-failed", rawError);
}
```

- [ ] **Step 2: 保存文件**

---

### Task 2: 创建环境检查策略配置

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/env-check-policy.ts`

**Files:**
- Create: `apps/desktop/src/lib/onboarding/env-check-policy.ts`

- [ ] **Step 1: 创建环境检查策略**

```typescript
/**
 * Environment check policy configuration
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/env-check-policy.ts
 */

import type { NodeInstallerIssueKind } from "./node-installer-issues";

// ============================================================================
// Types
// ============================================================================

export interface EnvCheckSupportAction {
  kind: "external-link";
  label: string;
  href: string;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_DOWNLOAD_ACTION: EnvCheckSupportAction = Object.freeze({
  kind: "external-link",
  label: "打开 Node 官网",
  href: "https://nodejs.org/",
});

const VIBEN_ISSUES_ACTION: EnvCheckSupportAction = Object.freeze({
  kind: "external-link",
  label: "报告问题",
  href: "https://github.com/LinXueyuanStdio/viben/issues",
});

/**
 * 需要显示手动下载 Node.js 链接的问题类型
 */
const NODE_MANUAL_DOWNLOAD_ISSUE_KINDS = new Set<NodeInstallerIssueKind>([
  "blocked-by-policy",
  "corrupted-installer",
  "download-failed",
  "installer-failed",
  "missing-system-command",
  "unsupported-macos",
]);

/**
 * 环境检查 UI 策略
 */
export const ENV_CHECK_UI_POLICY = Object.freeze({
  /** 加载提示文案 */
  loadingTips: Object.freeze([
    "正在检查系统环境...",
    "Viben 支持 Claude Code、Cursor、Codex 等多种 AI 客户端",
    "所有配置和数据仅保存在您的电脑上",
    "安装和配置速度会受到网络和电脑性能影响",
    "安装、配置过程可能会输入电脑密码",
    "请确保网络连接正常",
  ]),
  /** Node.js 下载链接 */
  nodeDownloadAction: NODE_DOWNLOAD_ACTION,
  /** 报告问题链接 */
  issuesAction: VIBEN_ISSUES_ACTION,
});

/**
 * 环境检查步骤提示
 */
export const ENV_CHECK_STEP_TOOLTIPS: Record<string, string> = {
  node: "Node.js 是运行 Viben CLI 所需的 JavaScript 运行时环境",
  viben: "Viben CLI 是核心命令行工具，提供 Gateway 服务和 AI 交互功能",
  gateway: "Gateway 是 Viben 的本地后端服务，负责与 AI 客户端通信",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 根据问题类型获取支持操作
 */
export function getEnvCheckSupportActionsForIssueKind(
  issueKind?: NodeInstallerIssueKind | string | null
): EnvCheckSupportAction[] {
  if (!issueKind || !NODE_MANUAL_DOWNLOAD_ISSUE_KINDS.has(issueKind as NodeInstallerIssueKind)) {
    return [];
  }

  return [ENV_CHECK_UI_POLICY.nodeDownloadAction];
}

/**
 * 判断是否应该内联显示启动问题
 * Xcode CLT 等待安装时应内联显示而非弹窗
 */
export function shouldRenderStartupIssueInline(
  issue: { kind: NodeInstallerIssueKind } | null | undefined
): boolean {
  return issue?.kind === "xcode-clt-pending";
}
```

- [ ] **Step 2: 保存文件**

---

## 模块二：CLI 发现与取消机制 (Task 3-4)

### Task 3: 创建 CLI 发现机制

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` (CLI 发现逻辑)

**Files:**
- Create: `apps/desktop/src/lib/onboarding/cli-discovery.ts`

- [ ] **Step 1: 创建 CLI 发现机制**

```typescript
/**
 * CLI Discovery mechanism
 *
 * Scans multiple locations to find Viben CLI installation
 * Supports ownership detection and baseline backup
 */

// ============================================================================
// Types
// ============================================================================

/**
 * CLI 所有权状态
 */
export type CliOwnershipState =
  | "viben-installed"        // Viben 自己安装的
  | "external-preexisting"   // 外部预装的
  | "unknown-external";      // 未知来源

/**
 * CLI 发现结果
 */
export interface CliDiscoveryResult {
  found: boolean;
  path?: string;
  version?: string;
  ownership: CliOwnershipState;
  installMethod?: "npm" | "npx" | "bundled" | "manual";
}

/**
 * CLI 搜索位置
 */
export interface CliSearchLocation {
  path: string;
  priority: number;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * CLI 搜索位置优先级列表 (macOS)
 */
export const CLI_SEARCH_LOCATIONS: CliSearchLocation[] = [
  // Bundled sidecar (highest priority)
  { path: "$RESOURCE_DIR/viben", priority: 1, description: "Bundled sidecar" },
  // User-selected path
  { path: "$USER_SELECTED", priority: 2, description: "User selected path" },
  // Global npm install
  { path: "/usr/local/bin/viben", priority: 3, description: "Global npm (Intel Mac)" },
  { path: "/opt/homebrew/bin/viben", priority: 4, description: "Global npm (Apple Silicon)" },
  // NVM installations
  { path: "$HOME/.nvm/versions/node/*/bin/viben", priority: 5, description: "NVM installation" },
  // Homebrew Node
  { path: "/usr/local/lib/node_modules/viben/bin/viben", priority: 6, description: "Homebrew Node modules" },
  // User local
  { path: "$HOME/.local/bin/viben", priority: 7, description: "User local bin" },
];

/**
 * 最低支持的 CLI 版本
 */
export const MIN_CLI_VERSION = "0.1.0";

// ============================================================================
// Discovery Functions
// ============================================================================

/**
 * 解析路径中的环境变量
 */
export function resolvePathVariables(
  path: string,
  context: {
    resourceDir?: string;
    userSelected?: string;
    homeDir?: string;
  }
): string {
  let resolved = path;

  if (context.resourceDir) {
    resolved = resolved.replace("$RESOURCE_DIR", context.resourceDir);
  }
  if (context.userSelected) {
    resolved = resolved.replace("$USER_SELECTED", context.userSelected);
  }
  if (context.homeDir) {
    resolved = resolved.replace("$HOME", context.homeDir);
  }

  return resolved;
}

/**
 * 解析版本字符串中的语义版本
 */
export function parseCliVersion(versionOutput: string): string | null {
  // Match patterns like "viben 0.1.0", "v0.1.0", "0.1.0"
  const match = versionOutput.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
  return match ? match[1] : null;
}

/**
 * 比较语义版本
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((x) => parseInt(x, 10) || 0);
  const partsB = b.split(".").map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }

  return 0;
}

/**
 * 检查版本是否满足最低要求
 */
export function isVersionSatisfied(version: string, minVersion: string = MIN_CLI_VERSION): boolean {
  return compareVersions(version, minVersion) >= 0;
}

/**
 * 推断 CLI 所有权状态
 */
export function inferCliOwnership(
  path: string,
  context: {
    vibenInstallMarkerExists?: boolean;
    resourceDir?: string;
  }
): CliOwnershipState {
  // Bundled sidecar is always viben-installed
  if (context.resourceDir && path.startsWith(context.resourceDir)) {
    return "viben-installed";
  }

  // Check for Viben install marker
  if (context.vibenInstallMarkerExists) {
    return "viben-installed";
  }

  // Global npm path suggests external installation
  if (
    path.includes("/usr/local/bin") ||
    path.includes("/opt/homebrew/bin") ||
    path.includes("node_modules")
  ) {
    return "external-preexisting";
  }

  return "unknown-external";
}

// ============================================================================
// Baseline Backup
// ============================================================================

/**
 * 基线备份信息
 */
export interface BaselineBackup {
  originalPath: string;
  originalVersion: string;
  backupPath?: string;
  backupTime: number;
}

/**
 * 创建基线备份描述
 */
export function createBaselineBackupDescription(backup: BaselineBackup): string {
  const date = new Date(backup.backupTime);
  return `CLI v${backup.originalVersion} at ${backup.originalPath} (backed up ${date.toLocaleString()})`;
}
```

- [ ] **Step 2: 保存文件**

---

### Task 4: 创建取消操作支持

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` (取消逻辑)

**Files:**
- Create: `apps/desktop/src/lib/onboarding/cancellation.ts`

- [ ] **Step 1: 创建取消操作支持**

```typescript
/**
 * Cancellation support for onboarding operations
 *
 * Provides cancellable controller pattern for long-running operations
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 取消域 - 用于标识可取消的操作范围
 */
export type CancellationDomain =
  | "node-check"
  | "node-install"
  | "cli-check"
  | "cli-install"
  | "gateway-start"
  | "connection-check";

/**
 * 取消原因
 */
export type CancellationReason =
  | "user-requested"
  | "timeout"
  | "superseded"
  | "component-unmount";

/**
 * 取消状态
 */
export interface CancellationState {
  cancelled: boolean;
  reason?: CancellationReason;
  timestamp?: number;
}

// ============================================================================
// CancellableController
// ============================================================================

/**
 * 可取消控制器
 *
 * 提供类似 AbortController 的接口，但支持更丰富的取消语义
 */
export class CancellableController {
  private _state: CancellationState = { cancelled: false };
  private _listeners: Set<(reason: CancellationReason) => void> = new Set();
  private _abortController: AbortController;

  constructor() {
    this._abortController = new AbortController();
  }

  /**
   * 获取 AbortSignal (用于 fetch 等 API)
   */
  get signal(): AbortSignal {
    return this._abortController.signal;
  }

  /**
   * 是否已取消
   */
  get cancelled(): boolean {
    return this._state.cancelled;
  }

  /**
   * 取消原因
   */
  get reason(): CancellationReason | undefined {
    return this._state.reason;
  }

  /**
   * 取消操作
   */
  cancel(reason: CancellationReason = "user-requested"): void {
    if (this._state.cancelled) return;

    this._state = {
      cancelled: true,
      reason,
      timestamp: Date.now(),
    };

    this._abortController.abort();

    for (const listener of this._listeners) {
      try {
        listener(reason);
      } catch (e) {
        console.error("[CancellableController] Listener error:", e);
      }
    }
  }

  /**
   * 添加取消监听器
   */
  onCancel(listener: (reason: CancellationReason) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * 检查是否已取消，如果已取消则抛出错误
   */
  throwIfCancelled(): void {
    if (this._state.cancelled) {
      throw new CancellationError(this._state.reason || "user-requested");
    }
  }

  /**
   * 创建一个在取消时拒绝的 Promise
   */
  createCancellationPromise<T = never>(): Promise<T> {
    return new Promise((_, reject) => {
      if (this._state.cancelled) {
        reject(new CancellationError(this._state.reason || "user-requested"));
        return;
      }

      this.onCancel((reason) => {
        reject(new CancellationError(reason));
      });
    });
  }

  /**
   * 包装一个 Promise，使其可以被取消
   */
  async race<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, this.createCancellationPromise<T>()]);
  }
}

// ============================================================================
// CancellationError
// ============================================================================

/**
 * 取消错误
 */
export class CancellationError extends Error {
  readonly reason: CancellationReason;
  readonly isCancellation = true;

  constructor(reason: CancellationReason) {
    super(`Operation cancelled: ${reason}`);
    this.name = "CancellationError";
    this.reason = reason;
  }
}

/**
 * 判断是否为取消错误
 */
export function isCancellationError(error: unknown): error is CancellationError {
  return (
    error instanceof CancellationError ||
    (error instanceof Error && (error as CancellationError).isCancellation === true)
  );
}

// ============================================================================
// Domain Registry
// ============================================================================

/**
 * 取消域注册表
 *
 * 管理多个域的取消控制器
 */
export class CancellationRegistry {
  private _controllers = new Map<CancellationDomain, CancellableController>();

  /**
   * 获取或创建域控制器
   */
  getOrCreate(domain: CancellationDomain): CancellableController {
    let controller = this._controllers.get(domain);

    if (!controller || controller.cancelled) {
      controller = new CancellableController();
      this._controllers.set(domain, controller);
    }

    return controller;
  }

  /**
   * 取消指定域
   */
  cancel(domain: CancellationDomain, reason: CancellationReason = "user-requested"): void {
    const controller = this._controllers.get(domain);
    controller?.cancel(reason);
  }

  /**
   * 取消所有域
   */
  cancelAll(reason: CancellationReason = "component-unmount"): void {
    for (const controller of this._controllers.values()) {
      controller.cancel(reason);
    }
  }

  /**
   * 重置指定域
   */
  reset(domain: CancellationDomain): CancellableController {
    const controller = new CancellableController();
    this._controllers.set(domain, controller);
    return controller;
  }

  /**
   * 清理所有控制器
   */
  dispose(): void {
    this.cancelAll("component-unmount");
    this._controllers.clear();
  }
}

// ============================================================================
// React Hook Support
// ============================================================================

/**
 * 创建用于 React useEffect 的取消支持
 */
export function createEffectCancellation(): {
  controller: CancellableController;
  cleanup: () => void;
} {
  const controller = new CancellableController();

  return {
    controller,
    cleanup: () => controller.cancel("component-unmount"),
  };
}
```

- [ ] **Step 2: 保存文件**

---

## 模块三：Welcome 页面 (Task 5)

### Task 5: 创建 Welcome 页面组件

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/Welcome.tsx`

**Files:**
- Create: `apps/desktop/src/components/onboarding/welcome-page.tsx`

- [ ] **Step 1: 创建 Welcome 页面组件**

```tsx
/**
 * Welcome Page Component
 *
 * First-time launch disclaimer, permission explanation, risk warning
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/Welcome.tsx
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Shield, Database, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

// ============================================================================
// Types
// ============================================================================

interface WelcomePageProps {
  onAccept: () => void;
}

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function InfoCard({ icon, title, description, className }: InfoCardProps) {
  return (
    <Card className={cn("border-muted", className)}>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-medium leading-none">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function WelcomePage({ onAccept }: WelcomePageProps) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = React.useState(false);

  const infoCards = [
    {
      icon: <Shield className="h-5 w-5" />,
      title: t("onboarding.welcome.cards.security.title"),
      description: t("onboarding.welcome.cards.security.description"),
    },
    {
      icon: <Database className="h-5 w-5" />,
      title: t("onboarding.welcome.cards.data.title"),
      description: t("onboarding.welcome.cards.data.description"),
    },
    {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: t("onboarding.welcome.cards.risk.title"),
      description: t("onboarding.welcome.cards.risk.description"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("onboarding.welcome.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.welcome.subtitle")}
        </p>
      </div>

      {/* Info Cards */}
      <div className="space-y-3">
        {infoCards.map((card, index) => (
          <InfoCard
            key={index}
            icon={card.icon}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          {t("onboarding.welcome.disclaimer")}
        </p>
      </div>

      {/* Acceptance Checkbox */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          className="mt-0.5"
        />
        <label
          htmlFor="accept-terms"
          className="text-sm leading-relaxed text-muted-foreground cursor-pointer"
        >
          {t("onboarding.welcome.acceptTerms")}
        </label>
      </div>

      {/* Continue Button */}
      <Button
        onClick={onAccept}
        disabled={!accepted}
        className="w-full"
        size="lg"
      >
        {t("onboarding.welcome.continue")}
      </Button>

      {/* Links */}
      <div className="flex justify-center gap-4 text-sm">
        <a
          href="https://github.com/LinXueyuanStdio/viben"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://github.com/LinXueyuanStdio/viben/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {t("onboarding.welcome.license")}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 保存文件**

---

## 模块四：EnvCheck 页面 (Task 6-7)

### Task 6: 创建环境检查步骤项组件

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` (步骤渲染)

**Files:**
- Create: `apps/desktop/src/components/onboarding/env-check-step-item.tsx`

- [ ] **Step 1: 创建环境检查步骤项组件**

```tsx
/**
 * EnvCheck Step Item Component
 *
 * Individual step display for environment checking
 */

import * as React from "react";
import {
  Check,
  X,
  Loader2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export type EnvCheckStepStatus =
  | "pending"
  | "checking"
  | "success"
  | "warning"
  | "error";

export interface EnvCheckStepItemProps {
  title: string;
  status: EnvCheckStepStatus;
  tooltip?: string;
  description?: string;
  details?: string;
  version?: string;
  path?: string;
  error?: {
    title: string;
    message: string;
    details?: string;
  };
  onRetry?: () => void;
  onCancel?: () => void;
  isRetrying?: boolean;
  isCancelling?: boolean;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusIcon({ status }: { status: EnvCheckStepStatus }) {
  switch (status) {
    case "checking":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "success":
      return <Check className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "error":
      return <X className="h-4 w-4 text-destructive" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

// ============================================================================
// Component
// ============================================================================

export function EnvCheckStepItem({
  title,
  status,
  tooltip,
  description,
  details,
  version,
  path,
  error,
  onRetry,
  onCancel,
  isRetrying,
  isCancelling,
  className,
}: EnvCheckStepItemProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const hasExpandableContent = !!(details || error?.details || path);

  const statusColors: Record<EnvCheckStepStatus, string> = {
    pending: "border-muted",
    checking: "border-primary/50",
    success: "border-green-500/20 bg-green-500/5",
    warning: "border-yellow-500/20 bg-yellow-500/5",
    error: "border-destructive/20 bg-destructive/5",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        statusColors[status],
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Status and Title */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <StatusIcon status={status} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {tooltip ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium cursor-help">{title}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="font-medium">{title}</span>
              )}
              {version && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  v{version}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {error && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {error.title}
                </p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {status === "checking" && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "取消中..." : "取消"}
            </Button>
          )}
          {status === "error" && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? "重试中..." : "重试"}
            </Button>
          )}
          {hasExpandableContent && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Expandable Content */}
      {hasExpandableContent && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="mt-3 pt-3 border-t border-muted">
            <div className="space-y-2 text-sm">
              {path && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">路径:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {path}
                  </code>
                </div>
              )}
              {(details || error?.details) && (
                <pre className="rounded bg-muted p-2 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                  {details || error?.details}
                </pre>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 保存文件**

---

### Task 7: 创建 EnvCheck 页面组件

**Qclaw 参考:** `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx`

**Files:**
- Create: `apps/desktop/src/components/onboarding/env-check-page.tsx`

- [ ] **Step 1: 创建 EnvCheck 页面组件**

```tsx
/**
 * EnvCheck Page Component
 *
 * Separated environment check page for Node.js and CLI
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EnvCheckStepItem, type EnvCheckStepStatus } from "./env-check-step-item";
import { useNodeInstaller } from "@/hooks/use-node-installer";
import { useCliInstaller } from "@/hooks/use-cli-installer";
import { LoadingScreen } from "./loading-screen";
import {
  ENV_CHECK_UI_POLICY,
  ENV_CHECK_STEP_TOOLTIPS,
  getEnvCheckSupportActionsForIssueKind,
} from "@/lib/onboarding/env-check-policy";
import {
  CancellationRegistry,
  isCancellationError,
} from "@/lib/onboarding/cancellation";

// ============================================================================
// Types
// ============================================================================

interface EnvCheckPageProps {
  onComplete: () => void;
  onBack?: () => void;
}

type EnvCheckPhase =
  | "initial"
  | "node-check"
  | "node-install"
  | "cli-check"
  | "cli-install"
  | "done"
  | "error";

interface EnvCheckState {
  node: {
    status: EnvCheckStepStatus;
    version?: string;
    path?: string;
    error?: { title: string; message: string; details?: string };
  };
  cli: {
    status: EnvCheckStepStatus;
    version?: string;
    path?: string;
    error?: { title: string; message: string; details?: string };
  };
}

// ============================================================================
// Component
// ============================================================================

export function EnvCheckPage({ onComplete, onBack }: EnvCheckPageProps) {
  const { t } = useTranslation();

  // Hooks
  const {
    state: nodeState,
    issue: nodeIssue,
    currentVersion: nodeVersion,
    checkNode,
    installNode,
  } = useNodeInstaller();

  const {
    state: cliState,
    issue: cliIssue,
    currentVersion: cliVersion,
    checkCli,
    installCli,
  } = useCliInstaller();

  // Local state
  const [phase, setPhase] = React.useState<EnvCheckPhase>("initial");
  const [progress, setProgress] = React.useState(0);
  const [tipIndex, setTipIndex] = React.useState(0);
  const [envState, setEnvState] = React.useState<EnvCheckState>({
    node: { status: "pending" },
    cli: { status: "pending" },
  });
  const [retryCount, setRetryCount] = React.useState(0);

  const cancellationRef = React.useRef(new CancellationRegistry());
  const checkRunRef = React.useRef(false);

  const maxRetries = 3;
  const isChecking = phase !== "done" && phase !== "error" && phase !== "initial";

  // ============================================================================
  // Loading Tips Rotation
  // ============================================================================

  React.useEffect(() => {
    if (!isChecking) return;

    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % ENV_CHECK_UI_POLICY.loadingTips.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isChecking]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  React.useEffect(() => {
    return () => {
      cancellationRef.current.dispose();
    };
  }, []);

  // ============================================================================
  // Environment Check Flow
  // ============================================================================

  const runEnvCheck = React.useCallback(async () => {
    if (checkRunRef.current) return;
    checkRunRef.current = true;

    const registry = cancellationRef.current;
    registry.cancelAll("superseded");

    setProgress(10);

    // Phase 1: Check Node.js
    setPhase("node-check");
    setEnvState((s) => ({ ...s, node: { status: "checking" } }));

    try {
      const nodeController = registry.getOrCreate("node-check");
      const nodeResult = await nodeController.race(checkNode());

      if (nodeResult.installed) {
        setEnvState((s) => ({
          ...s,
          node: {
            status: "success",
            version: nodeResult.version,
            path: nodeResult.path,
          },
        }));
        setProgress(30);
      } else {
        // Need to install Node.js
        setPhase("node-install");
        setEnvState((s) => ({ ...s, node: { status: "checking" } }));

        const installController = registry.getOrCreate("node-install");
        await installController.race(installNode());

        // Re-check after install
        const recheck = await checkNode();
        if (recheck.installed) {
          setEnvState((s) => ({
            ...s,
            node: {
              status: "success",
              version: recheck.version,
              path: recheck.path,
            },
          }));
          setProgress(30);
        } else {
          throw new Error("Node.js installation failed");
        }
      }
    } catch (err) {
      if (isCancellationError(err)) {
        setEnvState((s) => ({ ...s, node: { status: "pending" } }));
        checkRunRef.current = false;
        return;
      }

      const error = nodeIssue || {
        title: "Node.js 检查失败",
        message: err instanceof Error ? err.message : String(err),
      };

      setEnvState((s) => ({
        ...s,
        node: {
          status: "error",
          error: {
            title: error.title || "错误",
            message: error.message || "未知错误",
            details: error.details,
          },
        },
      }));
      setPhase("error");
      checkRunRef.current = false;
      return;
    }

    // Phase 2: Check CLI
    setPhase("cli-check");
    setEnvState((s) => ({ ...s, cli: { status: "checking" } }));
    setProgress(50);

    try {
      const cliController = registry.getOrCreate("cli-check");
      const cliResult = await cliController.race(checkCli());

      if (cliResult.installed) {
        setEnvState((s) => ({
          ...s,
          cli: {
            status: "success",
            version: cliResult.version,
            path: cliResult.path,
          },
        }));
        setProgress(100);
        setPhase("done");
      } else {
        // Need to install CLI
        setPhase("cli-install");
        setProgress(70);

        const installController = registry.getOrCreate("cli-install");
        await installController.race(installCli());

        // Re-check after install
        const recheck = await checkCli();
        if (recheck.installed) {
          setEnvState((s) => ({
            ...s,
            cli: {
              status: "success",
              version: recheck.version,
              path: recheck.path,
            },
          }));
          setProgress(100);
          setPhase("done");
        } else {
          throw new Error("CLI installation failed");
        }
      }
    } catch (err) {
      if (isCancellationError(err)) {
        setEnvState((s) => ({ ...s, cli: { status: "pending" } }));
        checkRunRef.current = false;
        return;
      }

      const error = cliIssue || {
        title: "Viben CLI 检查失败",
        message: err instanceof Error ? err.message : String(err),
      };

      setEnvState((s) => ({
        ...s,
        cli: {
          status: "error",
          error: {
            title: error.title || "错误",
            message: error.message || "未知错误",
            details: error.details,
          },
        },
      }));
      setPhase("error");
    }

    checkRunRef.current = false;
  }, [checkNode, installNode, checkCli, installCli, nodeIssue, cliIssue]);

  // Auto-start check on mount
  React.useEffect(() => {
    if (phase === "initial") {
      runEnvCheck();
    }
  }, [phase, runEnvCheck]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRetry = () => {
    if (retryCount >= maxRetries) return;
    setRetryCount((c) => c + 1);
    setEnvState({
      node: { status: "pending" },
      cli: { status: "pending" },
    });
    setPhase("initial");
    checkRunRef.current = false;
    runEnvCheck();
  };

  const handleCancel = (domain: "node-check" | "node-install" | "cli-check" | "cli-install") => {
    cancellationRef.current.cancel(domain, "user-requested");
  };

  const handleContinue = () => {
    onComplete();
  };

  const canContinue = phase === "done";
  const canRetry = phase === "error" && retryCount < maxRetries;

  // Get support actions for current error
  const supportActions = phase === "error"
    ? getEnvCheckSupportActionsForIssueKind(nodeIssue?.kind || cliIssue?.kind)
    : [];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.envCheck.title")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.envCheck.description")}
        </p>
      </div>

      {/* Progress Bar */}
      {isChecking && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground animate-fade-in">
            {ENV_CHECK_UI_POLICY.loadingTips[tipIndex]}
          </p>
        </div>
      )}

      {/* Step Items */}
      <div className="space-y-3">
        <EnvCheckStepItem
          title="Node.js"
          status={envState.node.status}
          tooltip={ENV_CHECK_STEP_TOOLTIPS.node}
          version={envState.node.version}
          path={envState.node.path}
          error={envState.node.error}
          onRetry={envState.node.status === "error" ? handleRetry : undefined}
          onCancel={
            phase === "node-check" || phase === "node-install"
              ? () => handleCancel(phase as "node-check" | "node-install")
              : undefined
          }
        />

        <EnvCheckStepItem
          title="Viben CLI"
          status={envState.cli.status}
          tooltip={ENV_CHECK_STEP_TOOLTIPS.viben}
          version={envState.cli.version}
          path={envState.cli.path}
          error={envState.cli.error}
          onRetry={envState.cli.status === "error" ? handleRetry : undefined}
          onCancel={
            phase === "cli-check" || phase === "cli-install"
              ? () => handleCancel(phase as "cli-check" | "cli-install")
              : undefined
          }
        />
      </div>

      {/* Support Actions */}
      {supportActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {supportActions.map((action, i) => (
            <a
              key={i}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {action.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack} disabled={isChecking}>
              {t("common.back")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {canRetry && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.retry")} ({maxRetries - retryCount})
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!canContinue}>
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 保存文件**

---

## 模块五：Hooks (Task 8)

### Task 8: 创建 Node.js 安装 Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-node-installer.ts`

- [ ] **Step 1: 创建 Node.js 安装 hook**

```typescript
/**
 * Node.js Installer Hook
 *
 * Provides Node.js version checking and installation functionality
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  NodeInstallerIssue,
  NodeInstallerIssueKind,
} from "@/lib/onboarding/node-installer-issues";
import {
  createNodeInstallerIssue,
  classifyMacNodeInstallerFailure,
  classifyMacGitToolsIssue,
} from "@/lib/onboarding/node-installer-issues";

// ============================================================================
// Types
// ============================================================================

type NodeInstallerState = "idle" | "checking" | "installing" | "done" | "error";

interface NodeCheckResult {
  installed: boolean;
  version?: string;
  path?: string;
}

interface UseNodeInstallerReturn {
  state: NodeInstallerState;
  issue: NodeInstallerIssue | null;
  currentVersion: string | null;
  currentPath: string | null;
  checkNode: () => Promise<NodeCheckResult>;
  installNode: () => Promise<void>;
  reset: () => void;
}

// ============================================================================
// Tauri Command Types
// ============================================================================

interface TauriNodeCheckResult {
  found: boolean;
  version?: string;
  path?: string;
  error?: string;
}

interface TauriNodeInstallResult {
  success: boolean;
  version?: string;
  path?: string;
  error?: string;
  error_code?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useNodeInstaller(): UseNodeInstallerReturn {
  const [state, setState] = React.useState<NodeInstallerState>("idle");
  const [issue, setIssue] = React.useState<NodeInstallerIssue | null>(null);
  const [currentVersion, setCurrentVersion] = React.useState<string | null>(null);
  const [currentPath, setCurrentPath] = React.useState<string | null>(null);

  const checkNode = React.useCallback(async (): Promise<NodeCheckResult> => {
    setState("checking");
    setIssue(null);

    try {
      const result = await invoke<TauriNodeCheckResult>("check_node_installation");

      if (result.found && result.version) {
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);
        setState("done");
        return {
          installed: true,
          version: result.version,
          path: result.path,
        };
      }

      setState("idle");
      return { installed: false };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useNodeInstaller] Check failed:", errorMsg);

      // Check for specific error types
      if (errorMsg.includes("xcode") || errorMsg.includes("clt")) {
        const nodeIssue = classifyMacGitToolsIssue({
          errorCode: "xcode_clt_pending",
          stderr: errorMsg,
        });
        setIssue(nodeIssue);
      }

      setState("error");
      return { installed: false };
    }
  }, []);

  const installNode = React.useCallback(async (): Promise<void> => {
    setState("installing");
    setIssue(null);

    try {
      const result = await invoke<TauriNodeInstallResult>("install_node");

      if (result.success && result.version) {
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);
        setState("done");
        return;
      }

      // Installation failed
      const nodeIssue = result.error
        ? classifyMacNodeInstallerFailure(result.error)
        : createNodeInstallerIssue("installer-failed");

      setIssue(nodeIssue);
      setState("error");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useNodeInstaller] Install failed:", errorMsg);

      const nodeIssue = classifyMacNodeInstallerFailure(errorMsg);
      setIssue(nodeIssue);
      setState("error");
    }
  }, []);

  const reset = React.useCallback(() => {
    setState("idle");
    setIssue(null);
    setCurrentVersion(null);
    setCurrentPath(null);
  }, []);

  return {
    state,
    issue,
    currentVersion,
    currentPath,
    checkNode,
    installNode,
    reset,
  };
}
```

- [ ] **Step 2: 保存文件**

---

## 模块六：修改现有文件 (Task 9-11)

### Task 9: 更新 onboarding-wizard.tsx 添加新步骤

**Files:**
- Modify: `apps/desktop/src/components/onboarding/onboarding-wizard.tsx`

- [ ] **Step 1: 添加 Welcome 和 EnvCheck 导入**

在文件顶部导入部分添加:

```typescript
import { WelcomePage } from "./welcome-page";
import { EnvCheckPage } from "./env-check-page";
```

- [ ] **Step 2: 更新 OnboardingStep 类型**

修改 `onboarding-progress.tsx` 中的类型定义，添加新步骤:

```typescript
export type OnboardingStep = "welcome" | "envCheck" | "gateway" | "python" | "claude" | "login";
```

- [ ] **Step 3: 更新初始步骤和状态**

```typescript
const [currentStep, setCurrentStep] = React.useState<OnboardingStep>("welcome");
```

- [ ] **Step 4: 添加 Welcome 和 EnvCheck 处理函数**

```typescript
const handleWelcomeAccept = () => {
  completeStep("welcome");
  setCurrentStep("envCheck");
};

const handleEnvCheckComplete = () => {
  completeStep("envCheck");
  setCurrentStep("gateway");
};

const handleEnvCheckBack = () => {
  setCurrentStep("welcome");
};
```

- [ ] **Step 5: 更新渲染部分添加新步骤**

在 `{/* Step content */}` 部分添加:

```tsx
{currentStep === "welcome" && (
  <WelcomePage onAccept={handleWelcomeAccept} />
)}
{currentStep === "envCheck" && (
  <EnvCheckPage
    onComplete={handleEnvCheckComplete}
    onBack={handleEnvCheckBack}
  />
)}
```

- [ ] **Step 6: 保存文件**

---

### Task 10: 更新 onboarding-progress.tsx

**Files:**
- Modify: `apps/desktop/src/components/onboarding/onboarding-progress.tsx`

- [ ] **Step 1: 更新步骤配置数组**

在 `STEPS` 数组中添加新步骤:

```typescript
const STEPS: { key: OnboardingStep; labelKey: string }[] = [
  { key: "welcome", labelKey: "onboarding.progress.welcome" },
  { key: "envCheck", labelKey: "onboarding.progress.envCheck" },
  { key: "gateway", labelKey: "onboarding.progress.gateway" },
  { key: "python", labelKey: "onboarding.progress.python" },
  { key: "claude", labelKey: "onboarding.progress.claude" },
  { key: "login", labelKey: "onboarding.progress.login" },
];
```

- [ ] **Step 2: 保存文件**

---

### Task 11: 添加 i18n 翻译

**Files:**
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`
- Modify: `apps/desktop/src/i18n/locales/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `onboarding` 对象中添加:

```json
{
  "onboarding": {
    "welcome": {
      "title": "欢迎使用 Viben",
      "subtitle": "在开始之前，请阅读以下重要信息",
      "cards": {
        "security": {
          "title": "本地运行",
          "description": "Viben 完全在您的电脑上运行，所有数据存储在本地"
        },
        "data": {
          "title": "数据隐私",
          "description": "您的配置和对话数据仅保存在您的设备上"
        },
        "risk": {
          "title": "使用须知",
          "description": "AI 生成的内容可能存在错误，请在使用前仔细检查"
        }
      },
      "disclaimer": "使用 Viben 前请确保您已阅读并理解上述信息。继续使用即表示您同意承担相关风险。",
      "acceptTerms": "我已阅读并理解上述信息，同意继续使用",
      "continue": "开始使用",
      "license": "开源协议"
    },
    "envCheck": {
      "title": "环境检查",
      "description": "正在检查和配置运行环境"
    },
    "progress": {
      "welcome": "欢迎",
      "envCheck": "环境检查"
    }
  }
}
```

- [ ] **Step 2: 添加英文翻译**

```json
{
  "onboarding": {
    "welcome": {
      "title": "Welcome to Viben",
      "subtitle": "Please read the following important information before getting started",
      "cards": {
        "security": {
          "title": "Local Execution",
          "description": "Viben runs entirely on your computer, all data is stored locally"
        },
        "data": {
          "title": "Data Privacy",
          "description": "Your configuration and conversation data is only stored on your device"
        },
        "risk": {
          "title": "Usage Notice",
          "description": "AI-generated content may contain errors, please review carefully before use"
        }
      },
      "disclaimer": "Please ensure you have read and understood the above information before using Viben. By continuing, you agree to assume the associated risks.",
      "acceptTerms": "I have read and understand the above information, and agree to continue",
      "continue": "Get Started",
      "license": "License"
    },
    "envCheck": {
      "title": "Environment Check",
      "description": "Checking and configuring runtime environment"
    },
    "progress": {
      "welcome": "Welcome",
      "envCheck": "Environment"
    }
  }
}
```

- [ ] **Step 3: 保存文件**

---

## 模块七：Tauri 命令 (Task 12)

### Task 12: 添加 Node.js 检查 Tauri 命令

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/cli_installer.rs`

- [ ] **Step 1: 添加 Node.js 检查命令**

```rust
#[tauri::command]
pub async fn check_node_installation() -> Result<NodeCheckResult, String> {
    use std::process::Command;

    let output = Command::new("node")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();

            // Try to get node path
            let path_output = Command::new("which")
                .arg("node")
                .output();

            let path = path_output
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

            Ok(NodeCheckResult {
                found: true,
                version: Some(version),
                path,
                error: None,
            })
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            // Check for Xcode CLT issue
            if stderr.contains("xcode-select") || stderr.contains("command line tools") {
                return Ok(NodeCheckResult {
                    found: false,
                    version: None,
                    path: None,
                    error: Some("xcode_clt_pending".to_string()),
                });
            }

            Ok(NodeCheckResult {
                found: false,
                version: None,
                path: None,
                error: Some(stderr),
            })
        }
        Err(e) => Ok(NodeCheckResult {
            found: false,
            version: None,
            path: None,
            error: Some(e.to_string()),
        }),
    }
}

#[derive(serde::Serialize)]
pub struct NodeCheckResult {
    found: bool,
    version: Option<String>,
    path: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn install_node() -> Result<NodeInstallResult, String> {
    // This is a placeholder - actual implementation would need to:
    // 1. Download Node.js installer
    // 2. Run installer with appropriate permissions
    // 3. Verify installation

    // For now, return an error indicating manual installation is needed
    Ok(NodeInstallResult {
        success: false,
        version: None,
        path: None,
        error: Some("Automatic Node.js installation not yet implemented. Please install Node.js manually from https://nodejs.org/".to_string()),
        error_code: Some("manual_install_required".to_string()),
    })
}

#[derive(serde::Serialize)]
pub struct NodeInstallResult {
    success: bool,
    version: Option<String>,
    path: Option<String>,
    error: Option<String>,
    error_code: Option<String>,
}
```

- [ ] **Step 2: 注册命令到 main.rs**

在 `main.rs` 的 `invoke_handler` 中添加:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::cli_installer::check_node_installation,
    commands::cli_installer::install_node,
])
```

- [ ] **Step 3: 保存文件**

---

## 模块八：导出更新 (Task 13)

### Task 13: 更新 lib/onboarding/index.ts 导出

**Files:**
- Modify: `apps/desktop/src/lib/onboarding/index.ts`

- [ ] **Step 1: 添加新模块导出**

```typescript
// Node.js installer issues
export * from "./node-installer-issues";

// Environment check policy
export * from "./env-check-policy";

// CLI discovery
export * from "./cli-discovery";

// Cancellation support
export * from "./cancellation";
```

- [ ] **Step 2: 保存文件**

---

## 执行检查清单

- [ ] Task 1: node-installer-issues.ts 创建完成
- [ ] Task 2: env-check-policy.ts 创建完成
- [ ] Task 3: cli-discovery.ts 创建完成
- [ ] Task 4: cancellation.ts 创建完成
- [ ] Task 5: welcome-page.tsx 创建完成
- [ ] Task 6: env-check-step-item.tsx 创建完成
- [ ] Task 7: env-check-page.tsx 创建完成
- [ ] Task 8: use-node-installer.ts 创建完成
- [ ] Task 9: onboarding-wizard.tsx 更新完成
- [ ] Task 10: onboarding-progress.tsx 更新完成
- [ ] Task 11: i18n 翻译添加完成
- [ ] Task 12: Tauri Node.js 命令添加完成
- [ ] Task 13: lib/onboarding/index.ts 导出更新完成
- [ ] TypeScript 编译通过
- [ ] 功能测试通过
