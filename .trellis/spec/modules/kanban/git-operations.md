# Kanban Git 操作模块

> Git Worktree 管理和常用 Git 操作封装

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                   Git Operations Module                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GitService                                                  │
│      ├── Worktree 管理                                       │
│      │   ├── createWorktree()                               │
│      │   ├── removeWorktree()                               │
│      │   └── listWorktrees()                                │
│      │                                                       │
│      ├── 基础操作                                            │
│      │   ├── status()                                       │
│      │   ├── commit()                                       │
│      │   ├── push()                                         │
│      │   └── pull()                                         │
│      │                                                       │
│      ├── 分支操作                                            │
│      │   ├── createBranch()                                 │
│      │   ├── deleteBranch()                                 │
│      │   └── listBranches()                                 │
│      │                                                       │
│      └── GitHub 集成                                         │
│          ├── createPR()                                     │
│          └── getPRStatus()                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心类型

### GitStatus

```typescript
interface GitStatus {
  branch: string;
  remote_branch?: string;

  // 与远程的差异
  ahead: number;
  behind: number;

  // 工作区状态
  staged: FileChange[];
  modified: FileChange[];
  untracked: string[];
  deleted: string[];

  // 是否干净
  is_clean: boolean;
}

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  old_path?: string;  // 重命名时
}
```

### BranchInfo

```typescript
interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream?: string;
  commit: string;
  commit_message: string;
  author: string;
  date: string;
}
```

### WorktreeInfo

```typescript
interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  is_bare: boolean;
  is_detached: boolean;
}
```

### PRInfo

```typescript
interface PRInfo {
  number: number;
  url: string;
  title: string;
  state: "open" | "closed" | "merged";
  base: string;
  head: string;
  created_at: string;
  updated_at: string;
  mergeable?: boolean;
  reviewers?: string[];
}
```

---

## 服务接口

### GitService

```typescript
// packages/core/src/kanban/services/git-service.ts

export class GitService {
  // ============================================================
  // Worktree 管理
  // ============================================================

  /**
   * 创建 Git Worktree
   *
   * @param repoPath - 主仓库路径
   * @param worktreePath - 工作树路径
   * @param branch - 分支名 (如果不存在则创建)
   * @param baseBranch - 基于哪个分支创建
   */
  async createWorktree(
    repoPath: string,
    worktreePath: string,
    branch: string,
    baseBranch?: string
  ): Promise<WorktreeInfo>;

  /**
   * 移除 Git Worktree
   *
   * @param worktreePath - 工作树路径
   * @param force - 是否强制删除 (即使有未提交更改)
   */
  async removeWorktree(worktreePath: string, force?: boolean): Promise<void>;

  /**
   * 列出所有 Worktrees
   */
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]>;

  // ============================================================
  // 基础操作
  // ============================================================

  /**
   * 获取 Git 状态
   */
  async status(workingDir: string): Promise<GitStatus>;

  /**
   * 暂存文件
   */
  async add(workingDir: string, paths: string[]): Promise<void>;

  /**
   * 暂存所有更改
   */
  async addAll(workingDir: string): Promise<void>;

  /**
   * 提交更改
   */
  async commit(
    workingDir: string,
    message: string,
    options?: CommitOptions
  ): Promise<CommitResult>;

  /**
   * 推送到远程
   */
  async push(workingDir: string, options?: PushOptions): Promise<void>;

  /**
   * 拉取远程更改
   */
  async pull(workingDir: string, options?: PullOptions): Promise<void>;

  /**
   * 获取差异
   */
  async diff(
    workingDir: string,
    options?: DiffOptions
  ): Promise<string>;

  // ============================================================
  // 分支操作
  // ============================================================

  /**
   * 创建分支
   */
  async createBranch(
    workingDir: string,
    name: string,
    startPoint?: string
  ): Promise<void>;

  /**
   * 删除分支
   */
  async deleteBranch(
    workingDir: string,
    name: string,
    options?: DeleteBranchOptions
  ): Promise<void>;

  /**
   * 列出分支
   */
  async listBranches(
    workingDir: string,
    options?: ListBranchesOptions
  ): Promise<BranchInfo[]>;

  /**
   * 切换分支
   */
  async checkout(workingDir: string, branch: string): Promise<void>;

  /**
   * 获取当前分支
   */
  async currentBranch(workingDir: string): Promise<string>;

  // ============================================================
  // GitHub 集成 (使用 gh CLI)
  // ============================================================

  /**
   * 创建 Pull Request
   */
  async createPR(workingDir: string, options: CreatePROptions): Promise<PRInfo>;

  /**
   * 获取 PR 状态
   */
  async getPRStatus(workingDir: string, prNumber: number): Promise<PRInfo>;

  /**
   * 列出 PR
   */
  async listPRs(
    workingDir: string,
    options?: ListPRsOptions
  ): Promise<PRInfo[]>;

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 检查是否是 Git 仓库
   */
  async isGitRepo(path: string): Promise<boolean>;

  /**
   * 获取仓库根目录
   */
  async getRepoRoot(path: string): Promise<string>;

  /**
   * 获取远程 URL
   */
  async getRemoteUrl(workingDir: string, remote?: string): Promise<string | null>;

  /**
   * 获取默认分支
   */
  async getDefaultBranch(workingDir: string): Promise<string>;
}
```

