/**
 * ErrorBoundary 组件
 *
 * 统一的 React Error Boundary，替代 App.tsx 和 MobileApp.tsx 中的重复实现。
 * 捕获子组件渲染错误后：
 * 1. 上报到 Analytics Provider（Firebase/火山引擎统一通道）
 * 2. 显示符合 Viben 设计规范的 fallback UI
 *
 * 火山引擎 @apmplus/web 会自动采集未捕获的 JS 异常（JsErrorReport），
 * ErrorBoundary 捕获的是被 React 拦住的渲染错误，二者互补。
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { getProvider } from "./factory";
import { AnalyticsEvents } from "./types";

export interface ErrorBoundaryProps {
  children: ReactNode;

  /** 错误边界名称，用于在错误日志中区分不同的边界实例 */
  name?: string;

  /** 自定义 fallback UI */
  fallback?: ReactNode;

  /** 错误恢复回调（点击"重试"时调用） */
  onRecover?: () => void;

  /** 是否显示错误详情（开发环境默认开启） */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 通过 Analytics Provider 上报（Firebase、火山引擎等统一通道）
    try {
      getProvider().logEvent(AnalyticsEvents.APP_ERROR_BOUNDARY_TRIGGERED, {
        error_type: error.name || "Error",
        error_message: error.message?.slice(0, 200) || "Unknown error",
        error_boundary: this.props.name || "unknown",
        has_component_stack: !!errorInfo.componentStack,
      });
    } catch {
      // Analytics 未初始化时静默失败
    }

    // 开发环境打印完整堆栈
    if (import.meta.env.DEV) {
      console.error(
        `[ErrorBoundary:${this.props.name || "unknown"}]`,
        error,
        errorInfo.componentStack,
      );
    }
  }

  handleRecover = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRecover?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/workspace";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error } = this.state;
      const showDetails = this.props.showDetails ?? import.meta.env.DEV;

      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground p-4">
          <div className="text-center max-w-md">
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </div>

            <h1 className="text-xl font-bold mb-2">页面出现错误</h1>

            <p className="text-sm text-muted-foreground mb-2">
              {error?.message || "未知错误"}
            </p>

            {showDetails && error?.stack && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  查看堆栈
                </summary>
                <pre className="mt-2 p-2 bg-secondary/50 rounded text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                刷新页面
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Home className="w-4 h-4" />
                回到工作区
              </button>
            </div>

            {this.props.onRecover && (
              <button
                onClick={this.handleRecover}
                className="mt-3 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                重试
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
