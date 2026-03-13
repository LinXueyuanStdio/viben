# viben team

> 团队协作工作区初始化和管理。

## 架构概述

```
┌─────────────────────────────────────────────────────────────────┐
│                    Team Workspace                                │
├─────────────────────────────────────────────────────────────────┤
│  .viben/                                                         │
│      ├── workflow.md           # 工作流文档                       │
│      ├── worktree.yaml         # Git worktree 配置                │
│      ├── .gitignore            # Git 忽略规则                     │
│      ├── .version              # 版本号                           │
│      ├── .developer            # 开发者身份                       │
│      ├── .current-task         # 当前任务指针                     │
│      ├── .template-hashes.json # 模板文件哈希 (用于升级检测)       │
│      ├── workspace/            # 开发者工作区                     │
│      │   └── <developer>/      # 每个开发者的独立空间             │
│      ├── tasks/                # 任务目录                         │
│      │   └── archive/          # 归档任务                         │
├─────────────────────────────────────────────────────────────────┤
│  .claude/                      # Claude Code 配置                 │
│      ├── settings.json         # Claude Code 设置                 │
│      ├── agents/               # 子智能体定义                     │
│      ├── commands/viben/       # 自定义命令                       │
│      └── hooks/                # 钩子脚本                         │
├─────────────────────────────────────────────────────────────────┤
│  .cursor/ (可选)               # Cursor IDE 配置                  │
│      └── commands/             # Cursor 命令                      │
├─────────────────────────────────────────────────────────────────┤
│  AGENTS.md                     # 根级智能体指令文件               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Developer** | 开发者标识，用于区分不同开发者的工作区 |
| **Project Type** | 项目类型 (frontend/backend/fullstack)，决定生成哪些规范文件 |
| **Workspace** | 开发者独立工作空间，包含日志和会话记录 |
| **Task** | 任务单元，包含 task.json 和 prd.md |
| **Spec** | 项目规范文档，指导 AI 智能体行为 |

---

## 命令

```bash
# ============================================================
# Team Workspace 初始化
# ============================================================

# 基本用法 (使用默认 executors: CURSOR + CLAUDE_CODE)
viben team init --user <name>
viben team init --user john-doe

# 指定单个 executor
viben team init --user <name> --executor CLAUDE_CODE
viben team init --user john-doe --executor CURSOR

# 指定多个 executors (可重复使用 --executor)
viben team init --user <name> --executor CLAUDE_CODE --executor CURSOR
viben team init --user john-doe -e CLAUDE_CODE -e GEMINI -e CURSOR

# 指定目标目录
viben team init --user <name> <target-dir>
viben team init --user john-doe ./my-project

# 非交互模式
viben team init --user <name> -y
viben team init --user john-doe --yes

# 强制覆盖现有文件
viben team init --user <name> --force

# 跳过已存在的文件
viben team init --user <name> --skip-existing

