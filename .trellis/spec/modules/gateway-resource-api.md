# Gateway 资源发现 API 设计

> Viben Gateway 提供工作空间范围内的 executors、agents、models 资源发现 API。

---

## 概述

| 属性 | 值 |
|------|-----|
| 端点前缀 | `/api` |
| 基础 URL | `http://localhost:18790` |
| 认证 | 无（本地 Gateway） |

---

## 核心设计原则

### 1. 工作空间层级

```
~/.viben/              <- 全局工作空间 (Global Workspace)
├── agents/            <- 全局智能体
├── executors/         <- 全局执行器配置
└── models.yaml        <- 全局模型配置

/path/to/project/      <- 项目工作空间 (Project Workspace)
├── .viben/
│   ├── agents/        <- 项目智能体
│   └── models.yaml    <- 项目模型覆盖
├── .claude/           <- Claude Code 配置
├── .cursor/           <- Cursor 配置
└── ...
```

### 2. 默认行为

- **workspace_path**: 不传时默认为用户目录 `~` 的绝对路径（即全局工作空间）
- **include_global**: 不传时默认为 `true`，返回结果包含全局工作空间的资源

### 3. 资源归属标识

每个资源必须包含 `workspace_path` 字段，标识该资源属于哪个工作空间：
- `"workspace_path": "/Users/xxx"` - 全局资源
- `"workspace_path": "/path/to/project"` - 项目资源

---

## API 端点

### GET /api/agents

获取智能体列表。

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| workspace_path | string | `~` 绝对路径 | 工作空间路径，不传则使用用户目录 |
| include_global | boolean | true | 是否包含全局工作空间的智能体 |

**响应示例**:
```json
{
  "workspace_path": "/path/to/project",
  "agents": [
    {
      "id": "本地助手",
      "name": "本地助手",
      "agent_type": "viben",
      "source": "workspace",
      "workspace_path": "/path/to/project",
      "config_path": "/path/to/project/.viben/agents/本地助手/config.yaml",
      "mcp_server_count": 2,
      "skill_count": 5
    },
    {
      "id": "全局助手",
      "name": "全局助手",
      "agent_type": "viben",
      "source": "global",
      "workspace_path": "/Users/xxx",
      "config_path": "/Users/xxx/.viben/agents/全局助手/config.yaml",
      "mcp_server_count": 0,
      "skill_count": 0
    },
    {
      "id": "claude_code",
      "name": "Claude Code",
      "agent_type": "claude_code",
      "source": "workspace",
      "workspace_path": "/path/to/project",
      "config_path": "/path/to/project/.claude",
      "mcp_server_count": 3,
      "skill_count": 10
    }
  ],
  "total": 3
}
```

### GET /api/executors

获取执行器列表。

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| workspace_path | string | `~` 绝对路径 | 工作空间路径，不传则使用用户目录 |
| include_global | boolean | true | 是否包含全局执行器 |

**响应**:
```json
{
  "workspace_path": "/path/to/project",
  "executors": [
    {
      "id": "CLAUDE_CODE",
      "name": "Claude Code",
      "availability": {
        "type": "LOGIN_DETECTED",
        "last_auth_timestamp": 1770741923
      },
      "supports_mcp": true,
      "capabilities": ["SessionFork", "ContextUsage"],
      "has_workspace_config": true,
      "workspace_path": "/path/to/project",
      "workspace_config_path": "/path/to/project/.claude",
      "global_config_path": "/Users/xxx/.claude"
    },
    {
      "id": "CURSOR_AGENT",
      "name": "Cursor",
      "availability": {
        "type": "INSTALLATION_FOUND"
      },
      "supports_mcp": true,
      "capabilities": ["SetupHelper"],
      "has_workspace_config": false,
      "workspace_path": "/Users/xxx",
      "global_config_path": "/Users/xxx/.cursor"
    }
  ]
}
```

### GET /api/models

获取模型列表。

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| workspace_path | string | `~` 绝对路径 | 工作空间路径，不传则使用用户目录 |
| include_global | boolean | true | 是否包含全局模型 |

**响应**:
```json
{
  "workspace_path": "/path/to/project",
  "models": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "provider_id": "anthropic",
      "provider_name": "anthropic",
      "context_window": 200000,
      "is_available": true,
      "has_workspace_override": false,
      "workspace_path": "/Users/xxx"
    }
  ],
  "total": 29
}
```

---

## 资源合并规则

### 智能体 (Agents)

当 `include_global=true` 时：
1. 先加载项目工作空间的智能体
2. 再加载全局工作空间的智能体
3. **同名智能体**: 项目智能体优先，跳过全局同名智能体
4. 每个智能体的 `source` 字段标识来源：`"workspace"` 或 `"global"`
5. 每个智能体的 `workspace_path` 字段标识其所属工作空间

### 执行器 (Executors)

当 `include_global=true` 时：
1. 遍历所有已知执行器类型
2. 检查项目工作空间和全局工作空间的配置
3. **同名执行器配置合并**:
   - `workspace_config_path`: 项目级配置路径
   - `global_config_path`: 全局配置路径
   - 编辑时优先修改项目级配置

### 模型 (Models)

当 `include_global=true` 时：
1. 加载全局模型列表
2. 检查项目工作空间是否有覆盖配置
3. `has_workspace_override` 标识是否有项目级覆盖

---

## 前端使用示例

```typescript
// 获取当前工作空间可见的所有智能体
const agents = await gateway.getAgents({
  workspacePath: currentWorkspace.path,
  includeGlobal: true,
});

// 显示智能体来源
agents.agents.forEach(agent => {
  if (agent.source === 'global') {
    console.log(`${agent.name} (全局)`);
  } else {
    console.log(`${agent.name} (项目)`);
  }
});

// 编辑智能体配置 - 根据 workspace_path 定位配置文件
const editPath = agent.workspace_path === homeDir
  ? agent.config_path  // 全局智能体直接编辑
  : agent.config_path; // 项目智能体直接编辑
```

---

## 注意事项

1. **workspace_path 必须是绝对路径**
2. **不存在的路径返回 400 错误**
3. **全局工作空间** 指用户目录 `~`，不是 `~/.viben`
4. **IDE 配置** (如 `.claude/`, `.cursor/`) 总是属于发现它们的工作空间
