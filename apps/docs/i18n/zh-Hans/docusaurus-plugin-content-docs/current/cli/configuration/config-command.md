---
sidebar_position: 2
title: "Config 命令"
description: "使用 viben config 命令进行 git 风格的配置管理"
---

# Config 命令

`viben config` 命令提供 git 风格的配置管理。它允许你使用熟悉的语法读取、写入、列出和编辑配置值。

## 命令概览

```bash
viben config <子命令> [选项]

子命令：
  get       获取配置值
  set       设置配置值
  list      列出所有配置值
  edit      在编辑器中打开配置文件
  unset     移除配置值
```

## 读取配置

### 获取单个值

```bash
viben config get <key>
```

**示例：**

```bash
# 获取默认编辑器
viben config get settings.editor
# 输出：code

# 获取全局设置
viben config get --global settings.pager
# 输出：less

# 从工作区获取
viben config get --workspace mcp.enabled
# 输出：["filesystem", "git"]
```

### 键格式

配置键使用点号表示法访问嵌套值：

| 键 | 说明 |
|----|------|
| `settings.editor` | 默认编辑器 |
| `settings.pager` | 输出分页器 |
| `settings.color` | 颜色模式 |
| `mcp.enabled` | 已启用的 MCP 服务器 |
| `mcp.disabled` | 已禁用的 MCP 服务器 |
| `skills.enabled` | 已启用的技能 |

对于数组访问，使用方括号表示法：

```bash
# 获取第一个启用的 MCP
viben config get mcp.enabled[0]

# 获取第二个智能体引用
viben config get agents[1]
```

## 写入配置

### 设置值

```bash
viben config set <key> <value>
```

**示例：**

```bash
# 设置编辑器
viben config set settings.editor vim

# 全局设置分页器
viben config set --global settings.pager less

# 设置颜色模式
viben config set settings.color always
```

### 设置复杂值

对于数组和对象，使用 JSON 格式：

```bash
# 设置启用的 MCP 服务器
viben config set mcp.enabled '["filesystem", "git", "browser"]'

# 设置多个技能
viben config set skills.enabled '["code-review", "commit", "test-runner"]'
```

### 作用域选项

| 选项 | 说明 |
|------|------|
| `--global`, `-g` | 写入全局配置（`~/.viben/config.yaml`） |
| `--workspace` | 写入工作区配置（`.viben/config.yaml`） |

```bash
# 设置到全局配置
viben config set --global settings.editor code

# 设置到工作区配置
viben config set --workspace mcp.enabled '["filesystem"]'
```

## 列出配置

### 列出所有值

```bash
viben config list
```

**输出：**

```
settings.editor=code
settings.pager=less
settings.color=auto
mcp.enabled=["filesystem","git"]
mcp.disabled=["browser"]
skills.enabled=["code-review","commit"]
```

### 显示配置来源

使用 `--show-origin` 查看每个值的来源：

```bash
viben config list --show-origin
```

**输出：**

```
global    settings.editor=code
global    settings.pager=less
workspace settings.color=always
workspace mcp.enabled=["filesystem","git","browser"]
global    mcp.disabled=["browser"]
global    skills.enabled=["code-review","commit"]
```

### 特定作用域列表

```bash
# 仅列出全局配置
viben config list --global

# 仅列出工作区配置
viben config list --workspace
```

## 编辑配置

### 在编辑器中打开

```bash
viben config edit
```

这会在默认编辑器中打开配置文件（由 `settings.editor` 或 `$EDITOR` 设置）。

### 编辑特定作用域

```bash
# 编辑全局配置
viben config edit --global

# 编辑工作区配置
viben config edit --workspace
```

### 编辑器优先级

编辑器按以下顺序选择：

1. 配置中的 `settings.editor`
2. `$VISUAL` 环境变量
3. `$EDITOR` 环境变量
4. `vi`（后备）

## 移除配置

### 取消设置值

```bash
viben config unset <key>
```

**示例：**

```bash
# 移除设置
viben config unset settings.pager

# 从全局配置移除
viben config unset --global mcp.disabled
```

:::warning
取消工作区值会显示底层的全局值。要在工作区级别真正禁用某些内容，请将其设置为空值。
:::

## JSON 输出

所有 config 命令都支持 `--json` 进行结构化输出：

```bash
viben config list --json
```

**输出：**

```json
{
  "success": true,
  "data": {
    "settings": {
      "editor": "code",
      "pager": "less",
      "color": "auto"
    },
    "mcp": {
      "enabled": ["filesystem", "git"],
      "disabled": ["browser"]
    },
    "skills": {
      "enabled": ["code-review", "commit"]
    }
  }
}
```

```bash
viben config get settings.editor --json
```

**输出：**

```json
{
  "success": true,
  "data": {
    "key": "settings.editor",
    "value": "code",
    "origin": "global"
  }
}
```

## 常见用例

### 初始设置

```bash
# 设置首选编辑器
viben config set --global settings.editor code

# 启用颜色输出
viben config set --global settings.color always

# 设置默认 MCP 服务器
viben config set --global mcp.enabled '["filesystem", "git"]'
```

### 每个项目配置

```bash
# 初始化工作区
viben init

# 为此项目启用额外的 MCP
viben config set --workspace mcp.enabled '["filesystem", "git", "browser"]'

# 为此项目禁用某些技能
viben config set --workspace skills.disabled '["commit"]'
```

### 调试配置问题

```bash
# 查看所有配置及来源
viben config list --show-origin

# 检查有效值
viben config get mcp.enabled

# 验证作用域检测
viben config list --json | jq '.data'
```

## 错误处理

### 无效的键

```bash
viben config get nonexistent.key
```

**输出：**

```json
{
  "success": false,
  "error": {
    "code": "KEY_NOT_FOUND",
    "message": "Configuration key 'nonexistent.key' not found"
  }
}
```

### 无效的值格式

```bash
viben config set mcp.enabled "not-valid-json"
```

**输出：**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VALUE",
    "message": "Value for 'mcp.enabled' must be a valid JSON array"
  }
}
```

## 下一步

- [Provider 配置](./providers.md) - 配置 API Provider
- [模型配置](./models.md) - 设置模型别名和回退链
