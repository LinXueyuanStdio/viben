/**
 * 敏感信息脱敏配置
 *
 * 使用 Pino 内置的 redact 功能实现自动脱敏
 */

/**
 * 需要脱敏的字段路径列表
 *
 * 支持：
 * - 简单字段名：apiKey
 * - 嵌套路径：headers.authorization
 * - 通配符：*.apiKey (任意对象下的 apiKey)
 */
export const REDACT_PATHS = [
  // API Keys & Tokens
  "apiKey",
  "api_key",
  "apikey",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "Authorization",
  "secret",
  "secretKey",
  "secret_key",

  // 认证信息
  "password",
  "passwd",
  "pwd",
  "credential",
  "credentials",

  // 嵌套路径 - headers
  "headers.authorization",
  "headers.Authorization",
  "headers.x-api-key",
  "headers.x-auth-token",

  // 嵌套路径 - config
  "config.apiKey",
  "config.api_key",
  "config.token",
  "config.password",

  // 通配符匹配 (任意层级下的敏感字段)
  "*.apiKey",
  "*.api_key",
  "*.token",
  "*.password",
  "*.secret",
  "*.authorization",

  // 深层嵌套 (两层通配)
  "*.*.apiKey",
  "*.*.token",
  "*.*.password",

  // 个人信息 (PII) - 可选
  // "email",
  // "phone",
  // "ssn",
];

/**
 * 脱敏模式
 */
export type RedactMode = "full" | "partial";

/**
 * 脱敏配置选项
 */
export interface RedactConfig {
  /** 需要脱敏的路径 */
  paths: string[];
  /** 自定义脱敏函数 */
  censor?: (value: unknown, path: string[]) => string;
}

/**
 * 默认脱敏函数
 *
 * - 短字符串：完全遮蔽为 [REDACTED]
 * - 长字符串 (>8字符)：显示前4位 + ****
 *
 * @param value - 原始值
 * @param _path - 字段路径 (未使用)
 * @returns 脱敏后的值
 */
export function defaultCensor(value: unknown, _path: string[]): string {
  if (typeof value === "string" && value.length > 8) {
    return value.slice(0, 4) + "****";
  }
  return "[REDACTED]";
}

/**
 * 完全脱敏函数 (始终返回 [REDACTED])
 */
export function fullCensor(_value: unknown, _path: string[]): string {
  return "[REDACTED]";
}

/**
 * 创建 Pino redact 配置
 *
 * @param options - 配置选项
 * @returns Pino redact 配置对象
 *
 * @example
 * ```typescript
 * const redactConfig = createRedactConfig();
 * const logger = pino({ redact: redactConfig });
 * ```
 *
 * @example
 * ```typescript
 * // 完全脱敏模式
 * const redactConfig = createRedactConfig({ mode: 'full' });
 * ```
 *
 * @example
 * ```typescript
 * // 自定义路径
 * const redactConfig = createRedactConfig({
 *   additionalPaths: ['customField', 'nested.sensitiveData']
 * });
 * ```
 */
export function createRedactConfig(options?: {
  /** 脱敏模式：full 完全遮蔽, partial 部分显示 */
  mode?: RedactMode;
  /** 额外的脱敏路径 */
  additionalPaths?: string[];
  /** 自定义脱敏函数 */
  censor?: (value: unknown, path: string[]) => string;
}): RedactConfig {
  const { mode = "partial", additionalPaths = [], censor } = options ?? {};

  const paths = [...REDACT_PATHS, ...additionalPaths];

  // 选择脱敏函数
  const censorFn = censor ?? (mode === "full" ? fullCensor : defaultCensor);

  return {
    paths,
    censor: censorFn,
  };
}
