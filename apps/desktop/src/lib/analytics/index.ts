/**
 * Analytics 公共 API
 *
 * 应用入口点通过此模块注册和初始化 Provider。
 * 业务组件通过此模块获取 hooks 和 ErrorBoundary。
 */

export type { AnalyticsProvider } from "./provider";

// Provider 实现
export { FirebaseAnalyticsProvider } from "./providers/firebase";
export type { FirebaseConfig } from "./providers/firebase";
export { VolcengineAnalyticsProvider } from "./providers/volcengine";
export type { VolcengineConfig } from "./providers/volcengine";

// 工厂
export {
  registerAnalyticsProvider,
  initAnalytics,
  switchProvider,
} from "./factory";

// React 集成
export { AnalyticsContextProvider } from "./context";
export { useAnalytics, usePageViewTracking } from "./hooks";

// 事件定义
export { AnalyticsEvents } from "./types";
export type * from "./types";

// 错误边界（通过 Analytics Provider 上报错误）
export { ErrorBoundary } from "./error-boundary";
export type { ErrorBoundaryProps } from "./error-boundary";
