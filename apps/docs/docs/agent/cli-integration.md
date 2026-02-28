---
sidebar_position: 4
title: CLI 集成指南
description: Viben CLI 完整命令参考
---

# CLI 集成指南

本文档提供 Viben CLI 的完整命令参考，涵盖 Agent 管理、MCP 配置、Skill 管理、Executor 使用等功能。

## 命令结构

```
viben <command> [subcommand] [options]

Commands:
  init          初始化工作区
  config        配置管理 (git-style)
  service       后台服务管理
  gateway       启动 Gateway
  executor      Executor 发现和 Chat
  agent         Agent 管理
  provider      API Provider 管理
  model         Model 管理
  mcp           MCP Server 管理
  skill         Skill 管理
  channel       Chat Channel 管理
  cron          定时任务管理
  workspace     工作区操作
  version       显示版本
  help          显示帮助
```

## 全局选项

```
--json              JSON 格式输出
--global, -g        使用全局配置
--workspace         使用工作区配置
-n, --name <id>     指定 agent 名称/ID
--verbose, -v       详细输出
--quiet, -q         静默模式
--help, -h          显示帮助
```

## Agent 管理命令

### viben agent list

列出所有 agents。

```bash
# 列出所有 agents
viben agent list

# JSON 格式输出
viben agent list --json
```

输出示例：

```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

### viben agent create

创建新 agent。

```bash
# 创建新 agent
viben agent create -n <id>
viben agent create -n my-agent

# 从模板创建
viben agent create -n my-agent -f <template-agent-id>
viben agent create -n my-agent -f /path/to/config.yaml

# 克隆现有 agent
viben agent create -n my-agent --clone <existing-agent-id>

# 使用特定 executor
viben agent create -n my-agent --executor /path/to/executor
```

### viben agent show

查看 agent 详情。

```bash
viben agent show -n <id>
viben agent show -n my-agent
```

输出示例：

```
Agent: my-agent
Name: My Coding Assistant
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/

Memory:
  MEMORY.md     2.3 KB    last modified 2h ago
  2024-01-16.md 1.1 KB    today
  2024-01-15.md 3.2 KB    yesterday

Sessions (1):
  main   "Feature development"   2h ago   42 messages

MCP: filesystem, git (2 enabled)
Skills: code-review, commit (2 enabled)
```

### viben agent remove

删除 agent。

```bash
viben agent remove -n <id>
viben agent remove -n my-agent
viben agent remove -n my-agent --force  # 强制删除
```

### viben agent config

配置 agent。

```bash
# 查看配置
viben agent config -n <id>

# 设置配置
viben agent config -n <id> --set <key>=<value>
viben agent config -n my-agent --set model=gpt-4
viben agent config -n my-agent --set plan=true
viben agent config -n my-agent --set mcp.enabled="[\"filesystem\",\"git\"]"
```

### viben agent set-default

设置默认 agent。

```bash
viben agent set-default -n <id>
viben agent set-default -n my-agent
```

### viben agent status

查看 agent 状态。

```bash
viben agent status
viben agent status -n <id>
```

### viben agent chat

使用指定 Agent 进行非交互式对话。

```bash
# 基本用法
viben agent chat -n <agent-id> -p <prompt>
viben agent chat -n my-agent -p "分析这段代码"

# 从 stdin 读取提示词
echo "解释这个错误" | viben agent chat -n my-agent

# 指定工作目录
viben agent chat -n my-agent -p "分析项目结构" -C /path/to/project

# Session 管理
viben agent chat -n my-agent -p "继续上次的工作" -s main
viben agent chat -n my-agent -p "接着做" --resume abc123
viben agent chat -n my-agent -p "开始新任务" --new-session

# 高级选项
viben agent chat -n my-agent -p "复杂推理任务" --model claude-3-opus
viben agent chat -n my-agent -p "独立任务" --no-memory
viben agent chat -n my-agent -p "自动化脚本" --dangerously-skip-permissions

