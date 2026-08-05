import { createGateway } from "ai";

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL;

/**
 * Vercel AI Gateway 实例。
 *
 * - 本地开发：设置 `AI_GATEWAY_API_KEY` 环境变量
 * - Vercel 生产：OIDC 自动注入，无需配置
 * - 可选 `AI_GATEWAY_URL` 覆盖默认网关地址
 */
export const gateway = createGateway(
  AI_GATEWAY_API_KEY
    ? {
        apiKey: AI_GATEWAY_API_KEY,
        ...(AI_GATEWAY_URL ? { baseURL: AI_GATEWAY_URL } : {}),
      }
    : {},
);
