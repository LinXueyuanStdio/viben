# GitHub Issue 全自动化管理设计方案

> 生成日期: 2026-02-28
> 参考项目: Auto-Claude
> 功能范围: 全自动化版（Issue 展示 + AI 分析 + 自动修复 + 批量处理）

## 需求决策汇总

| 决策点 | 选择 |
|--------|------|
| 功能范围 | 全自动化版（Issue 展示 + AI 分析 + 自动修复 + 批量处理） |
| 技术栈 | TypeScript 重写到 packages/core |
| GitHub API | gh CLI wrapper |
| 触发方式 | 混合模式（标签自动 + 手动触发） |
| 人工审核 | 可配置，默认需要审核 |
| UI 位置 | 工作空间新增 Issues Tab |
| 批量处理 | 语义聚类 + 批量修复 |
| AI 模型 | 独立模型配置（专门为 GitHub 功能） |
| 架构方案 | Gateway 中心化 |
| 执行环境 | Git Worktree 隔离 |

## Part 1：整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Workspace Issues Tab                                   ││
│  │  - IssueList / IssueDetail / BatchReviewWizard         ││
│  │  - InvestigationDialog / AutoFixProgress               ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                    Gateway (port 18790)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ /api/github │ │ /api/agents │ │ /api/github/auto-fix    ││
│  │ issues.ts   │ │ (existing)  │ │ task-queue.ts           ││
│  └──────┬──────┘ └──────┬──────┘ └───────────┬─────────────┘│
│         │               │                     │              │
│  ┌──────▼───────────────▼─────────────────────▼─────────────┐│
│  │                  packages/core                           ││
│  │  github/gh-client.ts  │  github/issue-analyzer.ts       ││
│  │  github/auto-fixer.ts │  github/batch-processor.ts      ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────┘
                           │ spawn
                    ┌──────▼──────┐
                    │   gh CLI    │
                    └─────────────┘
```

核心分层：
- **UI 层**：桌面端 Issues Tab，纯展示和交互
- **API 层**：Gateway 路由，处理 HTTP 请求和 WebSocket 推送
- **Core 层**：GH Client、Issue 分析器、自动修复器、批量处理器
- **CLI 层**：通过 `gh` CLI 执行 GitHub 操作

## Part 2：GH Client 封装

`packages/core/src/github/gh-client.ts` - 封装 `gh` CLI 的所有操作：

```typescript
interface GHClientConfig {
  cwd: string;              // 工作目录（用于检测 repo）
  timeout?: number;         // 命令超时，默认 30s
  retries?: number;         // 重试次数，默认 3
}

interface Issue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
}

class GHClient {
  // 仓库信息
  async getRepoInfo(): Promise<{ owner: string; repo: string }>;
  async checkAuth(): Promise<boolean>;

  // Issue 操作
  async listIssues(options: { state?: string; labels?: string[]; limit?: number }): Promise<Issue[]>;
  async getIssue(number: number): Promise<Issue>;
  async getIssueComments(number: number): Promise<Comment[]>;
  async createIssue(title: string, body: string, labels?: string[]): Promise<Issue>;
  async updateIssue(number: number, updates: Partial<Issue>): Promise<Issue>;
  async addLabels(number: number, labels: string[]): Promise<void>;

  // PR 操作
  async createPR(options: { title: string; body: string; head: string; base: string }): Promise<PR>;
  async listPRs(options?: { state?: string }): Promise<PR[]>;

