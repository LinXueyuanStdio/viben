/**
 * 日志采样策略
 *
 * 用于高频日志场景的流量控制，支持：
 * - 基于消息模式匹配的采样率
 * - 同类日志的最小输出间隔
 * - 采样状态追踪
 */

/**
 * 采样规则定义
 */
export interface SamplingRule {
  /** 匹配条件：模块名或消息模式 */
  match: string | RegExp;
  /** 采样率：0.0-1.0，1.0 = 全部保留 */
  rate: number;
  /** 最小间隔（毫秒）：同类日志的最小输出间隔 */
  minIntervalMs?: number;
}

/**
 * 默认采样规则
 *
 * 针对常见高频日志场景的预设规则
 */
export const DEFAULT_SAMPLING_RULES: SamplingRule[] = [
  // 心跳日志：每 60 秒最多 1 条
  { match: /heartbeat|ping|health/i, rate: 0.1, minIntervalMs: 60000 },
  // 轮询日志：10% 采样
  { match: /polling|poll/i, rate: 0.1 },
  // WebSocket 消息：高频场景 20% 采样
  { match: "ws:message", rate: 0.2 },
  // 错误日志：永远不采样
  { match: /error|fatal/i, rate: 1.0 },
];

/**
 * 采样状态信息
 */
interface SamplingState {
  /** 上次采样通过的时间 */
  lastTime: number;
  /** 自上次采样通过以来被抑制的日志数量 */
  suppressedCount: number;
}

/**
 * 采样状态追踪
 * 记录每个规则的最后采样时间和抑制计数
 */
const samplingState = new Map<string, SamplingState>();

/**
 * 采样结果
 */
export interface SamplingResult {
  /** 是否通过采样（true = 应该输出） */
  sampled: boolean;
  /** 匹配的规则（如果有） */
  rule?: SamplingRule;
  /** 自上次采样通过以来被抑制的日志数量 */
  suppressed?: number;
}

/**
 * 判断消息是否应该被采样输出
 *
 * @param message - 日志消息
 * @param rules - 采样规则列表（默认使用 DEFAULT_SAMPLING_RULES）
 * @returns 采样结果
 *
 * @example
 * ```typescript
 * const result = shouldSample('heartbeat check');
 * if (result.sampled) {
 *   logger.info('heartbeat check', { suppressed: result.suppressed });
 * }
 * ```
 */
export function shouldSample(
  message: string,
  rules: SamplingRule[] = DEFAULT_SAMPLING_RULES
): SamplingResult {
  for (const rule of rules) {
    const matches =
      typeof rule.match === "string"
        ? message.includes(rule.match)
        : rule.match.test(message);

    if (matches) {
      const key = rule.match.toString();
      const state = samplingState.get(key) || {
        lastTime: 0,
        suppressedCount: 0,
      };
      const now = Date.now();

      // 时间间隔检查
      if (rule.minIntervalMs && now - state.lastTime < rule.minIntervalMs) {
        state.suppressedCount++;
        samplingState.set(key, state);
        return { sampled: false, rule, suppressed: state.suppressedCount };
      }

      // 采样率检查
      if (Math.random() > rule.rate) {
        state.suppressedCount++;
        samplingState.set(key, state);
        return { sampled: false, rule, suppressed: state.suppressedCount };
      }

      // 通过采样
      const suppressed = state.suppressedCount;
      samplingState.set(key, { lastTime: now, suppressedCount: 0 });
      return { sampled: true, rule, suppressed };
    }
  }

  // 无匹配规则，默认保留
  return { sampled: true };
}

/**
 * 重置采样状态
 *
 * 主要用于测试，清除所有采样状态记录
 */
export function resetSamplingState(): void {
  samplingState.clear();
}

/**
 * 获取当前采样状态快照
 *
 * 用于调试和监控
 *
 * @returns 当前所有规则的采样状态
 */
export function getSamplingStateSnapshot(): Map<string, SamplingState> {
  return new Map(samplingState);
}
