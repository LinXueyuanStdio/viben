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
```

注：目前仅支持 `claude_code`，其他 executor 支持将在后续版本添加。

## 存储格式

### installed.yaml

与现有 `InstalledSkillsFile` 格式保持一致：

```yaml
installed:
  - name: "foo"
    version: "1.2.3"
    path: "/path/to/foo"
    source: "marketplace"        # "local" | "marketplace" | "github"
    installed_at: "2026-04-01T..."
    spec: "foo@1.2.3"            # 新增：原始安装 spec，用于更新
```

**字段说明：**
- `name`: 包名称
- `version`: 安装的版本
- `path`: 安装路径
- `source`: 来源类型
  - `local`: 从本地路径安装
  - `marketplace`: 从 viben registry 安装
  - `github`: 从 GitHub 安装（新增）
- `installed_at`: 安装时间（ISO 8601 格式）
- `spec`: 原始安装命令（新增，可选）

**注意：** 字段使用 snake_case，符合 CLAUDE.md 中 "File storage use snake_case" 的规范。

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
  --version <ver>                     # 显示指定版本详情

viben skill search <query>
viben skill show <name>
  --version <ver>
```

### 安装与卸载

```bash
viben mcp install <spec>              # 安装 MCP 包（默认项目级）
  -g, --global                        # 全局安装
  -f, --force                         # 强制重新安装

viben mcp uninstall <name>
  -g, --global                        # 从全局卸载

viben skill install <spec>            # 安装 Skill 包（默认项目级）
  -g, --global                        # 全局安装
  -e, --executor <type>               # 安装到指定 executor (目前仅支持 claude_code)
  -f, --force                         # 强制重新安装

viben skill uninstall <name>
  -g, --global
  -e, --executor <type>
```

### 列出已安装

```bash
viben mcp list                        # 列出项目级已安装
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

viben mcp publish [path]              # 发布到 registry（需 viben login）
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

### Executor 参数错误

```bash
$ viben mcp install foo -e claude_code
Error: --executor option is only available for skill packages.

$ viben skill install foo -e unsupported
Error: Executor 'unsupported' is not supported. Available: claude_code
```

## 优先级规则

查找顺序：
1. 项目级 `.viben/skills/<name>` 或 `.viben/mcp/<name>`
2. 全局 `~/.viben/skills/<name>` 或 `~/.viben/mcp/<name>`
3. Executor 特定（仅 skill）`~/.claude/skills/<name>`

## 实现架构

```
packages/core/src/
├── mcp/
│   ├── index.ts              # 入口，导出 ops
│   ├── types.ts              # MCP 类型定义
│   └── ops/                  # 新增，参考 skill/ops 结构
│       ├── index.ts          # ops 入口
│       ├── types.ts          # ops 类型（与 skill/ops/types.ts 对齐）
│       ├── paths.ts          # 路径工具函数
│       ├── crud.ts           # install/uninstall/list/get
│       └── registry.ts       # registry API 交互
├── skill/
│   └── ops/
│       ├── index.ts          # 现有
│       ├── types.ts          # 现有，扩展 source 类型添加 "github"
│       ├── paths.ts          # 现有
│       ├── crud.ts           # 现有，扩展 registry/github 安装
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
registry.ts (使用 @viben/api-client 已有方法)
    ↓
proxyFetch (处理代理)
```

### API Client 集成

使用 `@viben/api-client` 已有的方法：
- `client.mcp.search(query)` - 搜索 MCP 包
- `client.mcp.get(id)` - 获取 MCP 包详情
- `client.mcp.download(id, version)` - 下载 MCP 包
- `client.skill.search(query)` - 搜索 Skill 包
- `client.skill.get(id)` - 获取 Skill 包详情
- `client.skill.download(id, version)` - 下载 Skill 包

### 统一模式

- `mcp/ops` 和 `skill/ops` 结构一致
- 共用 `installed.yaml` 格式（数组格式，snake_case 字段）
- 共用 registry API 模式
- 使用已有的 `readYaml`/`writeYaml` 处理配置
- 使用已有的 `proxyFetch` 处理网络请求

## 未来扩展

以下功能不在本次实现范围，可在后续版本添加：

1. **update 命令** - 升级已安装包到最新版本
2. **更多 executor 支持** - cursor, gemini 等
3. **semver 范围** - `foo@^1.2.0` 版本范围支持
4. **checksum 校验** - 包完整性验证
5. **依赖解析** - 自动安装依赖包
6. **缓存管理** - `viben mcp cache` / `viben skill cache`
