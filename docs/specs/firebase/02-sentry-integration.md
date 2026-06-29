# Sentry 错误监控集成规范

---

## 一、概述

### 1.1 Sentry 在 Tauri Web 环境中的定位

Sentry 是 Viben Desktop 的**错误监控与崩溃上报系统**，运行在 Tauri WebView 的前端 JavaScript 环境中。它负责捕获、聚合和告警应用中发生的所有异常，帮助开发团队在用户反馈之前发现并修复问题。

### 1.2 与 Firebase Analytics 的分工

| 维度 | Sentry | Firebase Analytics |
|------|--------|-------------------|
| 职责 | 错误捕获、崩溃上报、性能 tracing | 用户行为分析、转化漏斗、留存 |
| 数据方向 | 从异常反推根因 | 从行为分析趋势 |
| 触发方式 | 自动捕获（被动） | 主动调用 logEvent() |
| 告警 | 实时错误告警 | 指标异常检测 |
| 保留周期 | 90 天（event） | 14 个月（event） |
| 场景 | 开发团队排查 Bug | 产品经理/运营分析数据 |

**核心原则**：Sentry 管"哪里坏了"（错误监控），Analytics 管"用户怎么用的"（行为分析）。两者通过 `sentry_event_id` 串联，形成"用户做了什么 → 遇到了什么错误"的完整链路。

### 1.3 当前错误处理现状（基于代码分析）

综合报告揭示了以下待改进点：

- **App.tsx** 和 **MobileApp.tsx** 各自内联了完全相同的 `AppErrorBoundary` 类，存在代码重复
- Error Boundary 仅 `console.error` 输出，无上报能力
- 多个页面在异常路径返回空白（如 `WorkspaceChatPage` 在 workspace 为 null 时返回空白）
- 多处页面错误仅 `console.error`，缺少 try-catch 和用户提示（如 `WorkspaceIdeasPage`）
- lazy-load 页面（MarketplacePage、SkillsMarketPage）仅靠 Suspense fallback，无加载错误边界
- 约 40+ 处 `console.log/warn/error/debug` 调用，无统一 Logger 抽象层
- 无 Tauri 进程 crash 监听机制

---

## 二、初始化配置

### 2.1 DSN 管理方案

Sentry DSN 通过 Vite 环境变量 `VITE_SENTRY_DSN` 管理：

- **开发环境**：可选设置，不设置则 Sentry 不初始化（no-op 模式），避免本地开发产生噪音
- **生产环境**：CI/CD 构建时注入真实的 Sentry DSN
- **构建时替换**：通过 Vite 的 `define` 或 `import.meta.env` 机制注入，不会暴露在源码仓库中

```bash
# .env.local（本地开发，不提交到 Git）
VITE_SENTRY_DSN=https://xxxxxx@ingest.sentry.io/xxxxxx

# CI 构建（GitHub Actions secrets 注入）
VITE_SENTRY_DSN=${{ secrets.SENTRY_DSN }}
```

### 2.2 环境区分

使用 Sentry 的 `environment` 字段区分环境，便于在 Sentry 控制台中过滤和告警：

| 环境 | environment 值 | DSN | 说明 |
|------|---------------|-----|------|
| 本地开发 | `development` | 可选的 dev DSN 或不设置 | 默认不初始化，避免噪音 |
| CI 测试 | `ci` | 不设置 | 测试环境不上报 |
| 生产 | `production` | 真实的 prod DSN | 所有用户上报到此环境 |

```typescript
const environment = import.meta.env.DEV
  ? "development"
  : import.meta.env.MODE === "production"
    ? "production"
    : "ci";
```

### 2.3 发布版本追踪

将 Sentry 的 `release` 字段与 `package.json` 中的 `version` 关联，用于：

- 区分不同版本的错误分布
- 在 Sentry Release 面板中追踪回归（新版本引入的错误）
- 关联 source map 进行错误堆栈反混淆

```typescript
import { version } from "../../package.json";

Sentry.init({
  release: `viben-desktop@${version}`,
  // ...
});
```

