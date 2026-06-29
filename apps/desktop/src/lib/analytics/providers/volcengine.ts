/**
 * 火山引擎 Analytics Provider
 *
 * 实现 AnalyticsProvider 接口，封装 @apmplus/web SDK。
 * 业务代码不直接使用此类——通过工厂注册后，使用 useAnalytics() hook。
 *
 * SDK 文档: https://www.volcengine.com/docs/6431/104864
 */

import type { AnalyticsProvider } from "../provider";

/** 火山引擎初始化配置 */
export interface VolcengineConfig {
  /** 应用唯一标识（AppID），number 类型 */
  aid: number;
  /** 应用 Token（AppToken） */
  token: string;
  /** 应用版本号 */
  appVersion?: string;
  /** 环境标识 */
  environment?: "production" | "development" | "testing";
}

/**
 * 火山引擎分析服务 Provider。
 *
 * 使用 @apmplus/web SDK 的 sendEvent/sendLog 方法上报事件。
 * 参数自动拆分为 categories（字符串值）和 metrics（数值）。
 */
export class VolcengineAnalyticsProvider implements AnalyticsProvider {
  readonly name = "volcengine";

  private client: VolcengineCommandClient | null = null;
  private initialized = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const volcConfig = config as unknown as VolcengineConfig;

    if (!volcConfig.aid || !volcConfig.token) {
      throw new Error(
        "[analytics:volcengine] aid 和 token 是必填参数，请检查配置",
      );
    }

    try {
      // 动态导入 SDK（@apmplus/web 是可选依赖，仅在 volcengine provider 使用时加载）
      const module = await import("@apmplus/web");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const browserClient: VolcengineCommandClient = module.default as any;

      // 初始化
      browserClient("init", {
        aid: volcConfig.aid,
        token: volcConfig.token,
        ...(volcConfig.appVersion && { release: volcConfig.appVersion }),
        ...(volcConfig.environment && { env: volcConfig.environment }),
      });

      // 开启上报
      browserClient("start");

      this.client = browserClient;
      this.initialized = true;

      if (import.meta.env.DEV) {
        console.log("[analytics] 火山引擎初始化完成", {
          aid: volcConfig.aid,
          environment: volcConfig.environment || "production",
        });
      }
    } catch (error) {
      console.error("[analytics:volcengine] SDK 初始化失败:", error);
      throw error;
    }
  }

  logEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!this.client || !this.initialized) {
      if (import.meta.env.DEV) {
        console.warn(
          "[analytics:volcengine] 未初始化，跳过事件:",
          eventName,
        );
      }
      return;
    }

    try {
      // 拆分参数：字符串 → categories（维度），数字 → metrics（指标）
      const categories: Record<string, string> = {};
      const metrics: Record<string, number> = {};

      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value === null || value === undefined) continue;
          if (typeof value === "number") {
            metrics[key] = value;
          } else if (typeof value === "boolean") {
            categories[key] = String(value);
          } else {
            categories[key] = String(value);
          }
        }
      }

      // 使用 sendEvent 上报自定义事件
      this.client("sendEvent", {
        name: eventName,
        ...(Object.keys(metrics).length > 0 && { metrics }),
        ...(Object.keys(categories).length > 0 && { categories }),
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[analytics:volcengine] 事件上报失败:",
          eventName,
          error,
        );
      }
    }
  }

  setUserId(userId: string | null): void {
    if (!this.client || !this.initialized) return;

    try {
      this.client("config", {
        userId: userId || undefined,
      });
    } catch {
      // 静默失败
    }
  }

  setUserProperties(properties: Record<string, unknown>): void {
    if (!this.client || !this.initialized) return;

    try {
      // 火山引擎通过 config 设置全局上下文
      this.client("config", {
        context: properties as Record<string, string | number | undefined>,
      });
    } catch {
      // 静默失败
    }
  }

  setScreenName(screenName: string): void {
    // 火山引擎自动采集 pageview，此处补充自定义事件作为冗余
    this.logEvent("page_view", {
      page_name: screenName,
      page_path: window.location.pathname,
    });
  }

  async flush(): Promise<void> {
    // 火山引擎 SDK 自动批量发送，无需手动 flush
  }
}

/**
 * 火山引擎 BrowserCommandClient 类型（精简版）。
 *
 * @apmplus/web 默认导出一个 command-style 函数：
 *   browserClient('init', config)  // 初始化
 *   browserClient('start')         // 开启上报
 *   browserClient('sendEvent', { name, metrics, categories })  // 上报自定义事件
 *   browserClient('config', { userId, ... })  // 更新配置
 *
 * 同时支持 method-style 调用（与 command-style 等价）：
 *   browserClient.init(config)
 *   browserClient.start()
 */
interface VolcengineCommandClient {
  // Command-style（函数调用）
  (command: "init", config: Record<string, unknown>): void;
  (command: "start"): void;
  (command: "config", config: Record<string, unknown>): void;
  (
    command: "sendEvent",
    data: {
      name: string;
      metrics?: Record<string, number>;
      categories?: Record<string, string>;
    },
  ): void;
  (
    command: "sendLog",
    data: {
      content: string;
      level?: string;
      extra?: Record<string, number | string>;
    },
  ): void;

  // Method-style（向后兼容）
  init: (config: Record<string, unknown>) => void;
  start: () => void;
  config: (config: Record<string, unknown>) => void;
  sendEvent: (data: {
    name: string;
    metrics?: Record<string, number>;
    categories?: Record<string, string>;
  }) => void;
  sendLog: (data: {
    content: string;
    level?: string;
    extra?: Record<string, number | string>;
  }) => void;
  destroy: () => void;
}