# JSON 输出
viben team init --user <name> --json
```

---

## 参数说明

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `--user, -u` | ✓ | git user.name | 开发者名称 |
| `--executor, -e` | - | `CURSOR,CLAUDE_CODE` | AI executor 类型 (可重复使用) |
| `[target-dir]` | - | `.` (当前目录) | 目标目录路径 |
| `--yes, -y` | - | `false` | 非交互模式，使用默认值 |
| `--force, -f` | - | `false` | 强制覆盖现有文件 |
| `--skip-existing, -s` | - | `false` | 跳过已存在的文件 |
| `--json` | - | `false` | JSON 格式输出 |

### 支持的 Executors

| Executor | 说明 | 配置目录 |
|----------|------|----------|
| `CLAUDE_CODE` | Claude Code (Anthropic) | `.claude/` |
| `CURSOR` | Cursor IDE | `.cursor/` |
| `GEMINI` | Gemini CLI (Google) | `.gemini/` |
| `CODEX` | Codex CLI (OpenAI) | `.agents/skills/` |
| `OPENCODE` | OpenCode | `.opencode/` |
| `IFLOW` | iFlow CLI | `.iflow/` |
| `KILO` | Kilo CLI | `.kilocode/` |
| `KIRO` | Kiro Code | `.kiro/skills/` |
| `ANTIGRAVITY` | Antigravity | `.agent/workflows/` |

---

## Developer Name 验证规则

开发者名称必须满足以下规则：
- 只能包含小写字母 (a-z)、数字 (0-9) 和连字符 (-)
- 不能以连字符开头或结尾
- 不能为空

**有效示例**: `john`, `john-doe`, `dev123`, `my-agent-1`

**无效示例**: `John` (大写), `-invalid` (以连字符开头), `invalid-` (以连字符结尾), `` (空)

---

## 生成的目录结构

### .viben/ 目录

```
.viben/
├── workflow.md              # 工作流文档
├── worktree.yaml            # Git worktree 配置
├── .gitignore               # Git 忽略规则
├── .version                 # 版本号 (1.0.0)
├── .developer               # 开发者身份信息
├── .current-task            # 当前任务路径
├── .template-hashes.json    # 模板 SHA256 哈希
│
├── workspace/
│   ├── index.md             # 工作区索引
│   └── <developer>/
│       ├── index.md         # 开发者索引
│       └── journal-1.md     # 会话日志
│
└── tasks/
    ├── archive/             # 归档任务
    └── 00-bootstrap-guidelines/
        ├── task.json        # 任务元数据
        └── prd.md           # 任务需求文档
```

### docs/specs/ 目录

```
docs/specs/
├── guides/              # 通用指南 (始终创建)
│   ├── index.md
│   ├── cross-layer-thinking-guide.md
│   └── code-reuse-thinking-guide.md
│
├── backend/             # 后端规范 (backend/fullstack)
│   ├── index.md
│   ├── directory-structure.md
│   ├── database-guidelines.md
│   ├── logging-guidelines.md
│   ├── quality-guidelines.md
│   └── error-handling.md
│
└── frontend/            # 前端规范 (frontend/fullstack)
    ├── index.md
    ├── directory-structure.md
    ├── type-safety.md
    ├── hook-guidelines.md
    ├── component-guidelines.md
    ├── quality-guidelines.md
    └── state-management.md
```

### .claude/ 目录

```
.claude/
├── settings.json            # Claude Code 设置
│
├── agents/                  # 子智能体
│   ├── check.md
│   ├── fix.md
│   ├── dispatch.md
│   ├── implement.md
│   ├── plan.md
│   └── research.md
│
├── commands/viben/          # 自定义命令
│   ├── before-backend-dev.md
│   ├── before-frontend-dev.md
│   ├── break-loop.md
│   ├── check-backend.md
│   ├── check-cross-layer.md
│   ├── check-frontend.md
│   ├── create-command.md
│   ├── finish-work.md
│   ├── integrate-skill.md
│   ├── onboard.md
│   ├── parallel.md
│   ├── record-session.md
│   ├── start.md
│   └── update-spec.md
│
└── hooks/                   # 钩子脚本 (可执行)
    ├── ralph-loop.py
    └── session-start.py
```

### .cursor/ 目录 (可选)

```
.cursor/
└── commands/
    ├── viben-before-backend-dev.md
    ├── viben-before-frontend-dev.md
    ├── viben-break-loop.md
    ├── viben-check-backend.md
    ├── viben-check-cross-layer.md
    ├── viben-check-frontend.md
    ├── viben-create-command.md
    ├── viben-finish-work.md
    ├── viben-integrate-skill.md
    ├── viben-onboard.md
    ├── viben-record-session.md
    ├── viben-start.md
    └── viben-update-spec.md
```

### AGENTS.md

根目录下的智能体指令文件，供 AI 智能体读取项目级指令。

---

## 输出示例

**`viben team init --user john-doe` (Human)**:
```
Initializing Viben team workspace...
  Target: /path/to/project
  Developer: john-doe
  Executors: CURSOR, CLAUDE_CODE

✓ Workspace initialized successfully!

Created 97 files:
  .viben/     - Workflow files and workspace
  docs/specs/ - Project specifications
  .claude     - Claude Code configuration
  .cursor     - Cursor configuration
  AGENTS.md   - Root instructions file

Next steps:
  1. Review and customize docs/specs/ guidelines
  2. Run viben task context <task> to verify setup
  3. Start developing with AI assistance!
