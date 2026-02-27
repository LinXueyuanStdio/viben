# Desktop Slash Commands 设计文档

## 概述

在 desktop 对话页面实现完整的 slash 命令系统，支持 Claude Code 所有内置命令，并自动从工作区加载自定义命令和 skills。

## 架构

### 文件结构

```
apps/desktop/src/features/slash-commands/
├── index.ts                          # 导出入口
├── types.ts                          # 类型定义
├── constants.ts                      # 命令分类、图标映射
├── hooks/
│   ├── use-slash-commands.ts         # 主 hook，合并所有命令
│   ├── use-builtin-commands.ts       # 内置命令定义
│   ├── use-workspace-commands.ts     # 从 .claude/commands 加载
│   └── use-skill-commands.ts         # 从 skills 目录加载
├── commands/
│   ├── index.ts                      # 命令注册表
│   ├── session/                      # 会话类命令
│   ├── config/                       # 配置类命令
│   ├── info/                         # 信息类命令
│   ├── workspace/                    # 工作区类命令
│   └── auth/                         # 认证类命令
├── executor.ts                       # 命令执行器
├── parser.ts                         # 命令解析器
└── components/
    ├── command-result-message.tsx    # 命令结果展示
    └── command-help-dialog.tsx       # 帮助对话框
```

### 命令来源

1. **内置命令** - 硬编码在 desktop 应用中
2. **工作区命令** - 从 `<workspace>/.claude/commands/**/*.md` 动态加载
3. **Skills 命令** - 从 skills 目录加载，解析 SKILL.md 的 triggers

### 类型定义

```typescript
type CommandCategory = 'session' | 'config' | 'info' | 'workspace' | 'auth';
type CommandResultType = 'message' | 'ui' | 'action' | 'prompt';

interface SlashCommandDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: CommandCategory;
  args?: { name: string; required: boolean; description: string }[];
  execute: (context: CommandContext, args?: string) => Promise<CommandResult>;
}

interface CommandContext {
  sessionId: string;
  messages: Message[];
  clearMessages: () => void;
  sendMessage: (content: string) => void;
  workspacePath?: string;
  agentId?: string;
  currentModel: string;
  setModel: (model: string) => void;
  openDialog: (dialog: DialogType) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  navigate: (path: string) => void;
}

interface CommandResult {
  type: CommandResultType;
  content?: string | React.ReactNode;
  prompt?: string;
}
```

## 内置命令列表

| 命令 | 类别 | 执行类型 | 功能 |
|------|------|---------|------|
| /help | session | message | 显示命令列表 |
| /clear | session | action | 清空对话历史 |
| /compact | session | prompt | 压缩对话历史 |
| /status | session | message | 显示会话状态 |
| /model | config | ui | 切换模型 |
| /config | config | ui | 打开设置 |
| /memory | config | ui | 管理记忆 |
| /permissions | config | ui | 权限设置 |
| /cost | info | message | 显示费用统计 |
| /doctor | info | message | 系统诊断 |
| /init | workspace | prompt | 初始化项目 |
| /review | workspace | prompt | 代码审查 |
| /pr-comments | workspace | prompt | PR 评论 |
| /login | auth | ui | 登录 |
| /logout | auth | action | 退出登录 |
| /terminal-setup | config | ui | 终端配置 |
| /vim | session | action | Vim 模式 |

## 后端 API

```
GET /api/commands/workspace?workspace_path=...
GET /api/commands/skills?workspace_path=...&agent_id=...
POST /api/commands/compact
```

## 实现步骤

1. 基础框架 - 类型定义、hook 骨架
2. 内置命令 - 实现所有内置命令
3. 后端 API - commands 路由
4. 动态加载 - workspace/skills 命令
5. 集成测试 - workspace-chat 集成
