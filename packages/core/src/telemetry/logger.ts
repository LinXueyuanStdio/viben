/**
 * 结构化日志记录器
 *
 * 基于 pino 实现，输出到 JSONL 文件
 * 支持：
 * - 敏感信息自动脱敏 (redact)
 * - Trace Context 自动注入 (mixin)
 * - 全局单例管理 (setGlobalLogger)
 */
import pino from "pino";
import * as fs from "fs";
import * as path from "path";
import type { TelemetryConfig } from "./types";
import { createRedactConfig } from "./redact";
import { traceContextMixin } from "./context";
import { setGlobalLogger } from "./global-logger";

/**
 * Logger interface that supports both pino and console fallback
 *
 * Pino logger has complex overloaded signatures. This interface provides
 * a simplified but compatible signature that works with both the actual
 * pino logger and the console fallback.
 */
export interface Logger {
  level: string;
  silent(msg: string, ...args: unknown[]): void;
  silent(obj: object, msg?: string, ...args: unknown[]): void;
  trace(msg: string, ...args: unknown[]): void;
  trace(obj: object, msg?: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  debug(obj: object, msg?: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  info(obj: object, msg?: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  warn(obj: object, msg?: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  error(obj: object, msg?: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
  fatal(obj: object, msg?: string, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
  flush(): void;
  bindings(): Record<string, unknown>;
  isLevelEnabled(level: string): boolean;
}

/**
 * Full pino.Logger type for cases where you need the complete pino interface
 */
export type PinoLogger = pino.Logger;

/**
 * Redact 配置选项类型
 */
type RedactOptions = NonNullable<TelemetryConfig["log"]>["redact"];

/**
 * 构建 Pino redact 配置
 *
 * @param redactOptions - 用户配置的脱敏选项
 * @returns Pino redact 配置对象
 */
function buildRedactConfig(redactOptions?: RedactOptions) {
  const redactConfig = createRedactConfig({
    mode: redactOptions?.censor ?? "partial",
    additionalPaths: redactOptions?.paths,
  });
  return redactConfig;
}

/**
 * 创建日志记录器
 *
 * 功能：
 * - 输出到 JSONL 文件
 * - 敏感信息自动脱敏
 * - Trace Context 自动注入
 * - 自动设置为全局 logger
 */
export function createLogger(config: TelemetryConfig): Logger {
  const logsDir = path.join(config.baseDir, "logs");

  // 确保目录存在
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {
    // 忽略目录已存在的错误
  }

  const date = new Date().toISOString().split("T")[0];
  const logFile = path.join(logsDir, `${date}.jsonl`);

  const logger = pino(
    {
      level: config.log?.level || process.env.LOG_LEVEL || "info",
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        service: config.serviceName,
        version: config.serviceVersion,
      },
      // 敏感信息脱敏
      redact: buildRedactConfig(config.log?.redact),
      // Trace Context 自动注入
      mixin: traceContextMixin,
    },
    pino.destination({
      dest: logFile,
      sync: false,
      mkdir: true,
    })
  );

  // 设置为全局 logger
  setGlobalLogger(logger);

  return logger;
}

/**
 * 创建控制台 + 文件双输出日志记录器
 *
 * 功能：
 * - 同时输出到 JSONL 文件和控制台
 * - 敏感信息自动脱敏
 * - Trace Context 自动注入
 * - 自动设置为全局 logger
 */
export function createDualLogger(config: TelemetryConfig): Logger {
  const logsDir = path.join(config.baseDir, "logs");

  // 确保目录存在
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {
    // 忽略目录已存在的错误
  }

  const date = new Date().toISOString().split("T")[0];
  const logFile = path.join(logsDir, `${date}.jsonl`);

  // 使用 multistream 同时输出到文件和控制台
  const streams = [
    // 文件流 (JSON 格式)
    {
      stream: pino.destination({
        dest: logFile,
        sync: false,
        mkdir: true,
      }),
    },
    // 控制台流 (开发环境)
    ...(process.env.NODE_ENV !== "production"
      ? [{ stream: process.stdout }]
      : []),
  ];

  const logger = pino(
    {
      level: config.log?.level || process.env.LOG_LEVEL || "info",
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        service: config.serviceName,
        version: config.serviceVersion,
      },
      // 敏感信息脱敏
      redact: buildRedactConfig(config.log?.redact),
      // Trace Context 自动注入
      mixin: traceContextMixin,
    },
    pino.multistream(streams)
  );

  // 设置为全局 logger
  setGlobalLogger(logger);

  return logger;
}

/**
 * 创建仅控制台日志记录器（用于开发）
 *
 * 功能：
 * - 使用 pino-pretty 美化输出
 * - 敏感信息自动脱敏
 * - Trace Context 自动注入
 * - 自动设置为全局 logger
 */
export function createConsoleLogger(config: TelemetryConfig): Logger {
  const logger = pino({
    level: config.log?.level || process.env.LOG_LEVEL || "debug",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
    base: {
      service: config.serviceName,
    },
    // 敏感信息脱敏
    redact: buildRedactConfig(config.log?.redact),
    // Trace Context 自动注入
    mixin: traceContextMixin,
  });

  // 设置为全局 logger
  setGlobalLogger(logger);

  return logger;
}

/**
 * 子日志记录器
 * 为特定模块创建带上下文的子 logger
 */
export function createChildLogger(
  parent: Logger,
  context: Record<string, unknown>
): Logger {
  return parent.child(context);
}
