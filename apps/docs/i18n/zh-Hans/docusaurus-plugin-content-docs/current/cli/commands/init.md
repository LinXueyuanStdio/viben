---
sidebar_position: 2
title: "viben init"
description: "在当前目录初始化 Viben 工作区"
---

# viben init

在当前目录初始化 Viben 工作区。

## 用法

```bash
viben init [选项]
```

## 选项

| 选项 | 描述 |
|------|------|
| `--from <template>` | 从模板初始化 |

## 示例

### 基本初始化

使用默认配置创建新工作区：

```bash
viben init
```

**输出（人类可读）：**

```
Initialized Viben workspace in /path/to/project
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills
```

**输出（JSON）：**

```bash
viben init --json
```

```json
{
  "success": true,
  "path": "/path/to/project/.viben",
  "files": ["config.yaml"]
}
```

### 从模板初始化

从预定义模板创建工作区：

```bash
viben init --from my-template
```

## 创建的内容

`init` 命令创建以下结构：

```
<project>/
  .viben/
    config.yaml       # 工作区配置
```

### 默认 config.yaml

```yaml
version: 1

# 工作区设置（覆盖全局）
settings:
  # 继承自全局配置

# 此工作区的 MCP 服务器
mcp:
  enabled: []
  disabled: []

# 此工作区的技能
skills:
  enabled: []
```

## 行为

1. 检查 `.viben/` 是否已存在
2. 如果存在，打印警告并退出
3. 创建 `.viben/` 目录
4. 使用默认设置创建 `config.yaml`
5. 打印下一步操作

## 错误处理

### 工作区已存在

```bash
viben init
```

```
Error: Workspace already initialized at /path/to/project/.viben
```

JSON 输出：

```json
{
  "success": false,
  "error": {
    "code": "WORKSPACE_EXISTS",
    "message": "Workspace already initialized at /path/to/project/.viben"
  }
}
```

### 权限被拒绝

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Cannot create .viben directory: permission denied"
  }
}
```

## 相关命令

- [viben workspace](./workspace) - 工作区操作
- [viben config](./config) - 配置管理
- [viben mcp](./mcp) - MCP 服务器管理
