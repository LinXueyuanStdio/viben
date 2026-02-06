---
sidebar_position: 5
title: "会话管理"
description: "管理 Viben 智能体会话 - 创建、列出和管理对话历史"
---

# 会话管理

会话存储每个智能体的对话历史和状态。本指南涵盖会话概念和管理命令。

## 会话概念

### 什么是会话？

会话代表与智能体的对话线程。每个会话包含:

- **会话 ID**: 会话的唯一标识符
- **配置**: 会话特定设置
- **消息历史**: 以 JSONL 格式存储的对话消息
- **状态**: 任何会话特定的状态或上下文

### 会话存储

会话存储在智能体的 `.agent_sessions/` 目录中:

```
~/.viben/agents/<agent-id>/.agent_sessions/
+-- <session-id>/
    |-- config.yaml              # 会话配置
    +-- messages.rollout.jsonl   # 消息历史 (JSONL)
```

### 消息历史格式

消息以 JSONL (JSON Lines) 格式存储:

```jsonl
{"role": "user", "content": "你好", "timestamp": "2024-01-16T10:30:00Z"}
{"role": "assistant", "content": "你好！", "timestamp": "2024-01-16T10:30:01Z"}
{"role": "user", "content": "帮我写一个函数", "timestamp": "2024-01-16T10:31:00Z"}
{"role": "assistant", "content": "好的！什么样的函数...", "timestamp": "2024-01-16T10:31:02Z"}
```

## 会话命令

### 列出会话

列出智能体的所有会话:

```bash
viben agent session list -n <agent-id>
```

**示例:**
```bash
viben agent session list -n my-agent
```

**输出:**
```
Sessions for my-agent:

  ID              Name                    Messages  Last Used
  ----------------------------------------------------------------
  main*           Feature development     42        2h ago
  feature-auth    Auth implementation     28        1d ago
  bugfix-123      Bug investigation       15        3d ago

* = 当前会话
```

### JSON 输出

```bash
viben agent session list -n my-agent --json
```

**输出:**
```json
{
  "success": true,
  "data": {
    "agent_id": "my-agent",
    "current": "main",
    "sessions": [
      {
        "id": "main",
        "name": "Feature development",
        "message_count": 42,
        "last_used": "2024-01-16T08:30:00Z",
        "created": "2024-01-10T09:00:00Z"
      },
      {
        "id": "feature-auth",
        "name": "Auth implementation",
        "message_count": 28,
        "last_used": "2024-01-15T14:00:00Z",
        "created": "2024-01-12T10:00:00Z"
      }
    ]
  }
}
```

### 创建会话

创建新会话:

```bash
viben agent session create -n <agent-id> [session-name]
```

**示例:**
```bash
# 使用自动生成的 ID 创建
viben agent session create -n my-agent

# 使用自定义名称创建
viben agent session create -n my-agent "feature-auth"

# 使用特定 ID 创建
viben agent session create -n my-agent --id auth-implementation "Auth Implementation"
```

**输出:**
```
Created session: feature-auth
  Agent: my-agent
  Path: ~/.viben/agents/my-agent/.agent_sessions/feature-auth/
```

### 查看会话详情

查看会话信息和最近消息:

```bash
viben agent session show -n <agent-id> -s <session-id>
```

**示例:**
```bash
viben agent session show -n my-agent -s main
```

**输出:**
```
Session: main
Agent: my-agent
Name: Feature development
Created: 2024-01-10 09:00
Last Used: 2024-01-16 08:30

Messages: 42 total
Storage: 15.3 KB

Recent Messages (last 5):
  [User 08:25] 你能帮我重构这个函数吗？
  [Assistant 08:26] 好的！让我看看这个函数...
  [User 08:28] 看起来不错，但错误处理呢？
  [Assistant 08:29] 好问题！让我添加适当的错误处理...
  [User 08:30] 完美，谢谢！

Path: ~/.viben/agents/my-agent/.agent_sessions/main/
```