  // 底层执行
  private async exec(args: string[]): Promise<string>;  // 带超时和重试
}
```

**关键设计点：**
- 超时保护：每个命令 30s 超时，防止卡死
- 指数退避重试：网络错误时自动重试
- 工作目录感知：自动从 `cwd` 检测当前仓库
- JSON 输出解析：使用 `gh --json` 获取结构化数据

## Part 3：Gateway API 路由

`packages/core/src/gateway/routes/github/` 目录结构：

```
routes/github/
├── index.ts           # 路由注册入口
├── issues.ts          # Issue CRUD 操作
├── analysis.ts        # AI 分析相关
├── auto-fix.ts        # 自动修复任务
└── config.ts          # GitHub 功能配置
```

**API 端点设计：**

```typescript
// issues.ts - Issue 管理
GET    /api/github/issues?workspace_path=xxx&state=open&labels=bug
GET    /api/github/issues/:number?workspace_path=xxx
POST   /api/github/issues?workspace_path=xxx              // 创建 Issue
PATCH  /api/github/issues/:number?workspace_path=xxx      // 更新 Issue
POST   /api/github/issues/:number/labels?workspace_path=xxx

// analysis.ts - AI 分析
POST   /api/github/analyze?workspace_path=xxx             // 分析单个 Issue
       body: { issue_number: number }
POST   /api/github/triage?workspace_path=xxx              // 批量分类
       body: { issue_numbers: number[] }
POST   /api/github/batch-cluster?workspace_path=xxx       // 语义聚类
       body: { issue_numbers: number[] }

// auto-fix.ts - 自动修复
POST   /api/github/auto-fix/start?workspace_path=xxx      // 启动修复任务
       body: { issue_numbers: number[], require_approval?: boolean }
GET    /api/github/auto-fix/queue?workspace_path=xxx      // 查看队列状态
POST   /api/github/auto-fix/:task_id/approve              // 人工审批
POST   /api/github/auto-fix/:task_id/cancel               // 取消任务
WS     /api/github/auto-fix/subscribe                     // 进度推送

// config.ts - 配置管理
GET    /api/github/config?workspace_path=xxx
PUT    /api/github/config?workspace_path=xxx
       body: { auto_fix_labels: string[], model: string, require_human_approval: boolean }
```

**注意：** 所有端点遵循 CLAUDE.md 中的 snake_case 参数命名规范。

## Part 4：AI 分析模块

`packages/core/src/github/analysis/` - AI 驱动的 Issue 分析：

```typescript
// issue-analyzer.ts - 单个 Issue 深度分析
interface IssueAnalysis {
  type: 'bug' | 'feature' | 'enhancement' | 'docs' | 'refactor';
  complexity: 'trivial' | 'low' | 'medium' | 'high' | 'critical';
  summary: string;                    // 一句话总结
  requirements: string[];             // 提取的需求列表
  acceptance_criteria: string[];      // 验收标准
  affected_areas: string[];           // 可能影响的代码区域
  suggested_labels: string[];         // 建议添加的标签
  estimated_files: string[];          // 预估需要修改的文件
  risks: string[];                    // 潜在风险点
}

async function analyzeIssue(
  issue: Issue,
  repoContext: RepoContext,          // 仓库结构、README 等
  modelConfig: GitHubModelConfig
): Promise<IssueAnalysis>;

// issue-triager.ts - 批量分类与去重
interface TriageResult {
  issue_number: number;
  suggested_labels: string[];
  priority: 'urgent' | 'high' | 'medium' | 'low';
  is_duplicate: boolean;
  duplicate_of?: number;              // 如果是重复，指向原 Issue
  is_spam: boolean;
}

async function triageIssues(
  issues: Issue[],
  modelConfig: GitHubModelConfig
): Promise<TriageResult[]>;

// batch-cluster.ts - 语义聚类
interface IssueCluster {
  cluster_id: string;
  theme: string;                      // 聚类主题描述
  issue_numbers: number[];
  combined_spec?: string;             // 合并后的规格说明
}

async function clusterIssues(
  issues: Issue[],
  modelConfig: GitHubModelConfig
): Promise<IssueCluster[]>;
```

**Prompt 模板**存放在 `packages/core/src/github/prompts/`，参考 Auto-Claude 的 `prompts/github/` 结构。

## Part 5：独立模型配置

`~/.viben/github-config.yaml` - GitHub 功能专用配置：

```yaml
# GitHub 功能模型配置（独立于工作空间 Agent）
model:
  provider: "anthropic"               # 或 openai, ollama 等
  model: "claude-sonnet-4-5-20250929"
  api_key_env: "ANTHROPIC_API_KEY"    # 环境变量名

