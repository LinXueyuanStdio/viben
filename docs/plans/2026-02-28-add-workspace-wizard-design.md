# 添加工作区向导设计

> 参考 Auto-Claude 的 AddProjectModal，为 viben 创建工作区时提供向导式创建流程。

## 概述

将当前简单的文件夹选择改为两步向导式对话框，引导用户完成工作区配置。

## 组件结构

```
apps/desktop/src/components/workspace/
├── add-workspace-modal.tsx      # 主向导组件
├── steps/
│   ├── step-choose-method.tsx   # 步骤1：选择创建方式
│   ├── step-configure.tsx       # 步骤2：配置表单
│   └── step-complete.tsx        # 步骤3：完成
└── index.ts                     # 导出
```

## 向导流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  选择创建方式    │ ──► │    配置表单      │ ──► │      完成       │
│                 │     │                 │     │                 │
│ • 打开现有文件夹 │     │ • 名称          │     │ • 成功提示      │
│ • 创建新文件夹   │     │ • 位置          │     │ • 前往工作区  │
│                 │     │ • Git/Viben选项  │     │ • 继续添加      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 步骤1：选择创建方式

### UI 布局

```
┌────────────────────────────────────────────────┐
│                 添加工作区                     │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  📂  打开现有文件夹                        │  │
│  │      选择已有的项目目录作为工作区          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  ➕  创建新文件夹                          │  │
│  │      在指定位置创建新的项目目录             │  │
│  └──────────────────────────────────────────┘  │
│                                                │
├────────────────────────────────────────────────┤
│                                      [取消]    │
└────────────────────────────────────────────────┘
```

### 交互行为

- **点击"打开现有文件夹"**: 立即弹出系统文件夹选择器，选择后进入步骤2
- **点击"创建新文件夹"**: 直接进入步骤2，显示完整创建表单
- **取消按钮**: 关闭对话框

### 状态定义

```typescript
type CreationMethod = 'open-existing' | 'create-new';
type WizardStep = 'choose' | 'configure' | 'complete';

interface WizardState {
  step: WizardStep;
  method: CreationMethod | null;
  selectedPath: string | null;      // 已选择的文件夹路径
  folderStatus: FolderStatus | null; // 文件夹检测结果
}

interface FolderStatus {
  hasGit: boolean;
  hasViben: boolean;
  folderName: string;
}
```

## 步骤2：配置表单

### UI 布局（打开现有文件夹）

```
┌────────────────────────────────────────────────┐
│  ←              配置工作区                    │
├────────────────────────────────────────────────┤
│                                                │
│  位置                                          │
│  /Users/xxx/projects/my-project      [已选择]  │
│                                                │
│  工作区名称                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ my-project                               │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ ⚠️ 检测到已有 .viben 配置                  │  │
│  │ ☐ 重新初始化（将覆盖现有配置）              │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ☑ 初始化 Git 仓库           ← 无 .git 时显示  │
│  ☑ 初始化 .viben 配置        ← 无 .viben 时显示│
│                                                │
│  ▶ 高级选项                                    │
│                                                │
├────────────────────────────────────────────────┤
│                          [上一步]    [创建]    │
└────────────────────────────────────────────────┘
```

### UI 布局（创建新文件夹）

```
┌────────────────────────────────────────────────┐
│  ←              创建工作区                    │
├────────────────────────────────────────────────┤
│                                                │
│  工作区名称                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ my-new-project                           │  │
│  └──────────────────────────────────────────┘  │
│  用于文件夹名称，建议小写字母和连字符            │
│                                                │
│  存储位置                                       │
│  ┌────────────────────────────────┐ [浏览...]  │
│  │                                │           │
│  └────────────────────────────────┘           │
│  将创建: /Users/xxx/projects/my-new-project   │
│                                                │
│  ☑ 初始化 Git 仓库                             │
│  ☑ 初始化 .viben 配置                          │
│                                                │
│  ▶ 高级选项                                    │
│                                                │
├────────────────────────────────────────────────┤
│                          [上一步]    [创建]    │
└────────────────────────────────────────────────┘
```

### 高级选项（展开后）

```
│  ▼ 高级选项                                    │
│  ┌──────────────────────────────────────────┐  │
│  │ 开发者名称                                │  │
│  │ ┌────────────────────────────────────┐   │  │
│  │ │ developer                          │   │  │
│  │ └────────────────────────────────────┘   │  │
│  │                                          │  │
│  │ 项目类型                                  │  │
│  │ ○ 全栈  ○ 前端  ○ 后端                   │  │
│  │                                          │  │
│  │ ☑ 包含 Cursor 配置                       │  │
│  └──────────────────────────────────────────┘  │
```

### 智能检测逻辑

- **检测到已有 .git**: 隐藏"初始化 Git 仓库"选项
- **检测到已有 .viben**: 显示提示 + "重新初始化"复选框
- **创建新文件夹**: 显示所有选项

## 步骤3：完成

### UI 布局

```
┌────────────────────────────────────────────────┐
│                  添加工作区                   │
├────────────────────────────────────────────────┤
│                                                │
│                    ✓                           │
│                                                │
│              工作区创建成功！                  │
│                                                │
│        my-project 已添加到工作区列表          │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 📁 /Users/xxx/projects/my-project        │  │
│  │ ✓ Git 仓库已初始化                        │  │
│  │ ✓ .viben 配置已创建                       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
├────────────────────────────────────────────────┤
│        [继续添加]              [前往工作区]   │
└────────────────────────────────────────────────┘
```

### 交互行为

- **前往工作区**（主按钮）: 关闭对话框，导航到 `/workspace/:id`
- **继续添加**: 重置向导状态，返回步骤1

### 创建结果数据