### 删除会话

删除会话及其历史:

```bash
viben agent session remove -n <agent-id> -s <session-id>
```

**示例:**
```bash
viben agent session remove -n my-agent -s old-session
```

**输出:**
```
Are you sure you want to remove session 'old-session'? [y/N]: y
Removed session: old-session
```

### 强制删除

跳过确认:

```bash
viben agent session remove -n my-agent -s old-session --force
```

### 清空会话历史

清空会话中的所有消息但保留会话:

```bash
viben agent session clear -n <agent-id> -s <session-id>
```

**示例:**
```bash
viben agent session clear -n my-agent -s main
```

**输出:**
```
Are you sure you want to clear session 'main' history? [y/N]: y
Cleared 42 messages from session: main
```

## 会话配置

每个会话可以在 `config.yaml` 中有自己的配置:

```yaml
# ~/.viben/agents/my-agent/.agent_sessions/main/config.yaml
id: main
name: "Feature development"
created: 2024-01-10T09:00:00Z
last_used: 2024-01-16T08:30:00Z

# 会话特定设置
settings:
  model: claude-sonnet-4-20250514
  temperature: 0.7
  max_tokens: 8192

# 会话启动时加载的上下文文件
context_files:
  - /path/to/project/README.md
  - /path/to/project/ARCHITECTURE.md

# 会话备注
notes: |
  正在处理认证功能。
  使用 JWT 令牌和刷新机制。
```

## 会话工作流程

### 启动会话

会话启动时:

1. 加载智能体配置
2. 加载会话配置 (如果存在)
3. 加载记忆 (MEMORY.md + 每日日志)
4. 加载会话上下文文件 (如果指定)
5. 从消息历史恢复对话

### 切换会话

```bash
# 设置智能体的当前会话
viben agent session use -n my-agent -s feature-auth
```

或使用环境变量:

```bash
export VIBEN_SESSION=feature-auth
```

### 会话分支

创建从现有历史分支的新会话:

```bash
viben agent session create -n my-agent "exploration" --from main --at 25
```

这会创建一个包含 `main` 会话前25条消息的新会话。

## 会话最佳实践

### 命名规范

- 使用描述性名称: `feature-auth`, `bugfix-login`, `refactor-api`
- 保持名称简短但有意义
- 使用小写字母和连字符

### 何时创建新会话

| 场景 | 建议 |
|------|------|
| 新功能 | 创建新会话 |
| 错误调查 | 创建新会话 |
| 继续工作 | 使用现有会话 |
| 实验性探索 | 创建新会话 |
| 不同项目 | 使用不同智能体 |

### 会话清理

1. **定期清理**: 删除旧的、未使用的会话
2. **清空长会话**: 如果上下文变得太大则清空历史
3. **归档重要会话**: 清空前先导出

```bash
# 导出会话用于归档
viben agent session export -n my-agent -s important-session -o ~/archives/

# 按最后使用时间列出会话
viben agent session list -n my-agent --sort last-used

# 删除超过30天的会话
viben agent session cleanup -n my-agent --older-than 30d
```

## 故障排除

### 会话未找到

```
Error: Session 'my-session' not found for agent 'my-agent'
```

**解决方案:** 列出可用会话并检查 ID:
```bash
viben agent session list -n my-agent
```

### 消息历史损坏

如果 JSONL 文件损坏:

```bash
# 验证会话
viben agent session validate -n my-agent -s main

# 如果可能则修复
viben agent session repair -n my-agent -s main
```

### 会话太大

大型会话可能会减慢上下文加载:

```bash
# 检查会话大小
viben agent session show -n my-agent -s main --stats

# 截断旧消息 (保留最后N条)
viben agent session truncate -n my-agent -s main --keep 100
```

## 下一步

- [记忆系统](./memory-system) - 配置智能体记忆
- [智能体配置](./agent-configuration) - 会话相关设置
- [模板](./templates) - 带有会话预设的模板
