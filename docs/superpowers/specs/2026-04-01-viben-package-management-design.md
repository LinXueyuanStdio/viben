# Viben Package Management 设计文档

## 概述

设计 `viben mcp` 和 `viben skill` 包管理命令，提供类似 pip 的包管理体验。

## 命令结构

```bash
viben mcp <command>          # MCP 包管理
viben skill <command>        # Skill 包管理
```

### 子命令

| 命令 | 说明 |
|------|------|
| `search <query>` | 搜索 registry |
| `show <name>` | 显示包详情 |
| `install <spec>` | 安装包 |
| `uninstall <name>` | 卸载包 |
| `list` | 列出已安装 |
| `download <name>` | 下载但不安装 |
| `publish [path]` | 发布到 registry |

### 安装 Spec 格式

```
foo                        # 从 viben registry 安装最新版
foo@1.2.3                  # 指定版本
gh:user/repo               # GitHub 简写
gh:user/repo#v1.0.0        # GitHub + ref (tag/branch/commit)
./path/to/package          # 本地相对路径
/absolute/path             # 本地绝对路径
```

## 安装位置

### 默认：项目级安装

```
.viben/
├── mcp/
│   ├── installed.yaml
│   └── <slug>/
└── skills/
    ├── installed.yaml
    └── <slug>/
```

### 全局安装 (-g, --global)

```
~/.viben/
├── mcp/
│   ├── installed.yaml
│   └── <slug>/
└── skills/
    ├── installed.yaml
    └── <slug>/
```

### Executor 特定安装 (-e, --executor)

仅适用于 skill：

```
~/.claude/skills/<slug>/       # -e claude_code
~/.cursor/skills/<slug>/       # -e cursor
~/.gemini/skills/<slug>/       # -e gemini
```

## 存储格式

### installed.yaml

```yaml
packages:
  <slug>:
    name: "Display Name"
    version: "1.2.3"
    source: "registry" | "github" | "local"
    spec: "foo@1.2.3"              # 原始安装 spec，用于更新
    installed_at: "2026-04-01T..."
    repository_url: "..."          # 可选
```

### MCP 包结构

```
<slug>/
├── package.json     # npm 包标准格式
├── dist/            # 编译输出
└── ...
```

### Skill 包结构

```
<slug>/
└── skill.md         # Skill 文件（带 frontmatter）
```

## 命令详情

### 搜索与查看

```bash
viben mcp search <query>              # 搜索 registry
viben mcp show <name>                 # 显示包详情

viben skill search <query>
viben skill show <name>
```

### 安装与卸载

```bash
viben mcp install <spec>              # 安装 MCP 包
  -g, --global                        # 全局安装
  -f, --force                         # 强制重新安装

viben mcp uninstall <name>
  -g, --global                        # 从全局卸载

viben skill install <spec>
  -g, --global                        # 全局安装
  -e, --executor <type>               # 安装到指定 executor
  -f, --force                         # 强制重新安装

viben skill uninstall <name>
  -g, --global
  -e, --executor <type>
```

### 列出已安装

```bash
viben mcp list
  -g, --global                        # 列出全局已安装
  -a, --all                           # 列出全部（项目+全局）

viben skill list
  -g, --global
  -e, --executor <type>               # 列出指定 executor 的 skills
  -a, --all
```

### 下载与发布

```bash
viben mcp download <name> [version]   # 下载到当前目录
viben skill download <name> [version]

viben mcp publish [path]              # 发布到 registry（需登录）
viben skill publish [path]
```

## 错误处理

### 安装冲突

```bash
$ viben mcp install foo
Package 'foo@1.2.3' is already installed.
Use --force to reinstall.
```

### 版本冲突

```bash
$ viben mcp install foo@2.0.0
Note: foo@1.0.0 is installed globally. Project version will take precedence.
Installing foo@2.0.0...
```

### 包不存在

```bash
$ viben mcp install nonexistent
Error: Package 'nonexistent' not found in registry.

$ viben mcp install gh:user/nonexistent
Error: Repository 'user/nonexistent' not found or not accessible.
```

### 认证

```bash
$ viben mcp publish
Error: Not logged in. Run 'viben login' first.
```

### 本地路径错误

```bash
$ viben mcp install ./invalid-path
Error: Path './invalid-path' does not exist.

$ viben mcp install ./my-mcp
Error: Invalid MCP package. Missing package.json or invalid format.
```

## 优先级规则

查找顺序：
1. 项目级 `.viben/skills/<name>` 或 `.viben/mcp/<name>`
2. 全局 `~/.viben/skills/<name>` 或 `~/.viben/mcp/<name>`
3. Executor 特定（仅 skill）`~/.claude/skills/<name>` 等

## 实现架构

```
packages/core/src/
├── mcp/
│   ├── index.ts              # 入口，导出 ops
│   ├── types.ts              # MCP 类型定义
│   └── ops/                  # 参考 skill/ops 结构
│       ├── index.ts          # ops 入口
│       ├── types.ts          # ops 类型
│       ├── paths.ts          # 路径工具函数
│       ├── crud.ts           # install/uninstall/list/get
│       └── registry.ts       # registry API 交互
├── skill/
│   └── ops/
│       ├── index.ts          # 现有
│       ├── types.ts          # 现有，扩展
│       ├── paths.ts          # 现有
│       ├── crud.ts           # 现有，扩展 registry 安装
│       └── registry.ts       # 新增，registry API 交互
├── cli/commands/
│   ├── mcp.ts                # 扩展命令
│   └── skill.ts              # 扩展命令
└── http/
    └── proxy.ts              # 已有，proxy-aware fetch
```

### 依赖关系

```
CLI commands
    ↓
mcp/ops, skill/ops
    ↓
registry.ts (使用 @viben/api-client)
    ↓
proxyFetch (处理代理)
```

### 统一模式

- `mcp/ops` 和 `skill/ops` 结构一致
- 共用 `installed.yaml` 格式
- 共用 registry API 模式
- 使用已有的 `readYaml`/`writeYaml` 处理配置
- 使用已有的 `proxyFetch` 处理网络请求
