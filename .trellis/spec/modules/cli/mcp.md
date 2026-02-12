# viben mcp

> MCP (Model Context Protocol) 相关命令。

## viben mcp inspector

启动 MCP Inspector 用于测试和调试 MCP servers。基于 `@modelcontextprotocol/inspector` 包。

```bash
# 启动 Inspector (仅启动 proxy，不自动打开浏览器)
viben mcp inspector

# 指定 MCP server 命令
viben mcp inspector node build/index.js
viben mcp inspector npx @anthropic-ai/mcp-server-filesystem

# 传递参数给 MCP server
viben mcp inspector node build/index.js arg1 arg2

# 传递环境变量
viben mcp inspector -e API_KEY=value node build/index.js
viben mcp inspector -e KEY1=val1 -e KEY2=val2 node build/index.js

# 使用配置文件
viben mcp inspector --config mcp.json
viben mcp inspector --config mcp.json --server myserver

# CLI 模式 (非交互式)
viben mcp inspector --cli node build/index.js

# SSE/HTTP 传输
viben mcp inspector --transport sse --server-url https://example.com/sse
viben mcp inspector --transport http --server-url https://example.com/mcp
```

### 选项

| 选项 | 说明 |
|------|------|
| `-c, --config <path>` | 配置文件路径 (JSON 格式，包含 mcpServers) |
| `-s, --server <name>` | 配置文件中的 server 名称 |
| `--cli` | CLI 模式 (非交互式) |
| `-t, --transport <type>` | 传输类型 (stdio, sse, http) |
| `-u, --server-url <url>` | SSE/HTTP 传输的 server URL |
| `-e, --env <key=value>` | 传递给 MCP server 的环境变量 |

### 输出

```
Starting MCP Inspector Proxy...
⚙️ Proxy server listening on localhost:6277
🔑 Session token: xxx

🚀 MCP Inspector is up and running at:
   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=xxx
```

> **Note**: Inspector 仅启动 proxy server，不会自动打开浏览器。手动访问输出的 URL 即可使用 Web UI。

---

## viben mcp serve

启动 MCP server (基于 browse-mcp Python 包)。

```bash
# 启动 MCP server
viben mcp serve

# 指定端口
viben mcp serve --port 8080

# 指定传输类型
viben mcp serve -t sse --port 8080
```

---

## MCP Server 管理 (计划中)

```bash
# 安装/卸载
viben mcp install <name>          # 从 marketplace 安装
viben mcp install <name>@<version>
viben mcp uninstall <name>

# 列表
viben mcp list                    # 列出已安装的 MCP
viben mcp list --available        # 列出可安装的 MCP

# 启用/禁用
viben mcp enable <name>           # 启用 MCP
viben mcp disable <name>          # 禁用 MCP

# 配置单个 MCP
viben mcp config <name>           # 查看 MCP 配置
viben mcp config <name> set <key> <value>
viben mcp config filesystem set root /path/to/dir
```

### 输出示例

**`viben mcp list` (Human)**:
```
Installed MCP Servers:
  filesystem    v1.2.0    enabled    Local filesystem access
  git           v2.0.1    enabled    Git operations
  browser       v1.0.0    disabled   Browser automation
```

---

## Related Documents

- [skill.md](./skill.md) - Skill 管理
- [agent.md](./agent.md) - Agent 管理
