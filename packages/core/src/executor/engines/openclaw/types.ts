/**
 * OpenClaw Executor Types
 */

import type { ExecutorConfig } from "../../ops/types";

/**
 * OpenClaw gateway authentication configuration
 */
export interface OpenClawGatewayAuth {
  mode: "none" | "token" | "password";
  token?: string;
  password?: string;
}

/**
 * OpenClaw gateway connection configuration
 */
export interface OpenClawGatewayConfig {
  host: string;
  port: number;
  auth: OpenClawGatewayAuth;
  cliPath: string;
  autoStart: boolean;
}

/**
 * OpenClaw executor configuration (extends base ExecutorConfig)
 */
export interface OpenClawExecutorConfig extends ExecutorConfig {
  /** Gateway connection overrides */
  gateway?: {
    host?: string;
    port?: number;
    token?: string;
    password?: string;
  };
  /** Auto-start gateway if not running (default: true) */
  autoStart?: boolean;
  /** Path to openclaw CLI binary (default: "openclaw") */
  cliPath?: string;
}

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: OpenClawGatewayConfig = {
  host: "127.0.0.1",
  port: 18789,
  auth: { mode: "none" },
  cliPath: "openclaw",
  autoStart: true,
};
