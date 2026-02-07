# Vibe-Kanban Frontend Architecture

> Deep analysis of the vibe-kanban frontend codebase at `/Users/lxy/Documents/GitHub/others/vibe-kanban`

---

## Executive Summary

Vibe-Kanban is a kanban-style task management application with AI coding agent integration. The frontend is built with React 18, TypeScript, and follows a modern architecture with:

- **TanStack Query** for REST API state management
- **WebSocket streaming** with JSON Patch (RFC 6902) for real-time updates
- **Zustand** for client-side UI state
- **Electric SQL** for optimistic mutations with sync
- A centralized API layer (`frontend/src/lib/api.ts`)

The application manages tasks, workspaces (task attempts), sessions, execution processes, and integrates with Git operations and AI coding agents.

---

## API Endpoint Reference

### Project Management APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/projects` | POST | Create new project | `frontend/src/lib/api.ts:246` |
| `/api/projects/{id}` | PUT | Update project | `frontend/src/lib/api.ts:253` |
| `/api/projects/{id}` | DELETE | Delete project | `frontend/src/lib/api.ts:261` |
| `/api/projects/{id}/open-editor` | POST | Open project in IDE | `frontend/src/lib/api.ts:268` |
| `/api/projects/{id}/search` | GET | Search files in project | `frontend/src/lib/api.ts:279` |
| `/api/projects/{projectId}/repositories` | GET | Get project repositories | `frontend/src/lib/api.ts:293` |
| `/api/projects/{projectId}/repositories` | POST | Add repository to project | `frontend/src/lib/api.ts:300` |
| `/api/projects/{projectId}/repositories/{repoId}` | DELETE | Remove repository | `frontend/src/lib/api.ts:314` |
| `/api/projects/stream/ws` | WebSocket | Stream all projects (real-time) | `frontend/src/hooks/useProjects.ts:18` |

### Task Management APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/tasks/{taskId}` | GET | Get task by ID | `frontend/src/lib/api.ts:330` |
| `/api/tasks` | POST | Create new task | `frontend/src/lib/api.ts:335` |
| `/api/tasks/create-and-start` | POST | Create and immediately start task | `frontend/src/lib/api.ts:343` |
| `/api/tasks/{taskId}` | PUT | Update task | `frontend/src/lib/api.ts:353` |
| `/api/tasks/{taskId}` | DELETE | Delete task | `frontend/src/lib/api.ts:361` |
| `/api/tasks/stream/ws?project_id={id}` | WebSocket | Stream project tasks (real-time) | `frontend/src/hooks/useProjectTasks.ts:24` |

### Session APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/sessions?workspace_id={id}` | GET | Get sessions by workspace | `frontend/src/lib/api.ts:371` |
| `/api/sessions/{sessionId}` | GET | Get session by ID | `frontend/src/lib/api.ts:378` |
| `/api/sessions` | POST | Create new session | `frontend/src/lib/api.ts:383` |
| `/api/sessions/{sessionId}/follow-up` | POST | Send follow-up message | `frontend/src/lib/api.ts:394` |
| `/api/sessions/{sessionId}/review` | POST | Start code review | `frontend/src/lib/api.ts:405` |
| `/api/sessions/{sessionId}/reset` | POST | Reset session | `frontend/src/lib/api.ts:416` |
| `/api/sessions/{sessionId}/queue` | POST | Queue follow-up message | `frontend/src/lib/api.ts:1393` |
| `/api/sessions/{sessionId}/queue` | DELETE | Cancel queued message | `frontend/src/lib/api.ts:1407` |
| `/api/sessions/{sessionId}/queue` | GET | Get queue status | `frontend/src/lib/api.ts:1417` |