# JSON 流输入输出
echo '{"type":"user","message":{"role":"user","content":"分析代码"}}' | \
  viben agent chat -n my-agent --input-format stream-json --output-format stream-json
```

**选项说明**：

| 选项 | 说明 |
|------|------|
| `-n, --name` | Agent ID (必需) |
| `-p, --prompt` | 提示词 (可选，无则从 stdin 读取) |
| `-C, --cwd` | 工作目录 (默认当前目录) |
| `-s, --session` | 指定 session ID |
| `--resume` | 恢复已有 session |
| `--new-session` | 强制创建新 session |
| `--model` | 覆盖 Agent 配置的模型 |
| `--no-memory` | 不加载 Agent 记忆 |
| `--input-format` | 输入格式: text (默认), stream-json |
| `--output-format` | 输出格式: text (默认), stream-json |
| `--verbose` | 详细输出 |
| `--dangerously-skip-permissions` | 跳过权限检查 |

## Agent Template 管理

### viben agent template list

列出所有模板。

```bash
viben agent template list
viben agent template list --json
```

### viben agent template create

从现有 agent 创建模板。

```bash
viben agent template create -n <template-id> --clone <agent-id>
viben agent template create -n coding-assistant --clone my-agent
```

### viben agent template show

查看模板详情。

```bash
viben agent template show -n <template-id>
```

### viben agent template remove

删除模板。

```bash
viben agent template remove -n <template-id>
```

## Agent Session 管理

### viben agent session list

列出 agent 的会话。

```bash
viben agent session list -n <agent-id>
viben agent session list -n my-agent
```

### viben agent session create

创建新会话。

```bash
viben agent session create -n <agent-id> [--session-name <name>]
viben agent session create -n my-agent --session-name "feature-auth"
```

### viben agent session show

查看会话详情。

```bash
viben agent session show -n <agent-id> -s <session-id>
```

### viben agent session remove

删除会话。

```bash
viben agent session remove -n <agent-id> -s <session-id>
```

### viben agent session clear

清空会话历史。

```bash
viben agent session clear -n <agent-id> -s <session-id>
```

## Agent Memory 管理

### viben agent memory show

查看 agent 记忆。

```bash
viben agent memory show -n <agent-id>
viben agent memory show -n my-agent --date 2024-01-16
```

### viben agent memory append

追加记忆到今日日志。

```bash
viben agent memory append -n <agent-id> "content to append"
```

### viben agent memory edit

编辑主记忆。

```bash
viben agent memory edit -n <agent-id>
```

## Executor 命令

Executor 是底层 coding agent 工具 (如 Claude Code, Cursor)，Viben 只发现不安装。

### viben executor types

列出支持的 executor 类型。

```bash
viben executor types
viben executor types --json
```

### viben executor list

列出所有已发现的 executors（含安装状态）。

```bash
viben executor list
viben executor list --json
```

输出示例：

```
Executors:

  Installed:
    CLAUDE_CODE     Claude Code      v1.0.25    Anthropic's official CLI
    CURSOR          Cursor           v0.45.2    AI-first code editor

  Not Installed:
    GEMINI_CLI      Gemini CLI       -          Google Gemini CLI
    CODEX           OpenAI Codex     -          OpenAI Codex CLI
```

### viben executor show

查看 executor 详情。

```bash
viben executor show -n <executor-id>
viben executor show -n CLAUDE_CODE
viben executor show -n CURSOR --json
```

### viben executor chat

非交互式调用 executor。

```bash
# 基本用法
viben executor chat -n CLAUDE_CODE -p "分析这段代码"

# 从 stdin 读取
echo "写一个排序函数" | viben executor chat -n CLAUDE_CODE