```

**`viben team init --user john-doe --executor CLAUDE_CODE` (单个 executor)**:
```
Initializing Viben team workspace...
  Target: /path/to/project
  Developer: john-doe
  Executors: CLAUDE_CODE

✓ Workspace initialized successfully!

Created 54 files:
  .viben/     - Workflow files and workspace
  docs/specs/ - Project specifications
  .claude     - Claude Code configuration
  AGENTS.md   - Root instructions file
```

**`viben team init --user john-doe --json`**:
```json
{
  "success": true,
  "data": {
    "path": "/path/to/project",
    "files": [
      ".viben/workflow.md",
      ".viben/worktree.yaml",
      ".viben/.gitignore",
      ".viben/.version",
      ".viben/.developer",
      "docs/specs/guides/index.md",
      ".claude/settings.json",
      ".claude/agents/check.md",
      "AGENTS.md"
    ],
    "count": 97,
    "warnings": []
  }
}
```

**错误: 无效的 executor**:
```
Error: Invalid executor "INVALID".

Valid executors:
  CLAUDE_CODE, CURSOR, GEMINI, CODEX, OPENCODE, IFLOW, KILO, KIRO, ANTIGRAVITY
```

**错误: 缺少开发者名称**:
```
Error: Developer name is required.

Usage:
  viben team init --user <name> [target-dir]
  viben team init -y --user <name>  # Non-interactive mode

Example:
  viben team init --user john-doe ./my-project
```

---

## 文件权限

钩子脚本文件 (`.py`) 创建时设置为可执行 (mode 0755)。

---

## 模板哈希

`.viben/.template-hashes.json` 存储所有模板文件的 SHA256 哈希，用于：
- 检测本地文件是否被修改
- 升级时判断是否需要更新
- 冲突解决

```json
{
  ".viben/workflow.md": "a1b2c3d4...",
  ".claude/settings.json": "e5f6g7h8...",
  ".claude/agents/check.md": "i9j0k1l2..."
}
```

---

## Acceptance Criteria

### 基本初始化
- [x] `viben team init --user <name>` 创建完整工作区
- [x] 必须提供 `--user` 参数 (或从 git config user.name 自动检测)
- [x] 默认 executors 为 `CURSOR` + `CLAUDE_CODE`

### Executor 选择
- [x] `--executor <type>` 指定单个 executor
- [x] `--executor` 可重复使用，指定多个 executors
- [x] 支持 9 种 executors: CLAUDE_CODE, CURSOR, GEMINI, CODEX, OPENCODE, IFLOW, KILO, KIRO, ANTIGRAVITY
- [x] 无效 executor 报错并列出有效选项

### 目录结构
- [x] 创建 `.viben/` 目录及所有子目录
- [x] 根据选择的 executors 创建对应配置目录
- [x] 创建 `AGENTS.md` 根文件

### 文件处理
- [x] 默认情况下，目录已存在时报错
- [x] `--force` 覆盖所有现有文件
- [x] `--skip-existing` 跳过已存在的文件
- [x] 脚本文件设置可执行权限 (0755)

### 开发者工作区
- [x] 创建 `.viben/workspace/<developer>/index.md`
- [x] 创建 `.viben/workspace/<developer>/journal-1.md`
- [x] `.viben/.developer` 包含 name 和 initialized_at

### 初始任务
- [x] 创建 `.viben/tasks/00-bootstrap-guidelines/`
- [x] 包含 `task.json` 和 `prd.md`
- [x] `.viben/.current-task` 指向该任务

### 模板哈希
- [x] 创建 `.viben/.template-hashes.json`
- [x] 包含所有模板文件的 SHA256 哈希
- [x] 哈希为 64 字符十六进制字符串

### 输出格式
- [x] 默认输出人类可读格式
- [x] `--json` 输出 JSON 格式
- [x] 返回创建的文件列表
- [x] 返回警告信息 (如有)

---

## Related Documents

- [init.md](./init.md) - 基本工作区初始化
- [workspace.md](./workspace.md) - 工作区操作
- [agent.md](./agent.md) - Agent 管理