### Workspace (Task Attempt) APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/task-attempts?task_id={id}` | GET | Get all workspaces for task | `frontend/src/lib/api.ts:437` |
| `/api/task-attempts` | GET | Get all workspaces | `frontend/src/lib/api.ts:443` |
| `/api/task-attempts/count` | GET | Get workspace count | `frontend/src/lib/api.ts:449` |
| `/api/task-attempts/{attemptId}` | GET | Get workspace by ID | `frontend/src/lib/api.ts:454` |
| `/api/task-attempts/{attemptId}` | PUT | Update workspace (archive/pin/name) | `frontend/src/lib/api.ts:459` |
| `/api/task-attempts` | POST | Create new workspace | `frontend/src/lib/api.ts:479` |
| `/api/task-attempts/{attemptId}/stop` | POST | Stop execution | `frontend/src/lib/api.ts:487` |
| `/api/task-attempts/{attemptId}` | DELETE | Delete workspace | `frontend/src/lib/api.ts:494` |
| `/api/task-attempts/{attemptId}/children` | GET | Get child task relationships | `frontend/src/lib/api.ts:430` |
| `/api/task-attempts/{attemptId}/link` | POST | Link to GitHub issue | `frontend/src/lib/api.ts:510` |
| `/api/task-attempts/{attemptId}/unlink` | POST | Unlink from issue | `frontend/src/lib/api.ts:525` |
| `/api/task-attempts/{attemptId}/run-agent-setup` | POST | Run agent setup | `frontend/src/lib/api.ts:533` |
| `/api/task-attempts/{attemptId}/open-editor` | POST | Open in IDE | `frontend/src/lib/api.ts:547` |
| `/api/task-attempts/{attemptId}/branch-status` | GET | Get branch status | `frontend/src/lib/api.ts:561` |
| `/api/task-attempts/{attemptId}/repos` | GET | Get workspace repos | `frontend/src/lib/api.ts:568` |
| `/api/task-attempts/{attemptId}/first-message` | GET | Get first user message | `frontend/src/lib/api.ts:573` |
| `/api/task-attempts/{attemptId}/merge` | POST | Merge branches | `frontend/src/lib/api.ts:580` |
| `/api/task-attempts/{attemptId}/push` | POST | Push to remote | `frontend/src/lib/api.ts:594` |
| `/api/task-attempts/{attemptId}/push/force` | POST | Force push | `frontend/src/lib/api.ts:605` |
| `/api/task-attempts/{attemptId}/rebase` | POST | Rebase branch | `frontend/src/lib/api.ts:619` |
| `/api/task-attempts/{attemptId}/change-target-branch` | POST | Change target branch | `frontend/src/lib/api.ts:633` |
| `/api/task-attempts/{attemptId}/rename-branch` | POST | Rename branch | `frontend/src/lib/api.ts:647` |
| `/api/task-attempts/{attemptId}/conflicts/abort` | POST | Abort conflicts | `frontend/src/lib/api.ts:664` |
| `/api/task-attempts/{attemptId}/rebase/continue` | POST | Continue rebase | `frontend/src/lib/api.ts:678` |
| `/api/task-attempts/{attemptId}/pr` | POST | Create pull request | `frontend/src/lib/api.ts:692` |
| `/api/task-attempts/{attemptId}/start-dev-server` | POST | Start dev server | `frontend/src/lib/api.ts:703` |
| `/api/task-attempts/{attemptId}/gh-cli-setup` | POST | Setup GitHub CLI | `frontend/src/lib/api.ts:713` |
| `/api/task-attempts/{attemptId}/run-setup-script` | POST | Run setup script | `frontend/src/lib/api.ts:723` |
| `/api/task-attempts/{attemptId}/run-cleanup-script` | POST | Run cleanup script | `frontend/src/lib/api.ts:737` |
| `/api/task-attempts/{attemptId}/run-archive-script` | POST | Run archive script | `frontend/src/lib/api.ts:751` |
| `/api/task-attempts/{attemptId}/pr/comments` | GET | Get PR comments | `frontend/src/lib/api.ts:765` |
| `/api/task-attempts/{attemptId}/mark-seen` | PUT | Mark turns as seen | `frontend/src/lib/api.ts:776` |
| `/api/task-attempts/from-pr` | POST | Create workspace from PR | `frontend/src/lib/api.ts:787` |
| `/api/task-attempts/summary` | POST | Get workspace summaries | `frontend/src/components/ui-new/hooks/useWorkspaces.ts:93` |
| `/api/task-attempts/{attemptId}/images/upload` | POST | Upload image to workspace | `frontend/src/lib/api.ts:1111` |
| `/api/task-attempts/stream/ws?archived={bool}` | WebSocket | Stream workspaces (real-time) | `frontend/src/components/ui-new/hooks/useWorkspaces.ts:123-124` |
| `/api/task-attempts/{attemptId}/diff/ws` | WebSocket | Stream file diffs | `frontend/src/hooks/useDiffStream.ts:30` |

