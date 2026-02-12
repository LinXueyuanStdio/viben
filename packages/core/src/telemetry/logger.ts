/**
 * 结构化日志记录器
 *
 * 基于 pino 实现，输出到 JSONL 文件
 */
import pino from "pino";
import * as fs from "fs";
import * as path from "path";
import type { TelemetryConfig } from "./types";

export type Logger = pino.Logger;

/**
 * 创建日志记录器
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

  return pino(
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
    },
    pino.destination({
      dest: logFile,
      sync: false,
      mkdir: true,
    })
  );
}

/**
 * 创建控制台 + 文件双输出日志记录器
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

  return pino(
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
    },
    pino.multistream(streams)
  );
}

/**
 * 创建仅控制台日志记录器（用于开发）
 */
export function createConsoleLogger(config: TelemetryConfig): Logger {
  return pino({
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
  });
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
