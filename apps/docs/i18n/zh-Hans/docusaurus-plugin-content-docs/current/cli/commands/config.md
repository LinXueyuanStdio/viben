---
sidebar_position: 3
title: "viben config"
description: "Git 风格的微本配置管理"
---

# viben config

遵循 git config 约定的配置管理。

## 用法

```bash
viben config <子命令> [选项]
```

## 子命令

| 子命令 | 描述 |
|--------|------|
| `get <key>` | 获取配置值 |
| `set <key> <value>` | 设置配置值 |
| `list` | 列出所有配置值 |
| `edit` | 在编辑器中打开配置 |
| `unset <key>` | 删除配置值 |

## 键格式

配置键使用点表示法：

- `settings.editor` - 编辑器设置
- `settings.pager` - 分页器设置
- `mcp.enabled[0]` - 第一个启用的 MCP
- `skills.enabled` - 启用的技能列表

## 命令

### 获取配置

获取配置值：

```bash
# 获取编辑器设置
viben config get settings.editor

# 从全局配置获取
viben config get --global mcp.enabled

# 从工作区配置获取
viben config get --workspace settings.color
```

**输出：**

```
code
```

**JSON 输出：**

```bash
viben config get settings.editor --json
```

```json
{
  "success": true,
  "data": {
    "key": "settings.editor",
    "value": "code"
  }
}
```

### 设置配置

设置配置值：

```bash
# 设置编辑器
viben config set settings.editor vim

# 设置全局分页器
viben config set --global settings.pager less

# 设置工作区颜色模式
viben config set --workspace settings.color auto

# 设置列表值
viben config set mcp.enabled '["filesystem", "git"]'
```

**输出：**

```
Set settings.editor = vim
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "key": "settings.editor",
    "value": "vim"
  }
}
```

### 列出配置

列出所有配置值：

```bash
# 列出合并后的配置
viben config list

# 仅列出全局配置
viben config list --global

# 仅列出工作区配置
viben config list --workspace

# 显示配置来源
viben config list --show-origin
```

**输出：**

```
settings.editor=code
settings.pager=less
settings.color=auto
mcp.enabled=["filesystem", "git"]
mcp.disabled=["browser"]
skills.enabled=["code-review", "commit"]
```

**使用 `--show-origin`：**

```
global  settings.editor=code
global  settings.pager=less
local   settings.color=auto
global  mcp.enabled=["filesystem", "git"]
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "config": {
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
}
```

### 编辑配置

在编辑器中打开配置文件：

```bash
# 编辑合并/默认配置
viben config edit

# 编辑全局配置
viben config edit --global

# 编辑工作区配置
viben config edit --workspace
```

这会在 `settings.editor` 指定的编辑器或 `EDITOR` 环境变量中打开配置文件。

### 取消设置配置

删除配置值：

```bash
# 删除一个键
viben config unset settings.pager

# 从全局配置删除
viben config unset --global mcp.disabled
```

**输出：**

```
Removed settings.pager
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "key": "settings.pager",
    "removed": true
  }
}
```

## 配置作用域

配置按以下顺序解析（优先级从高到低）：

1. 工作区配置 (`.viben/config.yaml`)
2. 全局配置 (`~/.viben/config.yaml`)
3. 默认值

### 示例

```bash
# 全局设置编辑器
viben config set --global settings.editor vim

# 在工作区覆盖编辑器
viben config set --workspace settings.editor code

# 现在工作区使用 'code'，其他工作区使用 'vim'
```

## 常用配置键

| 键 | 类型 | 描述 | 默认值 |
|----|------|------|--------|
| `settings.editor` | string | 文本编辑器命令 | `code` |
| `settings.pager` | string | 分页器命令 | `less` |
| `settings.color` | string | 颜色输出模式 | `auto` |
| `mcp.enabled` | string[] | 启用的 MCP 服务器 | `[]` |
| `mcp.disabled` | string[] | 禁用的 MCP 服务器 | `[]` |
| `skills.enabled` | string[] | 启用的技能 | `[]` |

## 错误处理

### 键未找到

```bash
viben config get nonexistent.key
```

```json
{
  "success": false,
  "error": {
    "code": "KEY_NOT_FOUND",
    "message": "Configuration key 'nonexistent.key' not found"
  }
}
```

### 无效值

```bash
viben config set settings.color invalid
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VALUE",
    "message": "Invalid value 'invalid' for key 'settings.color'. Expected: auto, always, never"
  }
}
```

## 相关命令

- [viben init](./init) - 初始化工作区
- [viben workspace](./workspace) - 工作区操作
- [viben agent config](./agent) - 智能体特定配置