### Execution Process APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/execution-processes/{processId}` | GET | Get process details | `frontend/src/lib/api.ts:803` |
| `/api/execution-processes/{processId}/repo-states` | GET | Get repo states | `frontend/src/lib/api.ts:808` |
| `/api/execution-processes/{processId}/stop` | POST | Stop execution | `frontend/src/lib/api.ts:817` |
| `/api/execution-processes/stream/session/ws?session_id={id}` | WebSocket | Stream execution processes | `frontend/src/hooks/useExecutionProcesses.ts:35` |
| `/api/execution-processes/{processId}/raw-logs/ws` | WebSocket | Stream raw logs | `frontend/src/hooks/useLogStream.ts:39` |
| `/api/execution-processes/{processId}/normalized-logs/ws` | WebSocket | Stream normalized conversation logs | `frontend/src/components/ui-new/hooks/useConversationHistory.ts:107` |

### Repository APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/repos` | GET | List all repos | `frontend/src/lib/api.ts:849` |
| `/api/repos/{repoId}` | GET | Get repo by ID | `frontend/src/lib/api.ts:854` |
| `/api/repos/{repoId}` | PUT | Update repo | `frontend/src/lib/api.ts:859` |
| `/api/repos` | POST | Register new repo | `frontend/src/lib/api.ts:867` |
| `/api/repos/{repoId}/branches` | GET | Get repo branches | `frontend/src/lib/api.ts:878` |
| `/api/repos/init` | POST | Initialize new repo | `frontend/src/lib/api.ts:883` |
| `/api/repos/batch` | POST | Get multiple repos by IDs | `frontend/src/lib/api.ts:894` |
| `/api/repos/{repoId}/open-editor` | POST | Open in IDE | `frontend/src/lib/api.ts:902` |
| `/api/repos/{repoId}/search` | GET | Search files | `frontend/src/lib/api.ts:913` |
| `/api/repos/{repoId}/prs` | GET | List open PRs | `frontend/src/lib/api.ts:927` |
| `/api/repos/{repoId}/remotes` | GET | List Git remotes | `frontend/src/lib/api.ts:938` |

### Configuration APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/info` | GET | Get user system info | `frontend/src/lib/api.ts:946` |
| `/api/config` | PUT | Save config | `frontend/src/lib/api.ts:950` |
| `/api/editors/check-availability` | GET | Check IDE availability | `frontend/src/lib/api.ts:957` |
| `/api/agents/check-availability` | GET | Check agent availability | `frontend/src/lib/api.ts:965` |
| `/api/agents/slash-commands/ws` | WebSocket | Stream slash commands | `frontend/src/lib/api.ts:1375` |

### Tags APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/tags` | GET | List tags | `frontend/src/lib/api.ts:977` |
| `/api/tags` | POST | Create tag | `frontend/src/lib/api.ts:985` |
| `/api/tags/{tagId}` | PUT | Update tag | `frontend/src/lib/api.ts:993` |
| `/api/tags/{tagId}` | DELETE | Delete tag | `frontend/src/lib/api.ts:1001` |

### MCP (Model Context Protocol) APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/mcp-config` | GET | Load MCP server config | `frontend/src/lib/api.ts:1011` |
| `/api/mcp-config` | POST | Save MCP server config | `frontend/src/lib/api.ts:1016` |

### Profiles API

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/profiles` | GET | Load profiles | `frontend/src/lib/api.ts:1045` |
| `/api/profiles` | PUT | Save profiles | `frontend/src/lib/api.ts:1049` |

### Images API

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/images/upload` | POST | Upload image | `frontend/src/lib/api.ts:1063` |
| `/api/images/task/{taskId}/upload` | POST | Upload for task | `frontend/src/lib/api.ts:1085` |
| `/api/images/{imageId}` | DELETE | Delete image | `frontend/src/lib/api.ts:1139` |
| `/api/images/task/{taskId}` | GET | Get task images | `frontend/src/lib/api.ts:1146` |
| `/api/images/{imageId}/file` | GET | Get image file | `frontend/src/lib/api.ts:1151` |

