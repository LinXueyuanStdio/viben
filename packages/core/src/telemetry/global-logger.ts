/**
 * 全局 Logger 单例管理
 *
 * 提供全局统一的 Logger 实例，支持：
 * - 未初始化时使用 console fallback
 * - 初始化后使用 Pino Logger
 * - 模块级 child logger
 */
import type { Logger } from "./logger";

/**
 * 全局 Logger 实例
 */
let globalLogger: Logger | null = null;

/**
 * 创建 console fallback 的日志方法
 */
function createLogMethod(
  level: string,
  prefix: string,
  consoleMethod: (...args: unknown[]) => void,
  checkEnabled: () => boolean
) {
  return function logMethod(objOrMsg: unknown, ...args: unknown[]): void {
    if (!checkEnabled()) return;

    if (typeof objOrMsg === "string") {
      // logger.info("message") 或 logger.info("message", arg1, arg2)
      consoleMethod(`${prefix}${objOrMsg}`, ...args);
    } else {
      // logger.info({ key: value }, "message")
      const msg = args[0];
      consoleMethod(`${prefix}${msg ?? ""}`, objOrMsg, ...args.slice(1));
    }
  };
}

/**
 * 创建 console fallback Logger
 *
 * @param contextPrefix - 上下文前缀（用于 child logger）
 */
function createConsoleFallback(contextPrefix = ""): Logger {
  const prefix = contextPrefix ? `${contextPrefix} ` : "";
  const currentLevel = () => process.env.LOG_LEVEL || "info";
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"];

  const isLevelEnabled = (level: string): boolean => {
    return levels.indexOf(level) >= levels.indexOf(currentLevel());
  };

  const fallback = {
    level: "info",
    silent: (_objOrMsg: unknown, ..._args: unknown[]) => {},
    trace: createLogMethod("[TRACE] ", prefix, console.debug, () =>
      isLevelEnabled("trace")
    ),
    debug: createLogMethod("[DEBUG] ", prefix, console.debug, () =>
      isLevelEnabled("debug")
    ),
    info: createLogMethod("[INFO] ", prefix, console.info, () =>
      isLevelEnabled("info")
    ),
    warn: createLogMethod("[WARN] ", prefix, console.warn, () =>
      isLevelEnabled("warn")
    ),
    error: createLogMethod("[ERROR] ", prefix, console.error, () =>
      isLevelEnabled("error")
    ),
    fatal: createLogMethod("[FATAL] ", prefix, console.error, () =>
      isLevelEnabled("fatal")
    ),
    child: (bindings: Record<string, unknown>): Logger => {
      // 构建新的 prefix
      const newPrefix = bindings.module
        ? `[${bindings.module}]`
        : Object.keys(bindings).length > 0
          ? `[${JSON.stringify(bindings)}]`
          : "";
      return createConsoleFallback(`${contextPrefix}${newPrefix}`);
    },
    flush: () => {},
    // Pino 兼容属性
    bindings: () => ({}),
    isLevelEnabled,
  };

  return fallback as unknown as Logger;
}

/**
 * Console fallback Logger 实例
 */
const consoleFallback = createConsoleFallback();

/**
 * 设置全局 Logger 实例
 *
 * 应在 initTelemetry 中调用
 *
 * @param instance - Pino Logger 实例
 */
export function setGlobalLogger(instance: Logger): void {
  globalLogger = instance;
}

/**
 * 获取全局 Logger 实例
 *
 * 如果未初始化，返回 console fallback
 *
 * @returns Logger 实例
 *
 * @example
 * ```typescript
 * import { getLogger } from '@viben/core/telemetry';
 *
 * const logger = getLogger();
 * logger.info('Hello, world!');
 * ```
 */
export function getLogger(): Logger {
  return globalLogger ?? consoleFallback;
}

/**
 * 检查全局 Logger 是否已初始化
 *
 * @returns true 如果已设置全局 Logger
 */
export function isLoggerInitialized(): boolean {
  return globalLogger !== null;
}

/**
 * 重置全局 Logger（仅用于测试）
 *
 * @internal
 */
export function resetGlobalLogger(): void {
  globalLogger = null;
}

/**
 * 全局 Logger 便捷访问
 *
 * 使用 Proxy 实现延迟绑定，确保始终使用最新的全局实例
 *
 * @example
 * ```typescript
 * import { logger } from '@viben/core/telemetry';
 *
 * // 直接使用，无需先获取
 * logger.info({ userId: '123' }, 'User logged in');
 *
 * // 创建模块级 child logger
 * const log = logger.child({ module: 'gateway' });
 * log.info('Gateway started');
 * ```
 */
export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop: keyof Logger) {
    const instance = getLogger();
    const value = instance[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