```typescript
interface CreationResult {
  workspace: Workspace;
  actions: {
    gitInitialized: boolean;
    vibenInitialized: boolean;
    vibenFiles?: string[];  // 创建的文件列表（来自 initTeam）
  };
}
```

## 后端 API

### 新增接口

```typescript
// GET /api/workspaces/detect?path=xxx
interface DetectFolderResponse {
  path: string;
  folder_name: string;
  has_git: boolean;
  has_viben: boolean;
}

// POST /api/workspaces/create
interface CreateWorkspaceRequest {
  method: 'open-existing' | 'create-new';
  path: string;              // 现有路径或父目录路径
  name: string;              // 工作区名称（创建新时也作为文件夹名）
  init_git: boolean;
  init_viben: boolean;
  viben_options?: {          // 仅当 init_viben=true 时
    developer_name: string;
    project_type: 'frontend' | 'backend' | 'fullstack';
    include_cursor: boolean;
    force: boolean;          // 重新初始化时为 true
  };
}

interface CreateWorkspaceResponse {
  workspace: Workspace;
  git_initialized: boolean;
  viben_initialized: boolean;
  viben_files?: string[];    // initTeam 创建的文件列表
}
```

### 数据流

```
┌─────────────┐    选择文件夹    ┌─────────────┐
│  步骤1 UI   │ ──────────────► │ Tauri Dialog│
└─────────────┘                 └──────┬──────┘
                                       │ 返回路径
      ┌────────────────────────────────┘
      ▼
┌─────────────┐  GET /detect   ┌─────────────┐
│  步骤2 UI   │ ─────────────► │   Gateway   │
└─────────────┘ ◄───────────── └─────────────┘
      │          FolderStatus
      │ 用户填写表单并提交
      ▼
┌─────────────┐  POST /create  ┌─────────────┐
│  提交创建   │ ─────────────► │   Gateway   │
└─────────────┘                └──────┬──────┘
                                      │
      ┌───────────────────────────────┘
      │ 1. 创建文件夹（如果是新建）
      │ 2. git init（如果需要）
      │ 3. initTeam()（如果需要）
      │ 4. workspaceManager.addWorkspace()
      ▼
┌─────────────┐   更新 store   ┌─────────────┐
│  步骤3 UI   │ ─────────────► │ Zustand     │
└─────────────┘                └─────────────┘
```

## 国际化

### 文案结构

```json
{
  "workspace": {
    "addModal": {
      "title": "添加工作区",
      "titleConfigure": "配置工作区",
      "titleCreate": "创建工作区",
      "methodOpenExisting": "打开现有文件夹",
      "methodOpenExistingDesc": "选择已有的项目目录作为工作区",
      "methodCreateNew": "创建新文件夹",
      "methodCreateNewDesc": "在指定位置创建新的项目目录",
      "fieldName": "工作区名称",
      "fieldNameHint": "用于文件夹名称，建议小写字母和连字符",
      "fieldLocation": "存储位置",
      "fieldLocationSelected": "已选择",
      "fieldWillCreate": "将创建: {{path}}",
      "optionInitGit": "初始化 Git 仓库",
      "optionInitViben": "初始化 .viben 配置",
      "vibenExists": "检测到已有 .viben 配置",
      "optionReinitialize": "重新初始化（将覆盖现有配置）",
      "advancedOptions": "高级选项",
      "fieldDeveloperName": "开发者名称",
      "fieldProjectType": "项目类型",
      "projectFullstack": "全栈",
      "projectFrontend": "前端",
      "projectBackend": "后端",
      "optionIncludeCursor": "包含 Cursor 配置",
      "successTitle": "工作区创建成功！",
      "successDesc": "{{name}} 已添加到工作区列表",
      "successGitInit": "Git 仓库已初始化",
      "successVibenInit": ".viben 配置已创建",
      "btnCancel": "取消",
      "btnBack": "上一步",
      "btnCreate": "创建",
      "btnContinueAdd": "继续添加",
      "btnGoToWorkspace": "前往工作区"
    }
  }
}
```

## 文件清单

### 新建文件

```
apps/desktop/src/components/workspace/
├── add-workspace-modal.tsx          # 主向导组件
├── steps/
│   ├── step-choose-method.tsx       # 步骤1
│   ├── step-configure.tsx           # 步骤2
│   └── step-complete.tsx            # 步骤3
└── index.ts                         # 导出

packages/core/src/gateway/routes/
└── workspace-create.ts              # 新增创建 API
```

### 修改文件

```
apps/desktop/src/components/layout/workspace-section.tsx
└── 将"+"按钮改为打开 AddWorkspaceModal

apps/desktop/src/hooks/use-workspaces.ts
└── 移除原有简单的 addWorkspace，改用新向导

apps/desktop/src/i18n/locales/en.json
apps/desktop/src/i18n/locales/zh-CN.json
└── 添加 workspace.addModal 文案

packages/core/src/gateway/routes/index.ts
└── 注册新路由
```

## 实现步骤

1. **后端 API**: 新增 `/api/workspaces/detect` 和 `/api/workspaces/create` 路由
2. **前端组件**: 创建向导组件和三个步骤组件
3. **国际化**: 添加中英文文案
4. **集成**: 修改 workspace-section 使用新向导
5. **测试**: 验证两种创建方式和各种边界情况

## 关键实现要点

1. **文件夹名称校验**: 复用 `validateDeveloperName` 逻辑，小写字母+连字符
2. **默认开发者名称**: 从系统用户名获取，转换为合法格式
3. **存储位置**: 无默认值，必须用户手动选择
4. **错误处理**: 显示 Toast 提示，不中断向导流程
5. **初始化逻辑**: 复用 `packages/core/src/team/init.ts` 中的 `initTeam` 函数