### Approval API

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/approvals/{approvalId}/respond` | POST | Respond to approval request | `frontend/src/lib/api.ts:1158` |

### Authentication APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/auth/handoff/init` | POST | Initialize OAuth handoff | `frontend/src/lib/api.ts:1176` |
| `/api/auth/status` | GET | Check auth status | `frontend/src/lib/api.ts:1189` |
| `/api/auth/logout` | POST | Logout | `frontend/src/lib/api.ts:1196` |
| `/api/auth/token` | GET | Get access token | `frontend/src/lib/api.ts:1210` |
| `/api/auth/user` | GET | Get current user | `frontend/src/lib/api.ts:1217` |

### Organization APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/organizations` | GET | Get user's organizations | `frontend/src/lib/api.ts:1242` |
| `/api/organizations` | POST | Create organization | `frontend/src/lib/api.ts:1247` |
| `/api/organizations/{orgId}` | DELETE | Delete organization | `frontend/src/lib/api.ts:1323` |
| `/api/organizations/{orgId}/members` | GET | Get org members | `frontend/src/lib/api.ts:1234` |
| `/api/organizations/{orgId}/members/{userId}` | DELETE | Remove member | `frontend/src/lib/api.ts:1273` |
| `/api/organizations/{orgId}/members/{userId}/role` | PATCH | Update member role | `frontend/src/lib/api.ts:1283` |
| `/api/organizations/{orgId}/invitations` | GET | List invitations | `frontend/src/lib/api.ts:1299` |
| `/api/organizations/{orgId}/invitations` | POST | Create invitation | `frontend/src/lib/api.ts:1258` |
| `/api/organizations/{orgId}/invitations/revoke` | POST | Revoke invitation | `frontend/src/lib/api.ts:1307` |

### Scratch (Notes) API

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/scratch/{type}/{id}` | POST | Create scratch | `frontend/src/lib/api.ts:1333` |
| `/api/scratch/{type}/{id}` | GET | Get scratch | `frontend/src/lib/api.ts:1345` |
| `/api/scratch/{type}/{id}` | PUT | Update scratch | `frontend/src/lib/api.ts:1350` |
| `/api/scratch/{type}/{id}` | DELETE | Delete scratch | `frontend/src/lib/api.ts:1362` |
| `/api/scratch/{type}/{id}/stream/ws` | WebSocket | Stream scratch updates | `frontend/src/lib/api.ts:1369` |

### File System APIs

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/filesystem/directory` | GET | List directory | `frontend/src/lib/api.ts:830` |
| `/api/filesystem/git-repos` | GET | List Git repos | `frontend/src/lib/api.ts:838` |