**注意**：Sentry release 格式建议为 `packageName@version`，如 `viben-desktop@1.3.1`，以区分 monorepo 中不同包的错误。

### 2.4 用户上下文设置

使用机器 ID 进行匿名化标识，**绝不发送个人信息**：

- **不发送**：邮箱、用户名、IP 地址（Sentry 默认关闭 IP 收集）、GitHub 用户名、工作区路径
- **发送**：匿名化机器 ID（hash）、应用版本、操作系统信息、Sentry 自动收集的浏览器/WebView 信息

```typescript
// 使用稳定的匿名化标识符
// 方案 A：使用 Tauri 的机器 ID（需 Rust 端暴露）
import { invoke } from "@tauri-apps/api/core";
const machineId = await invoke("get_machine_id"); // Rust 端实现 SHA-256(machine_uid)
Sentry.setUser({ id: machineId });

// 方案 B（fallback）：使用 localStorage 生成并持久化的匿名 ID
function getAnonymousUserId(): string {
  const key = "__viben_anonymous_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
Sentry.setUser({ id: getAnonymousUserId() });
```

**强制 PII 清洗**：在 `beforeSend` 中过滤可能包含个人信息的字段。

### 2.5 Sentry.init() 完整配置示例

```typescript
// src/lib/sentry.ts
import * as Sentry from "@sentry/react";
import { version } from "../../package.json";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // DSN 未配置时静默跳过，不产生任何副作用
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info("[sentry] VITE_SENTRY_DSN not set — error reporting disabled");
    }
    return;
  }

  // 匿名用户 ID
  const anonymousId = getAnonymousUserId();

  Sentry.init({
    dsn,
    release: `viben-desktop@${version}`,
    environment: import.meta.env.DEV
      ? "development"
      : import.meta.env.MODE === "production"
        ? "production"
        : "ci",

    // ── 采样率 ──────────────────────────────────
    sampleRate: 1.0,                     // 错误采样率 100%（生产环境）
    tracesSampleRate: 0.1,               // 性能采样率 10%
    replaysSessionSampleRate: 0,         // 暂不启用 Session Replay
    replaysOnErrorSampleRate: 0,         // 暂不启用

    // ── Breadcrumbs 限制 ──────────────────────
    maxBreadcrumbs: 30,                  // 最多保留 30 条 breadcrumb

    // ── 敏感信息过滤 ──────────────────────────
    beforeSend(event) {
      // 过滤可能包含 PII 的数据
      return sanitizeEvent(event);
    },

    // ── beforeBreadcrumb ──────────────────────
    beforeBreadcrumb(breadcrumb) {
      // 控制台 breadcrumb 仅在生产环境上报 error 级别
      if (breadcrumb.category === "console") {
        const level = breadcrumb.level;
        if (level !== "error") {
          return null; // 丢弃非 error 级别的 console
        }
      }
      return breadcrumb;
    },

    // ── 忽略特定错误 ──────────────────────────
    ignoreErrors: [
      // 网络无关错误
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      // 用户主动中断
      "AbortError",
      "The user aborted a request",
      "cancel",
      // Tauri WebView 正常关闭
      "window.close",
      // ResizeObserver 无害错误
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],

    // ── 用户上下文 ────────────────────────────
    initialScope: {
      user: { id: anonymousId },
      tags: {
        "app.platform": navigator.platform,
        "app.language": navigator.language,
      },
    },
  });
}

/**
 * 获取或生成稳定的匿名用户标识符
 */
function getAnonymousUserId(): string {
  const key = "__viben_anonymous_user_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    // localStorage 不可用时 fallback（如隐私模式）
    return "unknown";
  }
}

/**
 * 清理事件中的敏感信息
 */
function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // 移除 HTTP 请求中的敏感 headers
  if (event.request?.headers) {
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "set-cookie",
      "x-api-key",
      "x-auth-token",
    ];
    for (const key of Object.keys(event.request.headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        delete event.request.headers[key];
      }
    }
  }

  // 移除 URL 中的敏感查询参数
  if (event.request?.url) {
    try {
      const url = new URL(event.request.url);
      const sensitiveParams = ["token", "api_key", "secret", "password", "auth"];
      for (const param of sensitiveParams) {
        url.searchParams.delete(param);
      }
      event.request.url = url.toString();
    } catch {
      // URL 解析失败，保持原样
    }
  }

  // 移除可能包含文件路径的额外信息（workspace_path 等）
  if (event.extra) {
    const pathFields = [
      "workspace_path",
      "file_path",
      "home_dir",
      "config_dir",
    ];
    for (const field of pathFields) {
      delete event.extra[field];
    }
  }

  return event;
}
```