# JSON 流输入输出
viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# 恢复 session
viben executor chat -n CLAUDE_CODE -p "继续" --resume <session-id>
```

## MCP 命令

### viben mcp list

列出已安装的 MCP servers。

```bash
viben mcp list
viben mcp list --agent <agent-id>
viben mcp list --json
```

### viben mcp show

显示 MCP server 详情。

```bash
viben mcp show <name>
viben mcp show <name> --agent <agent-id>
viben mcp show <name> --json
```

### viben mcp add

为 agent 添加 MCP server 配置。

```bash
viben mcp add <name> --agent <agent-id> --command <cmd>
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user
viben mcp add api-mcp --agent my-agent --command node --env API_KEY=secret123 --env DEBUG=true
viben mcp add filesystem --agent my-agent --command npx --disabled
```

### viben mcp remove

从 agent 移除 MCP server 配置。

```bash
viben mcp remove <name> --agent <agent-id>
```

### viben mcp inspector

启动 MCP Inspector 用于测试和调试。

```bash
viben mcp inspector
viben mcp inspector node build/index.js
viben mcp inspector -e API_KEY=value node build/index.js
viben mcp inspector --config mcp.json --server myserver
viben mcp inspector --cli node build/index.js
```

## Skill 命令

### viben skill list

列出已安装的 skills。

```bash
viben skill list
viben skill list --available
viben skill list --agent <agent-id>
viben skill list --global
viben skill list --claude
viben skill list --json
```

### viben skill show

显示 skill 详情。

```bash
viben skill show <name>
viben skill show <name> --agent <agent-id>
viben skill show <name> --json
```

### viben skill install

安装 skill。

```bash
viben skill install <name>
viben skill install <name>@<version>
viben skill install <name> --agent <agent-id>
viben skill install <name> --global
viben skill install <name> --claude
viben skill install <name> --path /custom/path
viben skill install <name> --source /local/skill/path
viben skill install <name> --force
```

### viben skill uninstall

卸载 skill。

```bash
viben skill uninstall <name>
viben skill uninstall <name> --agent <agent-id>
viben skill uninstall <name> --claude
```

### viben skill enable/disable

启用/禁用 skill。

```bash
viben skill enable <name> --agent <agent-id>
viben skill disable <name> --agent <agent-id>
viben skill enabled --agent <agent-id>
```

### viben skill path

获取 skill 路径。

```bash
viben skill path <name>
viben skill path <name> --agent <agent-id>
viben skill path <name> --claude
```

## 编程集成

### Node.js

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runVibenCommand(command: string): Promise<string> {
  const { stdout } = await execAsync(`viben ${command}`);
  return stdout;
}

// 使用示例
async function main() {
  // 列出 agents
  const agentsJson = await runVibenCommand('agent list --json');
  const agents = JSON.parse(agentsJson);

  // 创建 agent
  await runVibenCommand('agent create -n test-agent');

  // 执行对话
  const response = await runVibenCommand(
    'agent chat -n test-agent -p "Hello" --json'
  );
}
```

### Python

```python
import subprocess
import json

def run_viben_command(command: str) -> str:
    result = subprocess.run(
        ["viben"] + command.split(),
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout

def run_viben_json(command: str) -> dict:
    output = run_viben_command(f"{command} --json")
    return json.loads(output)

# 使用示例
if __name__ == "__main__":
    # 列出 agents
    agents = run_viben_json("agent list")
    print(agents)

    # 创建 agent
    run_viben_command("agent create -n test-agent")

    # 执行对话
    response = run_viben_json('agent chat -n test-agent -p "Hello"')
    print(response)
```

### Shell Script

```bash
#!/bin/bash

# 列出所有 agents
agents=$(viben agent list --json | jq -r '.agents[].id')

# 遍历并显示详情
for agent in $agents; do
    echo "Agent: $agent"
    viben agent show -n "$agent"
    echo "---"
done

# 批量执行任务
viben agent chat -n main -p "Generate a report" --json > report.json
```

## 相关文档

- [Agent 开发指南](./index.md)
- [MCP 开发指南](./mcp-development.md)
- [Skill 开发指南](./skill-development.md)
- [最佳实践](./best-practices.md)
