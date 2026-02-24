# Gateway API 驼峰命名审计报告 - packages/core

> 审计日期: 2026-02-26
>
> 根据 CLAUDE.md 规范，所有 Gateway API 查询参数应使用 **snake_case** 格式

---

## 1. Query Parameters（查询参数）

| 文件 | 行号 | 当前命名 | 应改为 |
|------|------|----------|--------|
| `routes/history.ts` | 57 | `agentId` | `agent_id` |
| `routes/history.ts` | 120 | `agentId` | `agent_id` |
| `routes/history.ts` | 187, 189 | `agentId` | `agent_id` |

---

## 2. Request Body（请求体字段）

| 文件 | 行号 | 当前命名 | 应改为 |
|------|------|----------|--------|
| `routes/history.ts` | 64 | `agentId` | `agent_id` |
| `routes/history.ts` | 66 | `workspacePath` | `workspace_path` |
| `routes/tasks.ts` | 81 | `sessionId` | `session_id` |
| `routes/tasks.ts` | 83 | `agentId` | `agent_id` |
| `routes/tasks.ts` | 85 | `taskIndex` | `task_index` |
| `routes/agent-run.ts` | 986, 992 | `workspacePath` | `workspace_path` |
| `routes/terminal.ts` | 55 | `sessionId` | `session_id` |
| `routes/group-chats.ts` | 293 | `agentId` | `agent_id` |

---

## 3. URL Path Parameters（路径参数）

| 文件 | 行号 | 路径 | 当前命名 | 应改为 |
|------|------|------|----------|--------|
| `routes/sessions.ts` | 128 | `/api/tasks/:taskId/sessions` | `taskId` | `task_id` |
| `routes/tasks.ts` | 213 | `/api/agents/:agentId/tasks` | `agentId` | `agent_id` |
| `routes/tasks.ts` | 222, 236 | nested routes | `agentId`, `sessionId`, `taskId` | snake_case |
| `routes/mcp.ts` | 68, 92, 140, 170, 221, 244, 271 | `/api/agents/:agentId/mcp-*` | `agentId` | `agent_id` |
| `routes/group-chats.ts` | 1164, 1194, 1235, 1270, 1711, 1764 | `/:id/sessions/:sessionId` | `sessionId` | `session_id` |
| `routes/executors.ts` | 768 | `/:type/sessions/:sessionId` | `sessionId` | `session_id` |
| `routes/agent-run.ts` | 925, 1080 | `/:sessionId` | `sessionId` | `session_id` |
| `routes/agent-run.ts` | 1064 | `/:taskId` | `taskId` | `task_id` |

---

## 4. 影响范围汇总

| 路由文件 | 违规数量 | 优先级 |
|----------|----------|--------|
| `history.ts` | 5 | 高 |
| `tasks.ts` | 6 | 高 |
| `group-chats.ts` | 7 | 中 |
| `mcp.ts` | 7 | 中 |
| `agent-run.ts` | 4 | 中 |
| `sessions.ts` | 1 | 低 |
| `terminal.ts` | 1 | 低 |
| `executors.ts` | 1 | 低 |

---

## 5. 已符合规范的部分

- **Services 层**：内部使用 camelCase（符合 JS 惯例），API 边界通过 transformer 函数转换为 snake_case
- `agents.ts` 和 `sessions.ts` 已有 `toSnakeCaseSession`、`toSnakeCaseMessage` 等转换函数
- Events 服务已全部使用 snake_case（`agent_id`, `session_id`, `task_id` 等）

---

## 6. 修复建议

1. **优先修复** `history.ts` 和 `tasks.ts`（查询参数影响最大）
2. **路径参数**需要前后端同步修改（影响 URL 结构）
3. 可以保留内部 camelCase，只需确保 API 边界使用 snake_case
4. 参考现有的 transformer 函数模式进行统一转换