---

## 三、ErrorBoundary 组件设计

### 3.1 React Error Boundary 的 Props 接口设计

```typescript
// src/components/sentry-error-boundary.tsx
import { Component, type ReactNode, type ErrorInfo } from "react";
import * as Sentry from "@sentry/react";

interface SentryErrorBoundaryProps {
  children: ReactNode;
  /** 标识边界名称，便于在 Sentry 中定位具体哪个边界捕获了错误 */
  name?: string;
  /** 自定义 fallback UI，不传则使用默认 UI */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  /** 错误发生时的回调（如上报 Analytics 事件） */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}
```

### 3.2 与现有 App.tsx / MobileApp.tsx 的集成方案

**现状**：`App.tsx`（78-116 行）和 `MobileApp.tsx`（8-46 行）各自定义了一个完全相同的 `AppErrorBoundary` 类。

**方案**：

1. 新建 `src/components/sentry-error-boundary.tsx`，实现统一的 `SentryErrorBoundary` 组件
2. 在 `App.tsx` 中将 `<AppErrorBoundary>` 替换为 `<SentryErrorBoundary name="App">`
3. 在 `MobileApp.tsx` 中将 `<AppErrorBoundary>` 替换为 `<SentryErrorBoundary name="MobileApp">`
4. 删除两个文件中的内联 `AppErrorBoundary` 类定义
5. 为 lazy-load 的路由组件包裹额外的 Error Boundary：

```tsx
// App.tsx 中的改造示例
<Suspense fallback={<PageLoadingFallback />}>
  <SentryErrorBoundary name="MarketplacePage">
    <MarketplacePage />
  </SentryErrorBoundary>
</Suspense>
```

### 3.3 Fallback UI 设计原则

1. **信息透明度**：显示"出错了"而非技术细节（避免吓到用户），但提供可展开的技术信息供用户截图反馈
2. **可恢复性**：提供明确的恢复路径（刷新 / 回首页），而非让用户不知所措
3. **品牌一致性**：使用 Viben 的主题色和 UI 组件，而非浏览器默认样式
4. **开发环境差异化**：开发环境显示详细错误信息（componentStack），生产环境简洁展示

### 3.4 完整代码示例

