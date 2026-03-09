# viben init

> 在当前目录初始化工作区。

## 命令

```bash
viben init                    # 创建 .viben/config.yaml
viben init --from <template>  # 从模板初始化
```

---

## 输出示例

**Output (Human)**:
```
✓ Initialized Viben workspace in /path/to/project
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills
```

**Output (JSON)**:
```json
{
  "success": true,
  "path": "/path/to/project/.viben",
  "files": ["config.yaml"]
}
```

---

## Related Documents

- [config.md](./config.md) - 配置管理
- [workspace.md](./workspace.md) - 工作区操作
