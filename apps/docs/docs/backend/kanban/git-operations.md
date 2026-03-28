---
sidebar_position: 7
---

# Kanban Git Operations

> Git Worktree management and common Git operations

## Overview

The Git operations module provides a high-level API for managing Git Worktrees and performing common Git operations. It uses native Git commands and integrates with the GitHub CLI (`gh`) for GitHub-specific features.

## Architecture

```
+-------------------------------------------------------------+
|                   Git Operations Module                      |
+-------------------------------------------------------------+
|                                                              |
|  GitService                                                  |
|      +-- Worktree Management                                 |
|      |   +-- createWorktree()                               |
|      |   +-- removeWorktree()                               |
|      |   +-- listWorktrees()                                |
|      |                                                       |
|      +-- Basic Operations                                    |
|      |   +-- status()                                       |
|      |   +-- commit()                                       |
|      |   +-- push()                                         |
|      |   +-- pull()                                         |
|      |                                                       |
|      +-- Branch Operations                                   |
|      |   +-- createBranch()                                 |
|      |   +-- deleteBranch()                                 |
|      |   +-- listBranches()                                 |
|      |                                                       |
|      +-- GitHub Integration                                  |
|          +-- createPR()                                     |
|          +-- getPRStatus()                                  |
|                                                              |
+-------------------------------------------------------------+
```

## Core Types

### GitStatus

```typescript
interface GitStatus {
  branch: string;
  remote_branch?: string;

  // Diff from remote
  ahead: number;
  behind: number;

  // Working directory status
  staged: FileChange[];
  modified: FileChange[];
  untracked: string[];
  deleted: string[];

  // Clean state
  is_clean: boolean;
}

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  old_path?: string;  // For renames
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

## Service Interface

### GitService

```typescript
class GitService {
  // Worktree Management
  async createWorktree(
    repoPath: string,
    worktreePath: string,
    branch: string,
    baseBranch?: string
  ): Promise<WorktreeInfo>;

  async removeWorktree(worktreePath: string, force?: boolean): Promise<void>;

  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]>;

  // Basic Operations
  async status(workingDir: string): Promise<GitStatus>;
  async add(workingDir: string, paths: string[]): Promise<void>;
  async addAll(workingDir: string): Promise<void>;
  async commit(workingDir: string, message: string, options?: CommitOptions): Promise<CommitResult>;
  async push(workingDir: string, options?: PushOptions): Promise<void>;
  async pull(workingDir: string, options?: PullOptions): Promise<void>;
  async diff(workingDir: string, options?: DiffOptions): Promise<string>;

  // Branch Operations
  async createBranch(workingDir: string, name: string, startPoint?: string): Promise<void>;
  async deleteBranch(workingDir: string, name: string, options?: DeleteBranchOptions): Promise<void>;
  async listBranches(workingDir: string, options?: ListBranchesOptions): Promise<BranchInfo[]>;
  async checkout(workingDir: string, branch: string): Promise<void>;
  async currentBranch(workingDir: string): Promise<string>;

  // GitHub Integration (using gh CLI)
  async createPR(workingDir: string, options: CreatePROptions): Promise<PRInfo>;
  async getPRStatus(workingDir: string, prNumber: number): Promise<PRInfo>;
  async listPRs(workingDir: string, options?: ListPRsOptions): Promise<PRInfo[]>;

  // Utilities
  async isGitRepo(path: string): Promise<boolean>;
  async getRepoRoot(path: string): Promise<string>;
  async getRemoteUrl(workingDir: string, remote?: string): Promise<string | null>;
  async getDefaultBranch(workingDir: string): Promise<string>;
}
```

### Type Definitions

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

## Git Worktree Commands

The module uses native Git commands for worktree management:

```bash
# Create worktree (existing branch)
git worktree add <path> <branch>

# Create worktree (new branch)
git worktree add -b <new-branch> <path> <start-point>

# List worktrees
git worktree list --porcelain

# Remove worktree
git worktree remove <path>

# Force remove
git worktree remove --force <path>
```

## GitHub CLI Integration

GitHub operations use the `gh` CLI tool:

```bash
# Create PR
gh pr create --title "Title" --body "Body" --base main

# Get PR status
gh pr view <number> --json number,title,state,url,mergeable

# List PRs
gh pr list --json number,title,state,url --limit 20
```

## API Routes

Git operations are exposed through the workspace API:

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

## Error Handling

```typescript
class GitError extends Error {
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

enum GitErrorCode {
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

## Usage Examples

### Create a Worktree for a Task

```typescript
const gitService = new GitService();

// Create worktree with new branch
const worktree = await gitService.createWorktree(
  '/path/to/repo',
  '/path/to/repo/.worktrees/feature-login',
  'kanban/feature-login',
  'main'
);

console.log(`Created worktree at ${worktree.path}`);
console.log(`Branch: ${worktree.branch}`);
```

### Check Status and Commit

```typescript
// Get status
const status = await gitService.status('/path/to/worktree');
console.log(`On branch: ${status.branch}`);
console.log(`Modified files: ${status.modified.length}`);
console.log(`Is clean: ${status.is_clean}`);

// Stage and commit
if (!status.is_clean) {
  await gitService.addAll('/path/to/worktree');
  const result = await gitService.commit(
    '/path/to/worktree',
    'feat: implement login feature'
  );
  console.log(`Committed: ${result.commit}`);
}
```

### Create a Pull Request

```typescript
// Push branch first
await gitService.push('/path/to/worktree', {
  set_upstream: true
});

// Create PR
const pr = await gitService.createPR('/path/to/worktree', {
  title: 'Add login feature',
  body: 'Implements JWT-based authentication',
  base: 'main',
  draft: false,
  reviewers: ['teammate1', 'teammate2']
});

console.log(`PR created: ${pr.url}`);
```

### Clean Up Worktree

```typescript
// Remove worktree when done
await gitService.removeWorktree('/path/to/worktree');

// Or force remove if there are uncommitted changes
await gitService.removeWorktree('/path/to/worktree', true);
```

## Related Documentation

- [Workspaces](./workspaces.md) - Workspace management
- [Storage System](./storage.md) - File storage design