# 不同任务可使用不同模型
models:
  analysis: "claude-sonnet-4-5-20250929"    # Issue 分析
  triage: "claude-haiku-3-5-20241022"       # 快速分类（成本低）
  code_gen: "claude-sonnet-4-5-20250929"    # 代码生成

# 自动修复配置
auto_fix:
  enabled: true
  labels: ["auto-fix", "good-first-issue"]  # 触发标签
  require_human_approval: true
  max_parallel_tasks: 3                      # 最大并行任务数
  worktree_base_dir: ".viben-worktrees"     # worktree 存放目录

# 批量处理配置
batch:
  max_cluster_size: 5                        # 每个聚类最大 Issue 数
  similarity_threshold: 0.7                  # 语义相似度阈值
```

**配置优先级**（高到低）：
1. 工作空间级：`{workspace}/.viben/github-config.yaml`
2. 全局级：`~/.viben/github-config.yaml`
3. 默认值：代码内置

```typescript
// packages/core/src/github/config.ts
interface GitHubConfig {
  model: ModelConfig;
  models: { analysis: string; triage: string; code_gen: string };
  auto_fix: AutoFixConfig;
  batch: BatchConfig;
}

async function loadGitHubConfig(workspacePath?: string): Promise<GitHubConfig>;
async function saveGitHubConfig(config: GitHubConfig, workspacePath?: string): Promise<void>;
```

## Part 6：自动修复流水线

`packages/core/src/github/auto-fix/` - 自动修复核心逻辑：

```typescript
// 任务状态机
type TaskStatus =
  | 'queued'           // 排队中
  | 'analyzing'        // AI 分析 Issue
  | 'planning'         // 生成修复计划
  | 'executing'        // 在 worktree 中执行修复
  | 'testing'          // 运行测试验证
  | 'awaiting_approval'// 等待人工审批
  | 'creating_pr'      // 创建 PR
  | 'completed'        // 完成
  | 'failed'           // 失败
  | 'cancelled';       // 已取消

interface AutoFixTask {
  id: string;
  workspace_path: string;
  issue_numbers: number[];           // 支持批量
  status: TaskStatus;
  worktree_path?: string;
  branch_name?: string;
  analysis?: IssueAnalysis;
  plan?: FixPlan;
  pr_number?: number;
  error?: string;
  created_at: string;
  updated_at: string;
}

// 修复计划
interface FixPlan {
  steps: FixStep[];
  estimated_changes: FileChange[];
}

interface FixStep {
  description: string;
  commands?: string[];               // 需要执行的命令
  file_edits?: FileEdit[];           // 需要的文件修改
}
```

**流水线执行流程：**

```
┌─────────┐    ┌───────────┐    ┌──────────┐    ┌───────────┐
│ queued  │───▶│ analyzing │───▶│ planning │───▶│ executing │
└─────────┘    └───────────┘    └──────────┘    └─────┬─────┘
                                                      │
┌───────────┐    ┌────────────────────┐    ┌─────────▼─────┐
│ completed │◀───│ creating_pr        │◀───│ testing       │
└───────────┘    └──────────▲─────────┘    └───────┬───────┘
                            │                      │
                 ┌──────────┴──────────┐           │
                 │ awaiting_approval   │◀──────────┘
                 │ (if configured)     │
                 └─────────────────────┘
