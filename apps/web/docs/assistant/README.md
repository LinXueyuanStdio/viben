# Assistant（助手）模块

Viben Assistant 是从 [open-agents](https://github.com/vercel-labs/open-agents) 移植的 AI 编码助手模块，提供 Agent 驱动的编码对话能力。

## 功能概览

- **AI 对话**：与 AI Agent 进行多轮编码对话，Agent 可读写文件、执行 Shell、搜索代码
- **流式响应**：实时接收 Agent 的 SSE 流式输出，支持中途停止
- **Sandbox 隔离**：每个会话在独立 VM 中运行，有完整文件系统和 Git 环境
- **GitHub 集成**：克隆仓库、切换分支、自动 commit、创建 Pull Request
- **Skills 系统**：可复用 Agent 技能，支持全局安装
- **Subagent 调度**：主 Agent 可分派子任务给 Subagent
- **用量统计**：Token 消耗追踪、费用估算、贡献热力图
- **分享**：生成只读链接分享对话

## 页面路由

| 路由 | 说明 |
|------|------|
| `/assistant` | 会话列表 |
| `/assistant/[sessionId]/[chatId]` | 对话页 |
| `/assistant/[sessionId]/codespace` | CodeSpace |
| `/settings/assistant` | 助手设置 |
| `/settings/usage` | 用量统计 |
| `/settings/subscription` | 订阅管理 |

## 架构

```
Web UI (Next.js) → Agent Runtime (packages/agent) → Sandbox VM (packages/sandbox)
                        ↓
                  GitHub API (lib/github)
```

## 文档索引

- [架构说明](./architecture.md)
- [本地开发配置](./setup.md)
- [API 路由参考](./api.md)
- [移植变更记录](./migration.md)

## 相关资源

- 源项目：[open-agents](https://github.com/vercel-labs/open-agents)
- 设计文档：`docs/superpowers/specs/2026-08-05-open-agents-migration-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-05-open-agents-migration/`