### Search API

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/search` | GET | Multi-repo file search | `frontend/src/lib/api.ts:1436` |

### Migration API

| Endpoint | Method | Purpose | File Location |
|----------|--------|---------|---------------|
| `/api/migration/start` | POST | Start migration | `frontend/src/lib/api.ts:1425` |

---

## Hooks Reference

### Core Data Hooks (using useQuery/useMutation)

| Hook | File Path | API Dependencies |
|------|-----------|------------------|
| `useTask` | `frontend/src/hooks/useTask.ts` | `tasksApi.getById` |
| `useTaskMutations` | `frontend/src/hooks/useTaskMutations.ts` | `tasksApi.create/update/delete/createAndStart` |
| `useAttempt` | `frontend/src/hooks/useAttempt.ts` | `attemptsApi.get` |
| `useWorkspaceMutations` | `frontend/src/hooks/useWorkspaceMutations.ts` | `attemptsApi.update/delete` |
| `useApprovalMutation` | `frontend/src/hooks/useApprovalMutation.ts` | `approvalsApi.respond` |
| `useAuthStatus` | `frontend/src/hooks/auth/useAuthStatus.ts` | `oauthApi.status` |
| `useOrganizationMutations` | `frontend/src/hooks/useOrganizationMutations.ts` | `organizationsApi.*` |
| `useCreateSession` | `frontend/src/hooks/useCreateSession.ts` | `sessionsApi.create` |
| `usePush` | `frontend/src/hooks/usePush.ts` | `attemptsApi.push` |
| `useForcePush` | `frontend/src/hooks/useForcePush.ts` | `attemptsApi.forcePush` |
| `useRebase` | `frontend/src/hooks/useRebase.ts` | `attemptsApi.rebase` |
| `useMerge` | `frontend/src/hooks/useMerge.ts` | `attemptsApi.merge` |

### Real-Time Streaming Hooks (using WebSocket)

| Hook | File Path | WebSocket Endpoint |
|------|-----------|-------------------|
| `useProjects` | `frontend/src/hooks/useProjects.ts` | `/api/projects/stream/ws` |
| `useProjectTasks` | `frontend/src/hooks/useProjectTasks.ts` | `/api/tasks/stream/ws?project_id={id}` |
| `useWorkspaces` | `frontend/src/components/ui-new/hooks/useWorkspaces.ts` | `/api/task-attempts/stream/ws?archived={bool}` |
| `useExecutionProcesses` | `frontend/src/hooks/useExecutionProcesses.ts` | `/api/execution-processes/stream/session/ws?session_id={id}` |
| `useDiffStream` | `frontend/src/hooks/useDiffStream.ts` | `/api/task-attempts/{attemptId}/diff/ws` |
| `useLogStream` | `frontend/src/hooks/useLogStream.ts` | `/api/execution-processes/{processId}/raw-logs/ws` |
| `useConversationHistory` | `frontend/src/components/ui-new/hooks/useConversationHistory.ts` | `/api/execution-processes/{processId}/normalized-logs/ws` |
| `useJsonPatchWsStream` | `frontend/src/hooks/useJsonPatchWsStream.ts` | Generic WebSocket hook |

### UI/Navigation Hooks

| Hook | File Path | Purpose |
|------|-----------|---------|
| `useGitOperations` | `frontend/src/hooks/useGitOperations.ts` | Orchestrates rebase/merge/push/forcePush |
| `useSessionSend` | `frontend/src/hooks/useSessionSend.ts` | Send messages (new/follow-up) |
| `useFollowUpSend` | `frontend/src/hooks/useFollowUpSend.ts` | Send follow-up with conflict/review context |
| `useAttemptExecution` | `frontend/src/hooks/useAttemptExecution.ts` | Execution process management |
| `useAuth` | `frontend/src/hooks/auth/useAuth.ts` | Authentication state |

---

## Data Flow Diagram

```
+------------------+     +------------------+     +------------------+
|   React Query    |     |    WebSocket     |     |     Zustand      |
|  (REST APIs)     |     |   (Real-time)    |     |   (UI State)     |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+--------+---------+     +--------+---------+     +--------+---------+
| useTask          |     | useJsonPatchWs   |     | useUiPreferences |
| useTaskMutations |     | Stream (generic) |     | Store            |
| useAttempt       |     |                  |     |                  |
| usePush/Merge... |     | useProjects      |     | Panel states     |
+--------+---------+     | useProjectTasks  |     | Kanban filters   |
         |               | useWorkspaces    |     | Expanded states  |
         |               | useExecution-    |     +--------+---------+
         |               |   Processes      |              |
         |               | useDiffStream    |              |
         |               | useLogStream     |              |
         v               +--------+---------+              |
         |                        |                        |
         +------------------------+------------------------+
                                  |
                                  v
                        +------------------+
                        |   Components     |
                        | (React UI)       |
                        +------------------+
                                  |
                                  v
                        +------------------+
                        | Electric SQL     |
                        | (useShape hook)  |
                        | Optimistic sync  |
                        +------------------+
