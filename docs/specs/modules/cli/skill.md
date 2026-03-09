# viben skill

> 管理 Skills。

## viben skill list

列出已安装的 skills。

```bash
# 列出所有已安装的 skills
viben skill list

# 列出可安装的 skills (marketplace)
viben skill list --available

# 列出特定 agent 的 skills
viben skill list --agent <agent-id>

# 仅列出全局 skills
viben skill list --global

# 仅列出 Claude skills
viben skill list --claude

# JSON 输出
viben skill list --json
```

### 选项

| 选项 | 说明 |
|------|------|
| `--available` | 列出 marketplace 可安装的 skills |
| `--agent <id>` | 列出特定 agent 的 skills |
| `--global` | 仅列出全局 skills |
| `--claude` | 仅列出 Claude skills |
| `--json` | JSON 格式输出 |

### 输出示例

```
Installed Skills:
  Name           Version    Path                         Installed At
  code-review    1.0.0      /path/to/code-review         2d ago
  commit         1.2.0      /path/to/commit              5d ago
  test-runner    0.9.0      /path/to/test-runner         1w ago
```

---

## viben skill show

显示 skill 详细信息。

```bash
# 显示 skill 详情
viben skill show <name>

# 显示 agent 的 skill 详情
viben skill show <name> --agent <agent-id>

# JSON 输出
viben skill show <name> --json
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | 查看 agent 的 skill |
| `--json` | JSON 格式输出 |

### 输出示例

```
Skill: Code Review

  ID:           code-review
  Name:         Code Review
  Version:      1.0.0
  Description:  Code review assistance
  Path:         /path/to/skills/code-review
  Source:       local
```

---

## viben skill install

安装 skill。

```bash
# 基础安装 (全局)
viben skill install <name>

# 安装指定版本
viben skill install <name>@<version>
viben skill install <name>@latest

# 安装到指定 agent
viben skill install <name> --agent <agent-id>

# 全局安装 (默认)
viben skill install <name> --global

# 安装到 Claude skills 目录 (.claude/commands/)
viben skill install <name> --claude

# 安装到自定义路径
viben skill install <name> --path /custom/path

# 从本地路径安装
viben skill install <name> --source /local/skill/path

# 使用执行器安装
viben skill install <name> --executor claude-code

# 强制重新安装
viben skill install <name> --force

# 组合选项
viben skill install <name>@2.0.0 --agent my-agent --force
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | 安装到指定 agent |
| `--global` | 全局安装 (默认) |
| `--claude` | 安装到 Claude skills 目录 |
| `--path <path>` | 安装到自定义路径 |
| `--source <path>` | 从本地路径安装 |
| `--version <version>` | 指定版本 (等同于 `@version`) |
| `--executor <name>` | 使用执行器安装 (如 `claude-code`) |
| `-f, --force` | 强制重新安装 |
| `--json` | JSON 格式输出 |

### 执行器说明

| 执行器 | 说明 |
|--------|------|
| `claude-code` | 安装到 Claude Code 的 commands 目录 |

---

## viben skill uninstall

卸载 skill。

```bash
# 从全局卸载 (默认)
viben skill uninstall <name>

# 从 agent 卸载
viben skill uninstall <name> --agent <agent-id>

# 从 Claude skills 目录卸载
viben skill uninstall <name> --claude

# 从自定义路径卸载
viben skill uninstall <name> --path /custom/path
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | 从指定 agent 卸载 |
| `--global` | 从全局卸载 (默认) |
| `--claude` | 从 Claude skills 目录卸载 |
| `--path <path>` | 从自定义路径卸载 |
| `--json` | JSON 格式输出 |

---

## viben skill enable

为 agent 启用 skill。

```bash
viben skill enable <name> --agent <agent-id>
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | (必需) Agent ID |
| `--json` | JSON 格式输出 |

---

## viben skill disable

为 agent 禁用 skill。

```bash
viben skill disable <name> --agent <agent-id>
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | (必需) Agent ID |
| `--json` | JSON 格式输出 |

---

## viben skill enabled

列出 agent 已启用的 skills。

```bash
viben skill enabled --agent <agent-id>
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | (必需) Agent ID |
| `--json` | JSON 格式输出 |

### 输出示例

```
Enabled Skills for Agent: my-agent
  Skill           Enabled At
  code-review     2d ago
  commit-helper   5d ago
```

---

## viben skill path

获取 skill 的路径。

```bash
# 获取全局 skill 路径 (默认)
viben skill path <name>

# 获取 agent skill 路径
viben skill path <name> --agent <agent-id>

# 获取 Claude skill 路径
viben skill path <name> --claude

# 获取全局 skill 路径
viben skill path <name> --global
```

### 选项

| 选项 | 说明 |
|------|------|
| `--agent <id>` | Agent skill 路径 |
| `--global` | 全局 skill 路径 |
| `--claude` | Claude skill 路径 |
| `--json` | JSON 格式输出 |

---

## Related Documents

- [mcp.md](./mcp.md) - MCP 管理
- [agent.md](./agent.md) - Agent 管理
