/**
 * Analytics Provider 接口
 *
 * 所有分析后端（Firebase、火山引擎等）必须实现此接口。
 * 业务代码不直接依赖此接口——通过 factory 获取单例，通过 hooks 调用。
 */

export interface AnalyticsProvider {
  /** Provider 唯一标识，用于日志和调试 */
  readonly name: string;

  /**
   * 初始化 Provider。
   * 在应用启动时调用一次。
   * @param config - Provider 特定配置，由各 Provider 自行解析
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * 上报事件。
   * @param eventName - 事件名（使用 types.ts 中的 AnalyticsEvents 常量）
   * @param params   - 事件参数对象（snake_case key）
   */
  logEvent(eventName: string, params?: Record<string, unknown>): void;

  /**
   * 设置用户属性（用于用户分群、漏斗分析）。
   * 属性在整个 session 中持久保留，多次调用会合并。
   */
  setUserProperties(properties: Record<string, unknown>): void;

  /**
   * 设置用户标识。
   * @param userId - 匿名化的用户 ID；传 null 表示登出
   */
  setUserId(userId: string | null): void;

  /**
   * 设置当前屏幕名称（用于页面浏览分析）。
   * 通常在路由切换时调用。
   */
  setScreenName(screenName: string): void;

  /**
   * 刷新缓冲区，确保事件被发送。
   * 在应用即将关闭/进入后台时调用。
   */
  flush(): Promise<void>;
}