```typescript
// src/components/sentry-error-boundary.tsx
import { Component, type ReactNode, type ErrorInfo } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SentryErrorBoundaryProps {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface SentryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class SentryErrorBoundary extends Component<
  SentryErrorBoundaryProps,
  SentryErrorBoundaryState
> {
  constructor(props: SentryErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Pick<SentryErrorBoundaryState, "hasError" | "error"> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const boundaryName = this.props.name || "SentryErrorBoundary";

    // 1. 上报到 Sentry
    Sentry.withScope((scope) => {
      scope.setTag("boundary", boundaryName);
      scope.setExtra("componentStack", errorInfo.componentStack || "N/A");
      Sentry.captureException(error);
    });

    // 2. 开发环境保留 console.error 便于调试
    if (import.meta.env.DEV) {
      console.error(
        `[SentryErrorBoundary:${boundaryName}] React rendering error`,
        error,
        errorInfo,
      );
    }

    // 3. 触发外部回调（如上报 Analytics 事件）
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 自定义 fallback
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.state.error!, this.handleReset);
        }
        return this.props.fallback;
      }

      // 默认 fallback UI
      return <DefaultFallbackUI
        error={this.state.error!}
        errorInfo={this.state.errorInfo}
        showDetails={this.state.showDetails}
        boundaryName={this.props.name}
        onToggleDetails={() =>
          this.setState((s) => ({ showDetails: !s.showDetails }))
        }
        onReload={this.handleReload}
        onGoHome={this.handleGoHome}
      />;
    }

    return this.props.children;
  }
}

/** 默认 Fallback UI（使用 i18n 文本） */
function DefaultFallbackUI({
  error,
  errorInfo,
  showDetails,
  boundaryName,
  onToggleDetails,
  onReload,
  onGoHome,
}: {
  error: Error;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  boundaryName?: string;
  onToggleDetails: () => void;
  onReload: () => void;
  onGoHome: () => void;
}) {
  // 注意：Error Boundary 内部不能使用 hooks（class 组件限制）
  // 可以通过 render prop 或 context 获取 i18n
  const title = "页面出了点问题";
  const description = "应用遇到了意外错误，请尝试刷新页面。";
  const reloadText = "刷新页面";
  const homeText = "返回首页";
  const detailsText = "错误详情";

  const isDev = false; // 生产环境始终为 false
  // import.meta.env.DEV 在 Error Boundary 中也可用
  // 实际使用时替换为 import.meta.env.DEV

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="w-full max-w-md text-center">
        {/* 图标 */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        {/* 标题 */}
        <h1 className="mb-2 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{description}</p>

        {/* 操作按钮 */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onReload}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {reloadText}
          </button>
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface/80 transition-colors"
          >
            <Home className="h-4 w-4" />
            {homeText}
          </button>
        </div>

        {/* 错误详情（可展开） */}
        <div className="mt-6">
          <button
            onClick={onToggleDetails}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {detailsText}
          </button>
          {showDetails && (
            <div className="mt-3 rounded-md border border-border bg-surface p-4 text-left">
              {boundaryName && (
                <p className="mb-1 text-xs text-muted-foreground">
                  Boundary: {boundaryName}
                </p>
              )}
              <p className="mb-2 text-sm text-foreground font-mono break-all">
                {error.message}
              </p>
              {errorInfo?.componentStack && (
                <pre className="max-h-48 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {errorInfo.componentStack}
                </pre>
              )}
              {/* 显示 Sentry Event ID 供用户反馈时引用 */}
              {typeof Sentry.lastEventId === "function" && Sentry.lastEventId() && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Event ID: {Sentry.lastEventId()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 四、全局错误处理

### 4.1 window.onerror 配置

捕获未被 Error Boundary 覆盖的错误（如事件处理器中的异步错误）：

```typescript
// src/lib/sentry-global-handlers.ts

/**
 * 注册全局错误处理器
 * 应在 main.tsx 的 Sentry 初始化之后立即调用
 */
export function registerGlobalErrorHandlers(): void {
  // ── 1. 全局同步错误 ──────────────────────
  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (error) {
      Sentry.captureException(error, {
        tags: { error_type: "window_onerror" },
        extra: {
          message: String(message),
          source,
          lineno,
          colno,
        },
      });
    }
    // 调用之前的处理器（如果有）
    if (prevOnError) {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // ── 2. 未处理的 Promise 拒绝 ──────────────
  const prevUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    Sentry.captureException(event.reason, {
      tags: { error_type: "unhandledrejection" },
      extra: {
        promise: String(event.promise),
      },
    });
    // 调用之前的处理器
    if (prevUnhandledRejection) {
      return prevUnhandledRejection.call(window, event);
    }
  };
}
```

### 4.2 unhandledrejection 配置

已包含在上方 `registerGlobalErrorHandlers()` 函数中。额外注意：

- `event.reason` 可能不是 `Error` 对象（如 `Promise.reject("string")`），需确保 Sentry 能处理
- 已在 `ignoreErrors` 中配置了 `AbortError` 和用户取消类错误，不会被上报

### 4.3 Tauri 进程 crash 监听方案

通过 Tauri Event System 监听 Rust 后端的异常事件：

```typescript
// src/lib/sentry-tauri-listener.ts
import { listen } from "@tauri-apps/api/event";
import * as Sentry from "@sentry/react";

