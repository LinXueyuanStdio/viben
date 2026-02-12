# viben config

> Git 风格的配置管理。

## 命令

```bash
# 读取配置
viben config get <key>
viben config get settings.editor
viben config get --global mcp.enabled

# 设置配置
viben config set <key> <value>
viben config set settings.editor vim
viben config set --global settings.pager less

# 列出配置
viben config list
viben config list --global
viben config list --show-origin    # 显示配置来源

# 编辑配置
viben config edit                  # 打开默认编辑器
viben config edit --global

# 删除配置
viben config unset <key>
```

**Key Format**: Dot notation, e.g., `settings.editor`, `mcp.enabled[0]`

---

## Related Documents

- [init.md](./init.md) - 工作区初始化
- [workspace.md](./workspace.md) - 工作区操作
