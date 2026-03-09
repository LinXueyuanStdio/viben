# viben service

> 管理后台服务。

## 命令

```bash
# 服务状态
viben service status              # 所有服务状态
viben service status <name>       # 单个服务状态

# 启动/停止
viben service start <name>        # 启动服务
viben service stop <name>         # 停止服务
viben service restart <name>      # 重启服务

# 日志
viben service logs <name>         # 查看服务日志
viben service logs <name> -f      # 实时跟踪日志
```

---

## Managed Services

| Service | Description |
|---------|-------------|
| `mcp:<name>` | MCP Server 进程 |
| `viben:sync` | 配置同步服务 |
| `viben:index` | 本地索引服务 |

---

## 输出示例

**Output (Human)**:
```
Services:
  mcp:filesystem    running   pid:12345  uptime:2h
  mcp:git           running   pid:12346  uptime:2h
  viben:sync        stopped   -          -
```

**Output (JSON)**:
```json
{
  "services": [
    {
      "name": "mcp:filesystem",
      "status": "running",
      "pid": 12345,
      "uptime": "2h"
    }
  ]
}
```

---

## Related Documents

- [gateway.md](./gateway.md) - Gateway 运行时
- [mcp.md](./mcp.md) - MCP 管理