/**
 * 注册 Tauri 进程级别的崩溃监听
 * 使用 Tauri 的 event system 接收后端发送的崩溃事件
 */
export async function registerTauriCrashListener(): Promise<void> {
  try {
    // 监听 Rust 后端未处理的 panic（需 Rust 端配合实现）
    await listen<{ message: string; location: string }>(
      "tauri://process-error",
      (event) => {
        Sentry.captureMessage(
          `[Tauri Process Error] ${event.payload.message}`,
          {
            level: "fatal",
            tags: {
              error_type: "tauri_process_error",
              location: event.payload.location,
            },
          },
        );
      },
    );

    // 监听 Tauri WebView 加载失败
    await listen<{ url: string; error: string }>(
      "tauri://webview-error",
      (event) => {
        Sentry.captureMessage(
          `[WebView Load Error] ${event.payload.url}: ${event.payload.error}`,
          {
            level: "error",
            tags: { error_type: "webview_load_error" },
          },
        );
      },
    );

    // 监听子窗口崩溃事件
    await listen<{ windowLabel: string; error: string }>(
      "viben://window-crash",
      (event) => {
        Sentry.withScope((scope) => {
          scope.setTag("window_label", event.payload.windowLabel);
          scope.setTag("error_type", "subwindow_crash");
          Sentry.captureException(new Error(event.payload.error));
        });
      },
    );
  } catch (error) {
    // Tauri API 在非 Tauri 环境（如浏览器开发）中不可用
    if (import.meta.env.DEV) {
      console.warn("[sentry] Tauri crash listener not available (non-Tauri environment)");
    }
  }
}
```

**Rust 端配合实现**（参考）：

```rust
// src-tauri/src/main.rs 或相关模块
use tauri::Manager;

// 注册全局 panic hook，发生 panic 时向 WebView 发送事件
fn setup_panic_hook(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    std::panic::set_hook(Box::new(move |panic_info| {
        let message = panic_info.to_string();
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());

        // 尝试发送事件到 WebView（可能 WebView 也已崩溃）
        let _ = app_handle.emit("tauri://process-error", serde_json::json!({
            "message": message,
            "location": location,
        }));
    }));
}
```

### 4.4 初始化时机

在 `main.tsx` 等入口点，Sentry 应**在 React 渲染之前**初始化，以确保能捕获初始化阶段的错误：

```typescript
// src/main.tsx（修改后）
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import MobileApp from "./MobileApp";
import { Toaster } from "@/components/ui/toaster";

// ── Step 1: 初始化 Firebase（Analytics） ──
import "./lib/firebase";

// ── Step 2: 初始化 i18n ──
import "./i18n";

// ── Step 3: 初始化 Sentry（必须在 React 渲染之前） ──
import { initSentry } from "./lib/sentry";
initSentry();

// ── Step 4: 注册全局错误处理器 ──
import { registerGlobalErrorHandlers } from "./lib/sentry-global-handlers";
import { registerTauriCrashListener } from "./lib/sentry-tauri-listener";
registerGlobalErrorHandlers();
registerTauriCrashListener(); // 异步非阻塞

// ... 其余初始化代码 ...

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />      {/* 或根据路由判断渲染 MobileApp */}
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);
```

**初始化顺序**：`Firebase → i18n → Sentry → 全局处理器 → Tauri 监听器 → React 渲染`

---

## 五、Breadcrumbs 集成

### 5.1 路由变化 Breadcrumb

利用 `react-router-dom` 的 `useLocation` 或全局 history listener 记录路由变化：

```typescript
// src/lib/sentry-breadcrumbs.ts
import * as Sentry from "@sentry/react";
import type { Location } from "react-router-dom";

let previousPathname: string | null = null;

/**
 * 记录路由变化的 breadcrumb
 * 在 BrowserRouter 内部或外层组件中调用
 */
