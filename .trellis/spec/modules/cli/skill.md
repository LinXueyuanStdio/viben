# viben skill

> 管理 Skills。

## 命令

```bash
# 安装/卸载
viben skill install <name>
viben skill install <name>@<version>
viben skill install <name> --agent <agent-id>   # 安装到指定 agent
viben skill install <name> --global              # 全局安装 (默认)
viben skill install <name> --executor claude-code  # 使用执行器
viben skill install <name> --path .claude/skills  # 安装到当前目录的 .claude/skills
viben skill install <name> --claude # 安装到当前目录的 .claude/skills
viben skill install <name> --force              # 强制重新安装
viben skill uninstall <name>

# 列表
viben skill list                  # 列出已安装的 skills
viben skill list --available      # 列出可安装的 skills
```

---

## 输出示例

**`viben skill list` (Human)**:
```
Installed Skills:
  code-review     v1.0.0    Code review assistance
  commit          v1.2.0    Smart commit messages
  test-runner     v0.9.0    Test execution helper
```

---

## Related Documents

- [mcp.md](./mcp.md) - MCP 管理
- [agent.md](./agent.md) - Agent 管理
