# 贡献指南

欢迎为 Viben 项目做出贡献！Viben 是一个多智能体工作区管理器，集成了看板、日历、时间线和任务管理功能。我们非常感谢社区的每一份贡献，无论是修复 bug、添加新功能还是改进文档。

## 目录

- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [文档贡献](#文档贡献)
- [问题反馈](#问题反馈)

## 开发环境设置

### 前置要求

- **Node.js**: >= 20.0.0
- **pnpm**: 9.15.0+
- **Git**: 最新稳定版本

### 安装步骤

1. **克隆仓库**

   ```bash
   git clone https://github.com/LinXueyuanStdio/viben.git
   cd viben
   ```

2. **安装依赖**

   ```bash
   pnpm install
   ```

3. **启动开发服务器**

   ```bash
   # 启动所有应用
   pnpm dev

   # 或单独启动特定应用
   pnpm desktop:dev  # 桌面应用
   ```

### 常用开发命令

```bash
# 开发
pnpm dev                 # 启动所有应用的开发服务器
pnpm desktop:dev         # 启动桌面应用开发服务器
pnpm desktop:restart     # 重启桌面应用（当端口被占用时）
pnpm gateway:restart     # 重启 Gateway 服务

# 构建与检查
pnpm build              # 构建所有包
pnpm typecheck          # 类型检查
pnpm lint               # 代码检查

# 清理
pnpm clean              # 清理所有构建产物和 node_modules
```

## 项目结构

```
viben/
├── apps/                    # 应用程序
│   ├── cli/                 # CLI 命令行工具
│   ├── desktop/             # Tauri 桌面应用
│   ├── docs/                # 文档站点
│   └── web/                 # Web 应用
├── packages/                # 共享包
│   ├── api-client/          # API 客户端
│   ├── chat/                # 聊天功能模块
│   ├── core/                # 核心功能（Gateway、CLI 等）
│   ├── kanban/              # 看板组件
│   ├── ui/                  # UI 组件库
│   └── vibe-kanban/         # Vibe 看板实现
├── backend/                 # 后端服务
├── docs/                    # 项目文档
├── scripts/                 # 脚本工具
└── CLAUDE.md               # AI 开发指南
```

### 核心架构说明

- **packages/core** 是所有前端应用 (`apps/*`) 使用底层能力的唯一边界，需完整实现所有功能
- **Provider/Model 等配置使用 file-native 范式 (YAML)**，不使用数据库，配置存储在 `~/.viben/` 目录

## 开发流程

### 1. Fork 仓库

点击 GitHub 页面右上角的 "Fork" 按钮，将仓库 Fork 到你的账户下。

### 2. 克隆你的 Fork

```bash
git clone https://github.com/YOUR_USERNAME/viben.git
cd viben
```

### 3. 添加上游仓库

```bash
git remote add upstream https://github.com/LinXueyuanStdio/viben.git
```

### 4. 创建功能分支

```bash
# 同步上游代码
git fetch upstream
git checkout main
git merge upstream/main

# 创建新分支
git checkout -b feature/your-feature-name
```

### 5. 提交规范

我们使用 emoji 前缀的提交消息格式：

```
<emoji> [type] <description>
```

**常用 Emoji 和类型：**

| Emoji | Type | 说明 |
|-------|------|------|
| 🚀 | [add] | 新增功能 |
| 🔧 | [update] / [fix] / [refactor] | 更新、修复、重构 |
| 📝 | [fix] | 文档相关修复 |
| 📚 | [update] | 文档更新 |
| 🐍 | [feat] | 新特性 |
| 🔐 | [feat] | 安全相关特性 |
| 🤖 | [feat] | AI 相关特性 |

**提交示例：**

```bash
git commit -m "🚀 [add] Add user authentication feature"
git commit -m "🔧 [fix] Fix login button not responding"
git commit -m "📚 [update] Update API documentation"
git commit -m "🔧 [refactor] Refactor workspace store logic"
```

### 6. 提交 Pull Request

1. 推送分支到你的 Fork

   ```bash
   git push origin feature/your-feature-name
   ```

2. 在 GitHub 上创建 Pull Request

3. 填写 PR 描述，说明：
   - 改动内容
   - 解决的问题（如果有关联的 Issue）
   - 测试情况

4. 等待代码审查

## 代码规范

### TypeScript 使用

- 所有代码必须使用 TypeScript 编写
- 避免使用 `any` 类型，尽量使用明确的类型定义
- 在提交前运行 `pnpm typecheck` 确保类型检查通过

### API 命名约定

**重要**：所有 Gateway API 查询参数使用 **snake_case** 格式：

```typescript
// 正确
const params = {
  workspace_path: '/path/to/workspace',
  include_global: true,
  session_id: 'abc123'
};

// 错误
const params = {
  workspacePath: '/path/to/workspace',  // 不要使用 camelCase
  includeGlobal: true,
  sessionId: 'abc123'
};
```

### 组件开发规范

#### AI 模型图标

使用 `@lobehub/icons` 显示 AI 模型品牌图标：

```tsx
import Claude from "@lobehub/icons/es/Claude";
import OpenAI from "@lobehub/icons/es/OpenAI";

// 有 Color 变体的图标
<Claude.Color size={20} />

// 无 Color 变体的图标
<OpenAI size={20} />
```

#### 聊天输入组件

- `ChatInput` - 简单聊天输入，用于任务面板、调试面板
- `AgentChatInput` - 完整功能的智能体聊天输入，用于工作区聊天

### 翻译规范

进行中文翻译时，请遵循以下术语：

| English | Chinese | 说明 |
|---------|---------|------|
| agent | 智能体 | 不使用"代理" |

## 测试要求

### 构建验证

在提交 PR 之前，请确保所有包都能成功编译：

```bash
# 运行类型检查
pnpm typecheck

# 运行完整构建
pnpm build

# 运行代码检查
pnpm lint
```

### 数据库迁移（apps/web）

如果你的改动涉及数据库 schema 变更，需要运行迁移：

```bash
cd apps/web && pnpm db:push
```

注意：此命令需要**手动交互**确认 schema 变更。

可用的 drizzle-kit 命令：
- `pnpm db:push` - 推送 schema 变更到数据库（交互式）
- `pnpm db:generate` - 生成迁移文件
- `pnpm db:migrate` - 运行迁移
- `pnpm db:studio` - 打开 Drizzle Studio 检查数据库

## 文档贡献

文档位于 `apps/docs/` 和 `docs/` 目录。

### 文档类型

- **用户文档**: 使用指南、功能说明
- **开发文档**: API 文档、架构说明
- **贡献文档**: 贡献指南、开发规范

### 文档编写要求

- 使用清晰简洁的语言
- 提供代码示例
- 保持文档与代码同步更新

## 问题反馈

### 报告 Bug

1. 在 [Issues](https://github.com/LinXueyuanStdio/viben/issues) 页面搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 问题描述
   - 复现步骤
   - 期望行为
   - 实际行为
   - 环境信息（操作系统、Node.js 版本等）

### 功能建议

1. 在 Issues 页面创建新 Issue
2. 使用 "Feature Request" 标签
3. 详细描述你希望添加的功能及其用途

### 讨论

如有任何问题或想法，欢迎在 Issues 或 Discussions 中与我们交流。

---

感谢你对 Viben 项目的贡献！