export function addRouteBreadcrumb(location: Location): void {
  const { pathname, search } = location;

  // 避免重复记录同一路由（React 严格模式下的 double-render）
  if (pathname === previousPathname) {
    return;
  }
  previousPathname = pathname;

  Sentry.addBreadcrumb({
    category: "navigation",
    message: `Navigate to ${pathname}${search}`,
    level: "info",
    data: {
      from: previousPathname || "/",
      to: pathname,
      search: search || undefined,
    },
  });
}

// 使用方式：在 AppLayout 或路由监听的组件中
// function RouteBreadcrumbTracker() {
//   const location = useLocation();
//   useEffect(() => {
//     addRouteBreadcrumb(location);
//   }, [location]);
//   return null;
// }
```

### 5.2 用户交互 Breadcrumb

记录关键按钮点击，通过 Sentry 的 `addBreadcrumb` 实现：

```typescript
/**
 * 记录用户关键交互的 breadcrumb
 * 用于在错误报告中还原用户操作路径
 */
export function addInteractionBreadcrumb(
  action: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: "user-interaction",
    message: action,
    level: "info",
    data,
  });
}

// 使用示例（在组件的事件处理器中）：
// onClick={() => {
//   addInteractionBreadcrumb("click_send_message", { session_id: sessionId });
//   handleSend();
// }}

// 关键交互点：
// - 发送聊天消息
// - 创建/删除任务（看板）
// - 安装/卸载 MCP 服务或技能
// - 切换工作区
// - 修改 Agent 配置
// - OAuth 登录/登出
```

### 5.3 HTTP 请求 Breadcrumb

利用 Sentry 对 `fetch` 和 `XMLHttpRequest` 的自动 instrumentation（`@sentry/react` 内置，`browserTracingIntegration` 已包含）。

如果需要更细粒度的控制或自定义 Gateway API 调用的 breadcrumb，可以：

```typescript
// 在 Gateway API Client 的请求拦截器中添加
// src/lib/api-client.ts 的扩展

import * as Sentry from "@sentry/react";

function onApiRequestStart(endpoint: string, method: string): void {
  Sentry.addBreadcrumb({
    category: "http",
    message: `${method} ${endpoint}`,
    level: "info",
    data: {
      method,
      url: endpoint,
    },
  });
}

function onApiRequestEnd(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number,
): void {
  Sentry.addBreadcrumb({
    category: "http",
    message: `${method} ${endpoint} — ${statusCode} (${durationMs}ms)`,
    level: statusCode >= 400 ? "error" : "info",
    data: {
      method,
      url: endpoint,
      status_code: statusCode,
      duration_ms: durationMs,
    },
  });
}
```

### 5.4 Console Breadcrumb

通过 Sentry 的 `beforeBreadcrumb` 配置在生产环境过滤 console breadcrumb：

**已在 2.5 节 `Sentry.init()` 中配置**：生产环境只保留 `console.error` 级别，开发和 CI 环境保留全部 console。

---

## 六、与 Firebase Analytics 的数据关联

### 6.1 通过 sentry_event_id 串联

在 Analytics 的异常事件中附加 Sentry Event ID，实现两者之间的数据串联：

```typescript
// src/lib/sentry-analytics-bridge.ts
import * as Sentry from "@sentry/react";
import { analytics } from "./firebase";
import { logEvent } from "firebase/analytics";

/**
 * 在 Sentry 错误被捕获时，同步上报 Analytics 异常事件
 * 携带 sentry_event_id 用于双向关联
 *
 * 调用时机：Error Boundary 的 componentDidCatch、全局错误处理器
 */
export function reportErrorToAnalytics(
  error: Error,
  context: {
    errorType: string;
    routePath?: string;
    componentStack?: string;
  },
): void {
  const sentryEventId = Sentry.lastEventId();
  if (!sentryEventId) {
    return;
  }

  // 上报 Analytics 异常事件（对应合成报告中的 app_error_boundary_triggered）
  logEvent(analytics, "exception", {
    // 标准 Firebase 异常参数
    error_type: context.errorType,
    error_message: error.message?.substring(0, 150), // 截断避免过长
    // 自定义参数
    sentry_event_id: sentryEventId,       // 关联 Sentry
    sentry_url: getSentryEventUrl(sentryEventId), // Sentry 事件直链
    route_path: context.routePath || window.location.pathname,
    component_stack: context.componentStack?.substring(0, 500),
    timestamp: Date.now(),
  });
}

