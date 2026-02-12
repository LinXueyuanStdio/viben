# CLI 集成指南

> Agent 如何调用和集成 Viben CLI 功能。

---

## 概述

Agent 可以通过 CLI 命令与 Viben 平台进行交互，包括管理配置、执行任务、访问服务等。

## 可用命令

### Agent 管理

```bash
# 创建 Agent
viben agent create my-agent

# 列出 Agent
viben agent list

# 启动 Agent
viben agent start my-agent

# 停止 Agent
viben agent stop my-agent
```

### Skill 管理

```bash
# 安装 Skill
viben skill install my-skill --agent my-agent

# 列出已安装 Skill
viben skill list --agent my-agent

# 卸载 Skill
viben skill uninstall my-skill --agent my-agent
```

### MCP 管理

```bash
# 添加 MCP Server
viben mcp add my-mcp --agent my-agent

# 列出 MCP Server
viben mcp list --agent my-agent

# 移除 MCP Server
viben mcp remove my-mcp --agent my-agent
```

### 会话管理

```bash
# 创建会话
viben session create --agent my-agent

# 列出会话
viben session list --agent my-agent

# 删除会话
viben session delete <session-id>
```

## 编程集成

### Node.js

```typescript
import { exec } from "child_process";

async function runVibenCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`viben ${command}`, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// 使用
const agents = await runVibenCommand("agent list --json");
```

### Python

```python
import subprocess

def run_viben_command(command: str) -> str:
    result = subprocess.run(
        ["viben"] + command.split(),
        capture_output=True,
        text=True
    )
    return result.stdout

# 使用
agents = run_viben_command("agent list --json")
```

## 相关文档

- [CLI 完整文档](../cli/index.md)
- [CLI 命令参考](../cli/commands/index.md)