### 类型定义

```typescript
interface CommitOptions {
  author?: string;
  amend?: boolean;
  allow_empty?: boolean;
}

interface CommitResult {
  commit: string;
  message: string;
  author: string;
  date: string;
}

interface PushOptions {
  remote?: string;
  branch?: string;
  force?: boolean;
  set_upstream?: boolean;
}

interface PullOptions {
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

interface DiffOptions {
  staged?: boolean;
  commit?: string;
  path?: string;
  stat?: boolean;
}

interface DeleteBranchOptions {
  force?: boolean;
  remote?: boolean;
}

interface ListBranchesOptions {
  remote?: boolean;
  all?: boolean;
}

interface CreatePROptions {
  title: string;
  body?: string;
  base?: string;
  head?: string;
  draft?: boolean;
  reviewers?: string[];
  labels?: string[];
}

interface ListPRsOptions {
  state?: "open" | "closed" | "merged" | "all";
  author?: string;
  base?: string;
  limit?: number;
}
```

---

## 实现说明

### Git Worktree

使用 Git 原生命令创建和管理 Worktree：

```bash
# 创建 worktree (基于现有分支)
git worktree add <path> <branch>

# 创建 worktree (创建新分支)
git worktree add -b <new-branch> <path> <start-point>

# 列出 worktrees
git worktree list --porcelain

# 移除 worktree
git worktree remove <path>

# 强制移除
git worktree remove --force <path>
```

### GitHub CLI

使用 `gh` CLI 进行 GitHub 操作：

```bash
# 创建 PR
gh pr create --title "Title" --body "Body" --base main

# 获取 PR 状态
gh pr view <number> --json number,title,state,url,mergeable

# 列出 PR
gh pr list --json number,title,state,url --limit 20
```

---

## 错误处理

```typescript
export class GitError extends Error {
  constructor(
    message: string,
    public code: GitErrorCode,
    public command?: string,
    public stderr?: string
  ) {
    super(message);
    this.name = 'GitError';
  }
}

export enum GitErrorCode {
  NOT_A_REPO = 'NOT_A_REPO',
  BRANCH_EXISTS = 'BRANCH_EXISTS',
  BRANCH_NOT_FOUND = 'BRANCH_NOT_FOUND',
  WORKTREE_EXISTS = 'WORKTREE_EXISTS',
  UNCOMMITTED_CHANGES = 'UNCOMMITTED_CHANGES',
  MERGE_CONFLICT = 'MERGE_CONFLICT',
  PUSH_REJECTED = 'PUSH_REJECTED',
  GH_NOT_INSTALLED = 'GH_NOT_INSTALLED',
  GH_NOT_AUTHENTICATED = 'GH_NOT_AUTHENTICATED',
  COMMAND_FAILED = 'COMMAND_FAILED',
}
```

---

## API 路由

这些操作通过工作区 API 暴露：

```
POST /api/kanban/workspaces/:id/git/status
POST /api/kanban/workspaces/:id/git/add
POST /api/kanban/workspaces/:id/git/commit
POST /api/kanban/workspaces/:id/git/push
POST /api/kanban/workspaces/:id/git/pull
POST /api/kanban/workspaces/:id/git/diff
POST /api/kanban/workspaces/:id/git/branches
POST /api/kanban/workspaces/:id/git/pr
```

---

## 实现位置

```
packages/core/src/
├── kanban/
│   └── services/
│       └── git-service.ts      # GitService
└── utils/
    └── exec.ts                 # 命令执行工具
```

---

## 与 vibe-kanban 对比

| 功能 | vibe-kanban | viben-core |
|------|-------------|------------|
| Worktree | WorktreeManager | GitService |
| 命令执行 | tokio::process | child_process |
| GitHub | 自实现 API 调用 | gh CLI |
| Merge | 支持 merge/rebase/cherry-pick | 基础 merge |
| 认证 | OAuth token | gh auth |

vibe-kanban 有更完整的 Git 功能（如 merge request, cherry-pick），但我们简化为基础操作 + gh CLI。

---

## Acceptance Criteria

### Worktree 管理
- [ ] createWorktree 创建新的工作树和分支
- [ ] removeWorktree 清理工作树
- [ ] listWorktrees 列出所有工作树

### 基础操作
- [ ] status 返回完整的 Git 状态
- [ ] add/addAll 暂存文件
- [ ] commit 提交更改
- [ ] push 推送到远程
- [ ] pull 拉取远程更改
- [ ] diff 获取差异

### 分支操作
- [ ] createBranch 创建分支
- [ ] deleteBranch 删除分支
- [ ] listBranches 列出分支
- [ ] checkout 切换分支

### GitHub 集成
- [ ] 检测 gh CLI 是否安装
- [ ] createPR 创建 Pull Request
- [ ] getPRStatus 获取 PR 状态
- [ ] listPRs 列出 PR

### 错误处理
- [ ] 正确分类 Git 错误
- [ ] 友好的错误消息

---

## Related Documents

- [workspace.md](./workspace.md) - 工作区管理模块
- [/docs/kanban/09-repo.md](/docs/kanban/09-repo.md) - vibe-kanban 仓库 API 参考
- [/docs/kanban/10-task-attempts.md](/docs/kanban/10-task-attempts.md) - vibe-kanban Git 操作参考