/**
 * 生成 Sentry Event 的直链 URL
 * 可在 Analytics 控制台或内部工具中使用
 */
function getSentryEventUrl(eventId: string): string {
  // 格式: https://sentry.io/organizations/<org>/issues/<event_id>/
  const org = "viben"; // 替换为实际 Sentry org slug
  return `https://sentry.io/organizations/${org}/issues/?query=${eventId}`;
}
```

### 6.2 Analytics 异常事件参数建议

对应合成报告第 3.19 节（路径 19：错误恢复）的事件定义：

| Analytics 事件名 | 触发时机 | 关键参数 |
|-----------------|---------|---------|
| `app_error_boundary_triggered` | React Error Boundary 捕获渲染错误 | error_type, error_message, sentry_event_id, sentry_url, route_path, component_stack |
| `gateway_connection_lost` | Gateway WebSocket/HTTP 连接断开 | previous_status, disconnect_reason, sentry_event_id |
| `gateway_connection_restored` | Gateway 连接恢复 | outage_duration_ms, reconnect_attempts |
| `sse_connection_error` | SSE 事件流异常 | endpoint, error_type, reconnect_attempt |
| `api_call_failed` | Gateway API 调用失败 | endpoint, http_status, error_code, retry_count |
| `app_crashed` | Tauri 进程级崩溃 | crash_type, last_route, app_uptime_ms, sentry_event_id |

**注意**：部分事件（如 `gateway_connection_lost`）可能是 Sentry 的 breadcrumb 而非独立的 error event，在 Analytics 中应作为独立事件上报。

---

## 七、隐私与采样率

### 7.1 错误采样率

| 环境 | sampleRate | 说明 |
|------|-----------|------|
| production | 1.0 (100%) | 全量捕获，不丢失任何错误 |
| development | N/A | 无 DSN 不初始化 |

全量采样的理由：错误数量本身远小于性能事件，采样带来的成本节省微乎其微，但丢失关键错误的风险极高。

### 7.2 性能采样率

| 环境 | tracesSampleRate | 说明 |
|------|-----------------|------|
| production | 0.1 (10%) | 10% 采样，平衡可观测性和成本 |

性能追踪（distributed tracing）仅在需要排查性能问题时才有价值，10% 采样足以发现趋势性问题。

### 7.3 PII 数据清洗规则

| 数据类别 | 处理方式 | 实现位置 |
|---------|---------|---------|
| **用户认证信息** | 完全剥离 | `sanitizeEvent()` 中的 headers 过滤 |
| API Key / Token | 完全剥离 | `sanitizeEvent()` 中的 headers 过滤 + URL params 过滤 |
| Cookie | 完全剥离 | `sanitizeEvent()` 中的 headers 过滤 |
| 工作区路径 | 完全剥离 | `sanitizeEvent()` 中的 extras 过滤 |
| 文件路径 | 完全剥离 | `sanitizeEvent()` 中的 extras 过滤 |
| 用户邮箱/用户名 | 从不设置 | 仅用匿名 ID (`crypto.randomUUID()`) 标识用户 |
| IP 地址 | 默认不收集 | Sentry SDK 默认 `sendDefaultPii: false` |
| 聊天消息内容 | 不附加到 scope | Error capture 时不附带用户消息文本 |
| 网页 URL | 清理查询参数 | `sanitizeEvent()` 中移除敏感 query params |
| Console 输出 | 仅 error 级别 | `beforeBreadcrumb` 过滤 |
| 堆栈跟踪 | 保留（含 source map） | 堆栈信息不含 PII，可安全上报 |

**绝对禁止**在 Sentry 中收集的内容：
- 用户聊天消息内容
- 用户代码中的敏感变量值
- API 请求/响应的完整 body
- 任何形式的认证凭证

---

## 八、实施检查清单

### Phase 1：基础设施搭建

- [ ] 1.1 安装 `@sentry/react` 依赖包
- [ ] 1.2 创建 `src/lib/sentry.ts`（Sentry 初始化模块）
- [ ] 1.3 创建 `src/lib/sentry-global-handlers.ts`（全局错误处理器）
- [ ] 1.4 创建 `src/lib/sentry-tauri-listener.ts`（Tauri 崩溃监听）
- [ ] 1.5 创建 `src/lib/sentry-breadcrumbs.ts`（Breadcrumbs 工具函数）
- [ ] 1.6 创建 `src/lib/sentry-analytics-bridge.ts`（Sentry-Analytics 桥接）
- [ ] 1.7 在 `src/main.tsx` 中按正确顺序集成初始化流程
- [ ] 1.8 在 CI/GitHub Actions 中配置 `VITE_SENTRY_DSN` secret
- [ ] 1.9 配置 Sentry 项目的 source map 上传（Vite plugin 或 sentry-cli）

### Phase 2：Error Boundary 替换

- [ ] 2.1 创建 `src/components/sentry-error-boundary.tsx`
- [ ] 2.2 在 `App.tsx` 中替换内联 `AppErrorBoundary` → `<SentryErrorBoundary name="App">`
- [ ] 2.3 在 `MobileApp.tsx` 中替换内联 `AppErrorBoundary` → `<SentryErrorBoundary name="MobileApp">`
- [ ] 2.4 为 lazy-load 路由页面添加独立的 Error Boundary 保护
- [ ] 2.5 验证开发环境下 Error Boundary 行为正常（显示详情）
- [ ] 2.6 验证生产构建下 Error Boundary fallback UI 正确

### Phase 3：Breadcrumbs 集成

- [ ] 3.1 实现 `RouteBreadcrumbTracker` 组件并集成到 AppLayout
- [ ] 3.2 在关键交互点添加 `addInteractionBreadcrumb` 调用
  - [ ] 聊天消息发送
  - [ ] 看板任务创建/编辑/删除
  - [ ] Agent 配置修改
  - [ ] MCP/技能安装
  - [ ] OAuth 登录
- [ ] 3.3 在 Gateway API Client 中集成 HTTP breadcrumb
- [ ] 3.4 验证生产环境 console breadcrumb 仅记录 error 级别

### Phase 4：Analytics 关联

- [ ] 4.1 在 `SentryErrorBoundary` 的 `componentDidCatch` 中调用 `reportErrorToAnalytics`
- [ ] 4.2 在 Tauri crash listener 中调用 `reportErrorToAnalytics`
- [ ] 4.3 注册 `exception` 事件的自定义参数到 Firebase Analytics
- [ ] 4.4 验证 Analytics 控制台中能看到 `sentry_event_id` 参数

### Phase 5：Tauri/Rust 后端配合

- [ ] 5.1 在 Rust 端实现 `setup_panic_hook()` 并发送 `tauri://process-error` 事件
- [ ] 5.2 在 Rust 端实现 `get_machine_id` Tauri Command（返回 SHA-256 hash）
- [ ] 5.3 测试模拟 Rust 端 panic 时 WebView 能否收到事件

### Phase 6：验证与监控

- [ ] 6.1 在开发环境手动触发错误，验证 Sentry 控制台收到事件
- [ ] 6.2 验证 `environment` 标签正确（development / production）
- [ ] 6.3 验证 `release` 标签与 `package.json` version 一致
- [ ] 6.4 验证 PII 过滤器正确工作（无敏感 headers、无路径信息）
- [ ] 6.5 验证 source map 正确映射（错误堆栈可读）
- [ ] 6.6 建立 Sentry 告警规则（error rate 突增通知）
- [ ] 6.7 配置 Sentry Issue 的自动分配规则

### Phase 7：文档与维护

- [ ] 7.1 在项目 CLAUDE.md 或开发文档中记录 Sentry 集成方式
- [ ] 7.2 记录如何在开发环境中启用 Sentry 调试
- [ ] 7.3 记录 Sentry 项目的组织结构和 access 权限
- [ ] 7.4 建立 Sentry 周报/月报机制（关键错误趋势）