```

---

## Real-Time Features (WebSocket Endpoints)

All WebSocket endpoints use JSON Patch (RFC 6902) for incremental updates:

1. **Projects Stream** (`/api/projects/stream/ws`)
   - Streams all projects with add/update/remove operations
   - Used by `useProjects` hook

2. **Tasks Stream** (`/api/tasks/stream/ws?project_id={id}`)
   - Streams tasks for a specific project
   - Used by `useProjectTasks` hook

3. **Workspaces Stream** (`/api/task-attempts/stream/ws?archived={bool}`)
   - Two connections: active and archived workspaces
   - Used by `useWorkspaces` hook

4. **Execution Processes Stream** (`/api/execution-processes/stream/session/ws?session_id={id}`)
   - Streams execution process updates for a session
   - Used by `useExecutionProcesses` hook

5. **Diff Stream** (`/api/task-attempts/{attemptId}/diff/ws`)
   - Streams file diff changes
   - Used by `useDiffStream` hook

6. **Raw Logs Stream** (`/api/execution-processes/{processId}/raw-logs/ws`)
   - Streams STDOUT/STDERR for script processes
   - Used by `useLogStream` hook

7. **Normalized Logs Stream** (`/api/execution-processes/{processId}/normalized-logs/ws`)
   - Streams conversation entries (user messages, tool calls, etc.)
   - Used by `useConversationHistory` hook

8. **Scratch/Notes Stream** (`/api/scratch/{type}/{id}/stream/ws`)
   - Streams workspace notes updates

9. **Slash Commands Stream** (`/api/agents/slash-commands/ws`)
   - Streams available slash commands for agents

---

## State Management

### 1. TanStack Query (Server State)

- **Location**: `frontend/src/main.tsx:59-76`
- **Configuration**:
  - `staleTime`: 5 minutes
  - `refetchOnWindowFocus`: false
  - Custom error logging via QueryCache

### 2. Zustand (Client UI State)

**Store Files**:
- `frontend/src/stores/useUiPreferencesStore.ts` - Main UI state
- `frontend/src/stores/useDiffViewStore.ts` - Diff view state
- `frontend/src/stores/useExpandableStore.ts` - Expandable sections
- `frontend/src/stores/useOrganizationStore.ts` - Organization selection
- `frontend/src/stores/useTaskDetailsUiStore.ts` - Task details UI

**Main UI Store Features**:
- Layout mode (workspaces/kanban/migrate)
- Panel visibility (left/right sidebars, terminal)
- Workspace-specific panel states
- Kanban filters (search, priorities, assignees, tags, sort)
- Collapsed paths for file trees
- Pane sizes

### 3. Electric SQL (Optimistic Sync)

- **Location**: `frontend/src/lib/electric/hooks.ts`
- **Purpose**: Provides optimistic mutations with eventual consistency
- **Pattern**: `useShape` hook for subscribed data with insert/update/remove operations
- **Features**:
  - Immediate UI updates (optimistic)
  - Returns `persisted` promise for sync confirmation
  - Error handling via SyncErrorContext

### 4. WebSocket JSON Patch Streaming

- **Core Utility**: `frontend/src/utils/streamJsonPatchEntries.ts`
- **Generic Hook**: `frontend/src/hooks/useJsonPatchWsStream.ts`
- **Pattern**:
  1. Server sends initial snapshot via JSON Patch `add` operations
  2. Live updates arrive as `add`/`replace`/`remove` operations
  3. `finished` message signals stream completion
  4. Automatic reconnection with exponential backoff

---

## Key Files Summary

| Category | Key Files |
|----------|-----------|
| API Layer | `frontend/src/lib/api.ts` |
| Main Entry | `frontend/src/main.tsx` |
| Hooks Directory | `frontend/src/hooks/` |
| Stores Directory | `frontend/src/stores/` |
| WebSocket Utilities | `frontend/src/utils/streamJsonPatchEntries.ts`, `frontend/src/hooks/useJsonPatchWsStream.ts` |
| Electric SQL | `frontend/src/lib/electric/hooks.ts` |
| Types | `shared/types` (external package) |

---

## Error Handling Patterns

1. **API Errors**: Custom `ApiError` class with status code, response, and typed error data
2. **Result Types**: `Result<T, E>` pattern for endpoints needing typed errors (Git operations, PR creation)
3. **Query Errors**: Logged via QueryCache `onError` callback
4. **WebSocket Errors**: Exponential backoff retry (1s, 2s, 4s, 8s max)
5. **Sync Errors**: `SyncErrorContext` for Electric SQL error tracking

---

## API Categories Summary

| Category | REST Endpoints | WebSocket Endpoints |
|----------|----------------|---------------------|
| Projects | 8 | 1 |
| Tasks | 5 | 1 |
| Sessions | 9 | 0 |
| Task Attempts (Workspaces) | 30+ | 2 |
| Execution Processes | 3 | 3 |
| Repositories | 11 | 0 |
| Configuration | 4 | 1 |
| Tags | 4 | 0 |
| Images | 5 | 0 |
| Authentication | 5 | 0 |
| Organizations | 9 | 0 |
| Scratch/Notes | 4 | 1 |
| File System | 2 | 0 |
| **Total** | **100+** | **9** |