```

**Worktree 隔离执行：**
```typescript
// worktree-manager.ts
class WorktreeManager {
  async create(basePath: string, branchName: string): Promise<string>;
  async execute(worktreePath: string, command: string): Promise<ExecResult>;
  async cleanup(worktreePath: string): Promise<void>;
}
```

## Part 7：任务队列与进度推送

`packages/core/src/github/auto-fix/task-queue.ts` - 任务队列管理：

```typescript
class AutoFixTaskQueue {
  private tasks: Map<string, AutoFixTask>;
  private runningCount: number;
  private maxParallel: number;

  // 任务管理
  async enqueue(task: AutoFixTask): Promise<string>;
  async cancel(taskId: string): Promise<void>;
  async approve(taskId: string): Promise<void>;
  async getTask(taskId: string): Promise<AutoFixTask | null>;
  async listTasks(workspacePath?: string): Promise<AutoFixTask[]>;

  // 队列调度
  private async processNext(): Promise<void>;
  private async runTask(task: AutoFixTask): Promise<void>;

  // 事件发射
  onStatusChange: EventEmitter<{ taskId: string; status: TaskStatus; task: AutoFixTask }>;
  onProgress: EventEmitter<{ taskId: string; message: string; percent?: number }>;
}

// 单例，Gateway 启动时初始化
export const taskQueue = new AutoFixTaskQueue();
```

**WebSocket 进度推送：**

```typescript
// Gateway WebSocket 端点
// ws://localhost:18790/api/github/auto-fix/subscribe?workspace_path=xxx

interface WSMessage {
  type: 'status_change' | 'progress' | 'log';
  task_id: string;
  payload: {
    status?: TaskStatus;
    message?: string;
    percent?: number;
    log_line?: string;
  };
}

// 前端订阅示例
const ws = new WebSocket(`ws://localhost:18790/api/github/auto-fix/subscribe?workspace_path=${path}`);
ws.onmessage = (event) => {
  const msg: WSMessage = JSON.parse(event.data);
  // 更新 UI 状态
};
```

**持久化：** 任务状态持久化到 `{workspace}/.viben/github-tasks.json`，Gateway 重启后恢复未完成任务。

## Part 8：UI 组件设计

`apps/desktop/src/components/workspace/github/` - Issues Tab 组件：

```
github/
├── workspace-issues.tsx       # Tab 主容器
├── issue-list.tsx             # Issue 列表（分页、筛选）
├── issue-list-header.tsx      # 搜索栏、筛选器、操作按钮
├── issue-detail.tsx           # Issue 详情面板
├── issue-analysis-card.tsx    # AI 分析结果展示
├── investigation-dialog.tsx   # AI 分析进度弹窗
├── batch-review-wizard.tsx    # 批量处理向导
├── auto-fix-progress.tsx      # 自动修复进度面板
├── auto-fix-queue.tsx         # 修复队列列表
├── github-settings.tsx        # GitHub 功能配置页
└── hooks/
    ├── use-issues.ts          # Issue 数据获取
    ├── use-auto-fix.ts        # 自动修复状态
    └── use-github-config.ts   # 配置管理
```

**主界面布局：**

```
┌─────────────────────────────────────────────────────────────────┐
│ [搜索框] [状态:Open▼] [标签:all▼] [刷新] [设置]                 │
├───────────────────────────────┬─────────────────────────────────┤
│                               │                                 │
│  □ #123 Fix login bug        │  Issue #123                     │
│    bug, auto-fix             │  ─────────────────────────────  │
│                               │  **Fix login bug**              │
│  □ #122 Add dark mode        │                                 │
│    feature                   │  When user clicks login...      │
│                               │                                 │
│  ☑ #121 Update docs          │  ┌─────────────────────────┐    │
│    docs                       │  │ AI Analysis             │    │
│                               │  │ Type: bug               │    │
│  □ #120 Refactor API         │  │ Complexity: medium      │    │
│    refactor                  │  │ Files: src/auth/...     │    │
│                               │  └─────────────────────────┘    │
│                               │                                 │
│                               │  [分析] [自动修复] [批量▼]      │
├───────────────────────────────┴─────────────────────────────────┤
│ 修复队列: 2 running, 1 awaiting approval             [查看队列] │
└─────────────────────────────────────────────────────────────────┘
```

**状态管理：** 使用 Zustand store `apps/desktop/src/stores/github-store.ts`

## Part 9：状态管理 Store

`apps/desktop/src/stores/github-store.ts` - GitHub 功能状态：

```typescript
interface GitHubState {
  // Issue 列表
  issues: Issue[];
  issuesLoading: boolean;
  issuesError: string | null;
  filters: {
    state: 'open' | 'closed' | 'all';
    labels: string[];
    search: string;
  };

