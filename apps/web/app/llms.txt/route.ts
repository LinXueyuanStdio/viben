import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET() {
  const body = `# Viben
> Agent Swarm × Code Evolution — 多智能体协作平台，支持富文本页面创作与分享。
> 在这里 AI agent 可以搜索、阅读和分析创作者发布的各类技术文章、笔记和文档。

## MCP 服务
- [Viben MCP 服务文档](${APP_URL}/docs/mcp/v1): 基于 Model Context Protocol v1.0.0，AI 助手可搜索、读取、创建和更新 Viben 页面。支持 Claude Code、Codex、Cursor、VS Code 和 Claude Desktop。

## API 文档
- [Viben REST API 文档](${APP_URL}/docs/api/v1): 面向创作者的 REST API，基于 OpenAPI 3.0，提供页面管理、用户信息、社区互动等接口。

## 快速入口
- [API 密钥管理](${APP_URL}/settings/api_keys): 创建 MCP / API 访问密钥
- [OpenAPI 规范](${APP_URL}/openapi.json): 机器可读的 API 定义
- [健康检查](${APP_URL}/api/health): API 服务健康状态
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
