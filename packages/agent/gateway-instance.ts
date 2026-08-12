import { createGateway } from "ai";

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL;

type GatewayInstanceOptions = {
  headers?: Record<string, string>;
};

/**
 * Vercel AI Gateway 共享实例。
 * - 本地开发：设置 `AI_GATEWAY_API_KEY` 环境变量
 * - Vercel 生产：OIDC 自动注入
 */
export function createGatewayInstance(options: GatewayInstanceOptions = {}) {
  return createGateway({
    ...(AI_GATEWAY_API_KEY
      ? {
          apiKey: AI_GATEWAY_API_KEY,
          ...(AI_GATEWAY_URL ? { baseURL: AI_GATEWAY_URL } : {}),
        }
      : {}),
    ...options,
  });
}

export const gatewayInstance = createGatewayInstance();