  // 当前选中
  selectedIssueNumbers: number[];
  currentIssue: Issue | null;
  currentAnalysis: IssueAnalysis | null;

  // 自动修复队列
  autoFixTasks: AutoFixTask[];
  autoFixWsConnected: boolean;

  // 配置
  config: GitHubConfig | null;

  // 仓库信息
  repoInfo: { owner: string; repo: string } | null;
  authStatus: 'checking' | 'authenticated' | 'not_authenticated';
}

interface GitHubActions {
  // Issue 操作
  fetchIssues: (workspacePath: string) => Promise<void>;
  selectIssue: (issueNumber: number) => Promise<void>;
  toggleIssueSelection: (issueNumber: number) => void;
  setFilters: (filters: Partial<GitHubState['filters']>) => void;

  // AI 分析
  analyzeIssue: (workspacePath: string, issueNumber: number) => Promise<IssueAnalysis>;
  triageSelected: (workspacePath: string) => Promise<TriageResult[]>;
  clusterSelected: (workspacePath: string) => Promise<IssueCluster[]>;

  // 自动修复
  startAutoFix: (workspacePath: string, issueNumbers: number[]) => Promise<string>;
  approveTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  subscribeToUpdates: (workspacePath: string) => void;
  unsubscribeFromUpdates: () => void;

  // 配置
  loadConfig: (workspacePath: string) => Promise<void>;
  saveConfig: (workspacePath: string, config: Partial<GitHubConfig>) => Promise<void>;

  // 初始化
  initialize: (workspacePath: string) => Promise<void>;
  reset: () => void;
}

export const useGitHubStore = create<GitHubState & GitHubActions>()(
  devtools(
    (set, get) => ({
      // ... 实现
    }),
    { name: 'github-store' }
  )
);
```

**初始化流程**（切换到 Issues Tab 时）：
1. `checkAuth()` - 检查 gh CLI 认证状态
2. `getRepoInfo()` - 获取当前仓库信息
3. `loadConfig()` - 加载 GitHub 配置
4. `fetchIssues()` - 获取 Issue 列表
5. `subscribeToUpdates()` - 连接 WebSocket

## Part 10：错误处理与边界情况

```typescript
// packages/core/src/github/errors.ts
class GitHubError extends Error {
  constructor(
    message: string,
    public code: GitHubErrorCode,
    public recoverable: boolean = true
  ) {
    super(message);
  }
}

enum GitHubErrorCode {
  // 认证相关
  GH_NOT_INSTALLED = 'GH_NOT_INSTALLED',      // gh CLI 未安装
  GH_NOT_AUTHENTICATED = 'GH_NOT_AUTHENTICATED', // 未登录

  // 仓库相关
  NOT_A_GIT_REPO = 'NOT_A_GIT_REPO',          // 不是 Git 仓库
  NO_REMOTE_ORIGIN = 'NO_REMOTE_ORIGIN',      // 无远程仓库
  NOT_GITHUB_REPO = 'NOT_GITHUB_REPO',        // 不是 GitHub 仓库

  // API 相关
  RATE_LIMITED = 'RATE_LIMITED',              // 触发 API 限流
  NETWORK_ERROR = 'NETWORK_ERROR',            // 网络错误
  PERMISSION_DENIED = 'PERMISSION_DENIED',    // 无权限

