---
sidebar_position: 14
title: "Idea API"
description: "AI-driven idea generation and management API"
---

# 想法 API

> `/api/idea` - AI 驱动的想法生成和管理端点

## 概述

想法 API 提供 AI 驱动的代码改进建议生成和管理能力。支持 6 种内置类型和用户自定义类型，生成的想法可转为任务。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/idea/generate` | 生成想法 |
| GET | `/api/idea` | 获取想法列表 |
| GET | `/api/idea/types` | 获取可用类型列表 |
| GET | `/api/idea/:id` | 获取单个想法详情 |
| POST | `/api/idea/:id/promote` | 将想法转为任务 |
| POST | `/api/idea/:id/dismiss` | 忽略想法 |
| DELETE | `/api/idea/:id` | 删除想法 |
| DELETE | `/api/idea` | 批量删除想法 |
| GET | `/api/idea/sessions` | 获取生成会话列表 |
| GET | `/api/idea/sessions/:id` | 获取生成会话详情 |

---

## 详细说明

### POST /api/idea/generate

生成想法。这是一个流式端点，通过 SSE 返回生成进度。

**请求体**:

```json
{
  "types": ["code_improvements", "security_hardening"],
  "workspace_path": "/path/to/project",
  "output": ".viben/ideas",
  "model": "sonnet",
  "max_ideas": 5,
  "append": false,
  "override": false
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| types | string[] | Yes | 要生成的想法类型列表 |
| workspace_path | string | Yes | 工作区路径 |
| output | string | No | 输出目录，默认 `.viben/ideas` |
| model | string | No | AI 模型，默认全局配置 |
| max_ideas | number | No | 每类最大想法数，默认 5 |
| append | boolean | No | 追加模式，默认 false |
| override | boolean | No | 强制重新生成，默认 false |

**响应格式**: `text/event-stream`

**事件类型**:

```json
// 开始生成
{"type": "start", "session_id": "03-11-api-improvement", "types": ["code_improvements"]}

// 类型开始
{"type": "type_start", "idea_type": "code_improvements"}

// 生成进度
{"type": "progress", "idea_type": "code_improvements", "current": 2, "total": 5}

// 单个想法生成完成
{"type": "idea_generated", "idea": {...}}

// 类型完成
{"type": "type_complete", "idea_type": "code_improvements", "count": 5}

// 全部完成
{"type": "complete", "session_id": "03-11-api-improvement", "summary": {...}}

// 错误
{"type": "error", "message": "Failed to generate ideas", "idea_type": "code_improvements"}
```

---

### GET /api/idea

获取想法列表。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | **必需** 工作区路径 |
| type | string | 按类型过滤 |
| effort | string | 按工作量过滤 |
| status | string | 按状态过滤 (draft/promoted/dismissed) |
| session_id | string | 按会话 ID 过滤 |
| limit | number | 限制返回数量，默认 100 |
| offset | number | 分页偏移量 |

**响应**:

```json
{
  "success": true,
  "ideas": [
    {
      "id": "a1b2c3d4",
      "type": "code_improvements",
      "name": "add-retry-logic",
      "title": "Add retry logic to API calls",
      "description": "为 API 调用添加自动重试逻辑",
      "rationale": "当前代码在网络错误时直接失败",
      "estimated_effort": "small",
      "status": "draft",
      "promoted_to": null,
      "created_at": "2026-03-11T14:30:00Z",
      "affected_files": ["src/api/client.ts"],
      "existing_patterns": ["error handling in src/utils/error.ts"],
      "session_id": "03-11-api-improvement"
    }
  ],
  "total": 10,
  "has_more": false
}
```

---

### GET /api/idea/types

获取可用的想法类型列表。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | **必需** 工作区路径 |
| include_builtin | boolean | 包含内置类型，默认 true |
| include_custom | boolean | 包含自定义类型，默认 true |

**响应**:

```json
{
  "success": true,
  "types": [
    {
      "name": "code_improvements",
      "description": "代码改进 - 基于现有模式的改进机会",
      "source": "builtin",
      "max_ideas": 5
    },
    {
      "name": "api_design",
      "description": "API 设计改进 - RESTful 规范、接口一致性",
      "source": "custom",
      "max_ideas": 5,
      "path": "docs/idea-types/api_design.md"
    }
  ]
}
```

**内置类型**:

| 类型 | 说明 |
|------|------|
| `code_improvements` | 代码改进 |
| `ui_ux_improvements` | UI/UX 改进 |
| `documentation_gaps` | 文档缺失 |
| `security_hardening` | 安全加固 |
| `performance_optimizations` | 性能优化 |
| `code_quality` | 代码质量 |

---

### GET /api/idea/:id

获取单个想法详情。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | **必需** 工作区路径 |

**响应**:

```json
{
  "success": true,
  "idea": {
    "id": "a1b2c3d4",
    "type": "code_improvements",
    "name": "add-retry-logic",
    "title": "Add retry logic to API calls",
    "description": "为 API 调用添加自动重试逻辑，处理临时网络故障",
    "rationale": "当前代码在网络错误时直接失败，没有重试机制",
    "estimated_effort": "small",
    "status": "draft",
    "promoted_to": null,
    "created_at": "2026-03-11T14:30:00Z",
    "affected_files": ["src/api/client.ts", "src/api/request.ts"],
    "existing_patterns": ["error handling in src/utils/error.ts"],
    "implementation_approach": "使用 exponential backoff 策略...",
    "session_id": "03-11-api-improvement",
    "file_path": ".viben/ideas/03-11-api-improvement/idea_code_improvements_add-retry-logic.md"
  }
}
```

---

### POST /api/idea/:id/promote

将想法转为任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/project",
  "slug": "add-retry-logic",
  "branch": "feature/add-retry-logic",
  "assignee": "developer",
  "priority": "P2",
  "executor": "CLAUDE_CODE",
  "model": "opus",
  "start": false,
  "worktree": false
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| slug | string | No | 任务标识符 |
| branch | string | No | 自定义分支名 |
| assignee | string | No | 分配给谁 |
| priority | string | No | 优先级 (P0-P3) |
| executor | string | No | 执行器类型 |
| model | string | No | 使用的模型 |
| start | boolean | No | 自动启动任务 |
| worktree | boolean | No | 在 git worktree 中运行 |

**响应**:

```json
{
  "success": true,
  "idea_id": "a1b2c3d4",
  "task": {
    "id": "task-123",
    "name": "add-retry-logic",
    "title": "Add retry logic to API calls",
    "status": "backlog",
    "task_dir": ".viben/tasks/03-11-add-retry-logic"
  }
}
```

---

### POST /api/idea/:id/dismiss

忽略想法。

**请求体**:

```json
{
  "workspace_path": "/path/to/project",
  "reason": "不适用于当前项目"
}
```

**响应**:

```json
{
  "success": true,
  "idea_id": "a1b2c3d4",
  "status": "dismissed"
}
```

---

### DELETE /api/idea/:id

删除单个想法。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | **必需** 工作区路径 |

**响应**:

```json
{
  "success": true,
  "deleted": "a1b2c3d4"
}
```

---

### DELETE /api/idea

批量删除想法。

**请求体**:

```json
{
  "workspace_path": "/path/to/project",
  "ids": ["a1b2c3d4", "b2c3d4e5"],
  "type": "code_improvements",
  "all": false
}
```

**响应**:

```json
{
  "success": true,
  "deleted": 3,
  "ids": ["a1b2c3d4", "b2c3d4e5", "c3d4e5f6"]
}
```

---

### GET /api/idea/sessions

获取生成会话列表。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | **必需** 工作区路径 |
| limit | number | 限制返回数量，默认 20 |
| offset | number | 分页偏移量 |

**响应**:

```json
{
  "success": true,
  "sessions": [
    {
      "id": "03-11-api-improvement",
      "types": ["code_improvements", "security_hardening"],
      "model": "sonnet",
      "summary": {
        "total_ideas": 10,
        "by_type": {"code_improvements": 5, "security_hardening": 5},
        "by_status": {"draft": 9, "promoted": 1}
      },
      "generated_at": "2026-03-11T14:30:00Z",
      "updated_at": "2026-03-11T14:35:00Z"
    }
  ],
  "total": 5,
  "has_more": false
}
```

---

### GET /api/idea/sessions/:id

获取生成会话详情。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | **必需** 工作区路径 |
| include_ideas | boolean | 是否包含想法列表，默认 true |

**响应**:

```json
{
  "success": true,
  "session": {
    "id": "03-11-api-improvement",
    "types": ["code_improvements", "security_hardening"],
    "model": "sonnet",
    "summary": {...},
    "files": [
      "idea_code_improvements_add-retry-logic.md",
      "idea_security_hardening_input-sanitization.md"
    ],
    "generated_at": "2026-03-11T14:30:00Z",
    "updated_at": "2026-03-11T14:35:00Z"
  },
  "ideas": [...]
}
```

---

## 数据结构

### Idea 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 8 字符短 UUID |
| type | string | 想法类型 |
| name | string | 文件友好名称 |
| title | string | 简短标题 |
| description | string | 详细描述 |
| rationale | string | 改进原因 |
| estimated_effort | string | 工作量估计 |
| status | string | 状态 (draft/promoted/dismissed) |
| promoted_to | string | 关联的任务 ID |
| created_at | string | 创建时间 (ISO 8601) |
| affected_files | string[] | 涉及的文件 |
| existing_patterns | string[] | 可参考的现有模式 |
| implementation_approach | string | 实现方法 |
| session_id | string | 所属会话 ID |

---

## 错误码

| HTTP 状态码 | 错误类型 | 说明 |
|-------------|----------|------|
| 400 | ValidationError | 请求参数无效 |
| 404 | NotFoundError | 想法或会话不存在 |
| 409 | ConflictError | 想法已被转为任务 |
| 500 | InternalError | 服务器内部错误 |

---

## 相关端点

- [任务 API](./task.md) - 任务管理
- [智能体 API](./agents.md) - 智能体管理
