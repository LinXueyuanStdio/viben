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
    if (shouldAbort?.()) {
      return { success: false, reason: "aborted", attempts };
    }

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

    const nextInterval = Math.min(currentInterval * backoffFactor, maxIntervalMs);
    onAttempt?.(attempts, nextInterval);
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