  // 任务相关
  WORKTREE_CONFLICT = 'WORKTREE_CONFLICT',    // worktree 冲突
  TASK_ALREADY_RUNNING = 'TASK_ALREADY_RUNNING',
  ISSUE_NOT_FOUND = 'ISSUE_NOT_FOUND',
}
```

**边界情况处理：**

| 场景 | 处理方式 |
|------|----------|
| gh CLI 未安装 | 显示安装引导，链接到 https://cli.github.com |
| 未认证 | 显示 `gh auth login` 命令提示 |
| 非 GitHub 仓库 | 禁用 Issues Tab，显示提示信息 |
| API 限流 | 显示剩余等待时间，自动重试 |
| worktree 创建失败 | 清理残留，提示手动处理 |
| 修复执行中断 | 保存断点，支持恢复或回滚 |
| WebSocket 断连 | 自动重连，重连后同步最新状态 |

**UI 反馈：**
```tsx
// 认证状态检查组件
function GitHubAuthGuard({ children }: { children: React.ReactNode }) {
  const { authStatus } = useGitHubStore();

  if (authStatus === 'not_authenticated') {
    return <GitHubAuthPrompt />;  // 显示认证引导
  }
  if (authStatus === 'checking') {
    return <Spinner />;
  }
  return children;
}
```

## Part 11：文件结构与实现顺序

**新增文件结构汇总：**

```
packages/core/src/
├── github/
│   ├── index.ts                    # 导出入口
│   ├── gh-client.ts                # gh CLI 封装
│   ├── config.ts                   # 配置加载/保存
│   ├── errors.ts                   # 错误类型定义
│   ├── analysis/
│   │   ├── issue-analyzer.ts       # Issue 深度分析
│   │   ├── issue-triager.ts        # 批量分类
│   │   └── batch-cluster.ts        # 语义聚类
│   ├── auto-fix/
│   │   ├── task-queue.ts           # 任务队列
│   │   ├── task-runner.ts          # 任务执行器
│   │   └── worktree-manager.ts     # worktree 管理
│   └── prompts/
│       ├── analyzer.md             # 分析 prompt
│       ├── triager.md              # 分类 prompt
│       └── fixer.md                # 修复 prompt
├── gateway/routes/github/
│   ├── index.ts                    # 路由注册
│   ├── issues.ts                   # Issue API
│   ├── analysis.ts                 # 分析 API
│   ├── auto-fix.ts                 # 自动修复 API
│   └── config.ts                   # 配置 API

apps/desktop/src/
├── components/workspace/github/    # UI 组件（Part 8）
└── stores/github-store.ts          # 状态管理
```

**建议实现顺序：**

### Phase 1 - 基础能力
- `gh-client.ts` + `errors.ts` + `config.ts`
- Gateway routes: `issues.ts` + `config.ts`
- UI: `issue-list.tsx` + `issue-detail.tsx`

### Phase 2 - AI 分析
- `analysis/` 模块 + prompts
- Gateway route: `analysis.ts`
- UI: `issue-analysis-card.tsx` + `investigation-dialog.tsx`

### Phase 3 - 自动修复
- `auto-fix/` 模块
- Gateway route: `auto-fix.ts` + WebSocket
- UI: `auto-fix-progress.tsx` + `auto-fix-queue.tsx`

### Phase 4 - 批量处理
- `batch-cluster.ts` 完善
- UI: `batch-review-wizard.tsx`

## 与现有设计的关系

本设计是 `2026-02-28-github-integration-design.md` 的扩展和深化：

- 原设计侧重于**工作空间设置中的 GitHub Section**（认证、仓库选择、基础 Issue 导入）
- 本设计侧重于**工作空间 Issues Tab 的全自动化功能**（AI 分析、自动修复、批量处理）

两个设计可以并行实现，共享 `gh-client.ts` 和 `config.ts` 基础组件。
