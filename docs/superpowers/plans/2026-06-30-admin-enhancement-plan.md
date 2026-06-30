# Admin 端功能完善实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善 Viben Web 管理后台：用户管理增强（警告/封禁/角色管理）、内容审核（评论/合集）、管理员管理

**Architecture:** 遵循现有模式 — API routes 使用 `requirePermission` 鉴权，页面使用服务端组件 + 客户端委托组件，所有审核操作记录到 `moderationLogs`

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PostgreSQL, Zod, Tailwind v4, shadcn/ui

## Global Constraints

- 所有 API 查询参数使用 snake_case
- 禁止 inline import type 语法，使用顶层 import
- 编辑文件使用绝对路径
- 禁止从项目根目录运行 `pnpm build` / `pnpm typecheck`
- 运行 typecheck: `cd apps/web && pnpm typecheck`
- DB schema 变更后运行: `cd apps/web && pnpm db:push`（需手动交互确认）

## 文件变更地图

| 文件 | 操作 | 职责 |
|------|------|------|
| `lib/db/schema.ts` | 修改 | users 表新增 banned_at/banned_reason/warned_at/warned_reason |
| `app/api/admin/users/[id]/ban/route.ts` | 创建 | ban/unban API |
| `app/api/admin/users/[id]/warn/route.ts` | 创建 | warn API |
| `app/api/admin/users/[id]/role/route.ts` | 修改 | 扩展 role 枚举支持管理角色 |
| `components/admin/users/user-table.tsx` | 修改 | 新增状态列 + ban/warn/管理角色按钮 |
| `components/admin/users/user-management.tsx` | 修改 | 新增 ban/warn handler |
| `app/api/admin/comments/route.ts` | 创建 | 评论列表 API |
| `app/api/admin/comments/[id]/route.ts` | 创建 | 删除评论 API |
| `components/admin/comments/comment-moderation.tsx` | 创建 | 评论审核 UI |
| `components/admin/comments/index.ts` | 创建 | barrel export |
| `app/(admin)/admin/comments/page.tsx` | 创建 | 评论审核页 |
| `app/api/admin/collections/route.ts` | 创建 | 合集列表 API |
| `app/api/admin/collections/[id]/route.ts` | 创建 | 删除合集 API |
| `components/admin/collections/collection-moderation.tsx` | 创建 | 合集审核 UI |
| `components/admin/collections/index.ts` | 创建 | barrel export |
| `app/(admin)/admin/collections/page.tsx` | 创建 | 合集审核页 |
| `components/layout/sidebar.tsx` | 修改 | 新增评论/合集管理入口 |
| `lib/navigation/route-registry.ts` | 修改 | 注册新路由 |

---

### Task 1: 数据库 Schema — users 表新增封禁/警告字段

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\db\schema.ts`

**Interfaces:**
- Produces: `users.banned_at`, `users.banned_reason`, `users.warned_at`, `users.warned_reason` 字段可供所有后续任务使用

- [ ] **Step 1: 在 users 表定义中新增字段**

在 `role` 字段定义之后（约第43行 `followersCount` 之前）添加：

```typescript
    // Moderation
    bannedAt: timestamp('banned_at'),
    bannedReason: text('banned_reason'),
    warnedAt: timestamp('warned_at'),
    warnedReason: text('warned_reason'),
```

- [ ] **Step 2: 推送数据库变更**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm db:push
```

需要手动确认 schema 变更。确认输出显示 `banned_at`, `banned_reason`, `warned_at`, `warned_reason` 列被添加。

- [ ] **Step 3: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 2: 用户封禁/解封 API

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\users\[id]\ban\route.ts`

**Interfaces:**
- Consumes: `users.banned_at`, `users.banned_reason` from DB schema (Task 1)
- Produces: `POST /api/admin/users/[id]/ban` — `{ action: 'ban' | 'unban', reason?: string }` → `{ success: true }`

- [ ] **Step 1: 创建 API 路由文件**

```typescript
/**
 * Admin User Ban/Unban API
 *
 * POST /api/admin/users/[id]/ban - Ban or unban a user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const banSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().optional(),
});

/**
 * POST /api/admin/users/[id]/ban
 *
 * Ban or unban a user.
 *
 * Body:
 * - action: 'ban' | 'unban'
 * - reason: string (optional, for audit log; required for ban)
 *
 * Required permission: users.ban
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'users.ban');
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = banSchema.parse(body);

    // Get the target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-ban
    if (targetUser.id === session.userId) {
      return NextResponse.json(
        { error: 'Cannot ban/unban yourself' },
        { status: 403 }
      );
    }

    // Prevent banning super_admin
    if (targetUser.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot ban a super admin' },
        { status: 403 }
      );
    }

    if (action === 'ban') {
      if (!reason) {
        return NextResponse.json(
          { error: 'Reason is required for ban' },
          { status: 400 }
        );
      }
      await db
        .update(users)
        .set({
          bannedAt: new Date(),
          bannedReason: reason,
        })
        .where(eq(users.id, id));
    } else {
      await db
        .update(users)
        .set({
          bannedAt: null,
          bannedReason: null,
        })
        .where(eq(users.id, id));
    }

    // Log the moderation action
    await createModerationLog({
      adminId: session.userId,
      entityType: 'user',
      entityId: id,
      action,
      reason: reason || `User ${action}ned`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Ban user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 3: 用户警告 API

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\users\[id]\warn\route.ts`

**Interfaces:**
- Consumes: `users.warned_at`, `users.warned_reason` from DB schema (Task 1)
- Produces: `POST /api/admin/users/[id]/warn` — `{ reason: string }` → `{ success: true }`

- [ ] **Step 1: 创建 API 路由文件**

```typescript
/**
 * Admin User Warn API
 *
 * POST /api/admin/users/[id]/warn - Send a warning to a user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const warnSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * POST /api/admin/users/[id]/warn
 *
 * Send a warning to a user.
 *
 * Body:
 * - reason: string (required)
 *
 * Required permission: users.warn
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'users.warn');
    const { id } = await params;
    const body = await request.json();
    const { reason } = warnSchema.parse(body);

    // Get the target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-warn
    if (targetUser.id === session.userId) {
      return NextResponse.json(
        { error: 'Cannot warn yourself' },
        { status: 403 }
      );
    }

    await db
      .update(users)
      .set({
        warnedAt: new Date(),
        warnedReason: reason,
      })
      .where(eq(users.id, id));

    // Log the moderation action
    await createModerationLog({
      adminId: session.userId,
      entityType: 'user',
      entityId: id,
      action: 'warn',
      reason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Warn user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 4: 扩展角色变更 API 支持管理角色

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\users\[id]\role\route.ts`

**Interfaces:**
- Modifies: `updateRoleSchema` 从 `z.enum(['user', 'developer'])` 扩展为 `z.enum(['user', 'developer', 'support', 'moderator', 'admin'])`
- Modifies: 角色变更逻辑 — `super_admin`/`admin` 可设置管理角色

- [ ] **Step 1: 修改 role route**

将 `updateRoleSchema` 从：
```typescript
const updateRoleSchema = z.object({
  role: z.enum(['user', 'developer']),
  reason: z.string().optional(),
});
```

改为：
```typescript
const updateRoleSchema = z.object({
  role: z.enum(['user', 'developer', 'support', 'moderator', 'admin']),
  reason: z.string().optional(),
});
```

将角色保护逻辑（`adminRoles` 检查）从阻止改为允许 `super_admin`/`admin` 操作：

找到这段代码（约58-65行）：
```typescript
    // Prevent changing admin roles
    const adminRoles = ['admin', 'super_admin', 'moderator', 'support'];
    if (adminRoles.includes(targetUser.role)) {
      return NextResponse.json(
        { error: 'Cannot change role of admin users through this endpoint' },
        { status: 403 }
      );
    }
```

替换为：
```typescript
    // Only super_admin/admin can manage admin roles
    const adminRoles = ['admin', 'super_admin', 'moderator', 'support'];
    const isSuperAdmin = session.role === 'super_admin' || session.role === 'admin';

    if (adminRoles.includes(targetUser.role) && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admin can change admin roles' },
        { status: 403 }
      );
    }

    // Prevent changing super_admin role (highest protection)
    if (targetUser.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot change super admin role' },
        { status: 403 }
      );
    }

    // Non-super-admin can only set user/developer
    if (!isSuperAdmin && adminRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Cannot assign admin roles' },
        { status: 403 }
      );
    }
```

同时更新 moderationLog 的 action 值，当前硬编码 `action: role === 'user' ? 'ban' : 'unban'` 不合理，改为始终使用适当的 action：

```typescript
    // Log the action
    await db.insert(moderationLogs).values({
      adminId: session.userId,
      entityType: 'user',
      entityId: id,
      action: adminRoles.includes(role) ? 'unban' : role === 'user' ? 'ban' : 'unban',
      reason: reason || `Role changed from ${targetUser.role} to ${role}`,
      metadata: {
        previousRole: targetUser.role,
        newRole: role,
      },
    });
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 5: UserTable UI — 状态列 + 操作按钮扩展

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\admin\users\user-table.tsx`

**Interfaces:**
- Modifies: `UserTableProps` — 扩展 `onRoleUpdate` 签名为 `(userId: string, newRole: string) => Promise<boolean>`，新增 `onBan`, `onUnban`, `onWarn` props
- Modifies: `User` interface 新增 `bannedAt`, `warnedAt` 字段

- [ ] **Step 1: 重写 UserTable 组件**

```typescript
'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Ban, CheckCircle } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  bannedAt: string | null;
  warnedAt: string | null;
}

interface UserTableProps {
  users: User[];
  currentUserRole: string;
  onRoleUpdate: (userId: string, newRole: string) => Promise<boolean>;
  onBan: (userId: string, reason: string) => Promise<boolean>;
  onUnban: (userId: string) => Promise<boolean>;
  onWarn: (userId: string, reason: string) => Promise<boolean>;
}

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  developer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  support: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  moderator: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  super_admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const ROLE_LABELS: Record<string, string> = {
  user: '用户',
  developer: '开发者',
  support: '客服',
  moderator: '版主',
  admin: '管理员',
  super_admin: '超级管理员',
};

function formatDate(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserTable({ users, currentUserRole, onRoleUpdate, onBan, onUnban, onWarn }: UserTableProps) {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [banDialog, setBanDialog] = useState<{ userId: string; username: string } | null>(null);
  const [warnDialog, setWarnDialog] = useState<{ userId: string; username: string } | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const isSuperAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';
  const isAdminRole = (role: string) => {
    return ['admin', 'super_admin', 'moderator', 'support'].includes(role);
  };

  const getAvailableRoles = (targetRole: string): string[] => {
    if (targetRole === 'super_admin') return [];
    if (isSuperAdmin) {
      return ['user', 'developer', 'support', 'moderator', 'admin'];
    }
    return ['user', 'developer'];
  };

  const getStatusBadge = (user: User) => {
    if (user.bannedAt) {
      return <Badge variant="destructive">已封禁</Badge>;
    }
    if (user.warnedAt) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">已警告</Badge>;
    }
    return <Badge variant="secondary">正常</Badge>;
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const success = await onRoleUpdate(userId, newRole);
      if (success) {
        toast.success(`角色已更新为 ${ROLE_LABELS[newRole] || newRole}`);
      } else {
        toast.error('更新角色失败');
      }
    } catch {
      toast.error('更新角色失败');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleBan = async () => {
    if (!banDialog || !reason.trim()) return;
    setActing(true);
    try {
      const success = await onBan(banDialog.userId, reason.trim());
      if (success) {
        toast.success(`已封禁 ${banDialog.username}`);
        setBanDialog(null);
        setReason('');
      } else {
        toast.error('封禁失败');
      }
    } catch {
      toast.error('封禁失败');
    } finally {
      setActing(false);
    }
  };

  const handleUnban = async (userId: string) => {
    setActing(true);
    try {
      const success = await onUnban(userId);
      if (success) {
        toast.success('已解封');
      } else {
        toast.error('解封失败');
      }
    } catch {
      toast.error('解封失败');
    } finally {
      setActing(false);
    }
  };

  const handleWarn = async () => {
    if (!warnDialog || !reason.trim()) return;
    setActing(true);
    try {
      const success = await onWarn(warnDialog.userId, reason.trim());
      if (success) {
        toast.success(`已警告 ${warnDialog.username}`);
        setWarnDialog(null);
        setReason('');
      } else {
        toast.error('警告失败');
      }
    } catch {
      toast.error('警告失败');
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">用户</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>最后登录</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-sm text-muted-foreground">
                        @{user.username}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={ROLE_COLORS[user.role] || ''}
                  >
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(user)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(user.lastLoginAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Role selector — only for manageable users */}
                    {user.role !== 'super_admin' && getAvailableRoles(user.role).length > 0 && (
                      updatingUserId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableRoles(user.role).map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    )}

                    {/* Warn button */}
                    {!isAdminRole(user.role) && !user.bannedAt && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="警告"
                        onClick={() => {
                          setWarnDialog({ userId: user.id, username: user.username });
                          setReason('');
                        }}
                      >
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </Button>
                    )}

                    {/* Ban/Unban button */}
                    {user.role !== 'super_admin' && (
                      user.bannedAt ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="解封"
                          onClick={() => handleUnban(user.id)}
                          disabled={acting}
                        >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="封禁"
                          onClick={() => {
                            setBanDialog({ userId: user.id, username: user.username });
                            setReason('');
                          }}
                        >
                          <Ban className="h-4 w-4 text-red-500" />
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Ban Dialog */}
      <Dialog open={!!banDialog} onOpenChange={() => setBanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>封禁用户 @{banDialog?.username}</DialogTitle>
            <DialogDescription>
              封禁后该用户将无法登录。请填写封禁原因。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ban-reason">封禁原因</Label>
              <Textarea
                id="ban-reason"
                placeholder="请输入封禁原因..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog(null)} disabled={acting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={acting || !reason.trim()}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认封禁
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warn Dialog */}
      <Dialog open={!!warnDialog} onOpenChange={() => setWarnDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>警告用户 @{warnDialog?.username}</DialogTitle>
            <DialogDescription>
              向该用户发送警告。请填写警告原因。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="warn-reason">警告原因</Label>
              <Textarea
                id="warn-reason"
                placeholder="请输入警告原因..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarnDialog(null)} disabled={acting}>
              取消
            </Button>
            <Button variant="default" onClick={handleWarn} disabled={acting || !reason.trim()}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认警告
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 6: UserManagement — 接入 ban/warn API

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\admin\users\user-management.tsx`

**Interfaces:**
- Modifies: `User` interface 新增 `bannedAt`, `warnedAt`
- Modifies: API response 类型匹配新字段
- Modifies: `handleRoleUpdate` 扩展为可传任意角色
- Produces: `handleBan`, `handleUnban`, `handleWarn` 回调

- [ ] **Step 1: 更新 UserManagement**

对 `user-management.tsx` 做以下修改：

**1. User interface 新增字段（约18-27行）：**
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  bannedAt: string | null;
  warnedAt: string | null;
}
```

**2. 修改 `handleRoleUpdate` 签名（约134行）：**

将：
```typescript
const handleRoleUpdate = async (userId: string, newRole: 'user' | 'developer') => {
```

改为：
```typescript
const handleRoleUpdate = async (userId: string, newRole: string) => {
```

并移除函数内对 newRole 的校验（原来检查 `newRole !== 'user' && newRole !== 'developer'`），改为：
```typescript
  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }

      fetchUsers();
      return true;
    } catch {
      return false;
    }
  };
```

**3. 新增 ban/unban/warn handler（在 `handleRoleUpdate` 之后添加）：**

```typescript
  const handleBan = async (userId: string, reason: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban', reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to ban user');
      }

      fetchUsers();
      return true;
    } catch {
      return false;
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unban user');
      }

      fetchUsers();
      return true;
    } catch {
      return false;
    }
  };

  const handleWarn = async (userId: string, reason: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to warn user');
      }

      fetchUsers();
      return true;
    } catch {
      return false;
    }
  };
```

**4. 更新 `<UserTable>` 调用，传入新的 props：**

将：
```tsx
<UserTable users={users} onRoleUpdate={handleRoleUpdate} />
```

改为：
```tsx
<UserTable
  users={users}
  currentUserRole={currentRole || ''}
  onRoleUpdate={handleRoleUpdate}
  onBan={handleBan}
  onUnban={handleUnban}
  onWarn={handleWarn}
/>
```

注意：`currentRole` 在这里是 filter 参数，不是当前用户角色。需要在 UserManagement 中获取 session。最简单的方式是让 users/page.tsx 把 session.role 传下来。看 `users/page.tsx` 当前没有传 session...

改为：让 `UserManagement` 接收一个新的 `currentUserRole` prop，由 page.tsx 传入。

**5. UserManagementProps 新增 `currentUserRole`：**

```typescript
interface UserManagementProps {
  initialSearch?: string;
  initialRole?: string;
  initialSort?: string;
  currentUserRole?: string;
}
```

并在组件参数中解构：
```typescript
export function UserManagement({
  initialSearch,
  initialRole,
  initialSort,
  currentUserRole = '',
}: UserManagementProps) {
```

**6. 更新 `users/page.tsx`**：从 session 传入 currentUserRole：

需要修改 `app/(admin)/admin/users/page.tsx`，使其获取 session 并传入 `currentUserRole`。

但在 Next.js 15 中，服务端组件可调用 `getSession()`。让我更新 users page：

```tsx
import { getSession } from '@/lib/auth';
import { UserManagement } from '@/components/admin/users/user-management';

export const metadata = {
  title: '用户管理',
};

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: string;
    sort?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">
          管理用户账号和角色
        </p>
      </div>

      <UserManagement
        initialSearch={params.search}
        initialRole={params.role}
        initialSort={params.sort}
        currentUserRole={session?.role ?? ''}
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 7: 评论审核 API

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\comments\route.ts`
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\comments\[id]\route.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/comments` — `{ entityType?, page, limit, search? }` → `{ comments[], pagination }`
  - `DELETE /api/admin/comments/[id]` → `{ success: true }`

- [ ] **Step 1: 创建列表 API**

`app/api/admin/comments/route.ts`:

```typescript
/**
 * Admin Comments API
 *
 * GET /api/admin/comments - List all comments for moderation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, comments, users, mcpPackages, skillPackages, collections } from '@/lib/db';
import { eq, desc, count, and, like, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listCommentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  entityType: z.enum(['mcp', 'skill', 'collection', 'all']).default('all'),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listCommentsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, entityType, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (entityType !== 'all') {
      conditions.push(eq(comments.entityType, entityType));
    }
    if (search) {
      conditions.push(like(comments.content, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(comments)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const commentList = await db
      .select({
        id: comments.id,
        entityType: comments.entityType,
        entityId: comments.entityId,
        content: comments.content,
        createdAt: comments.createdAt,
        userId: comments.userId,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(whereClause)
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch resolve entity names
    const entityNames = await resolveEntityNames(commentList);

    const enrichedComments = commentList.map((c) => ({
      id: c.id,
      entityType: c.entityType,
      entityId: c.entityId,
      entityName: entityNames.get(`${c.entityType}:${c.entityId}`) || 'Unknown',
      content: c.content,
      createdAt: c.createdAt,
      user: {
        id: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
      },
    }));

    return NextResponse.json({
      comments: enrichedComments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List admin comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function resolveEntityNames(
  commentList: Array<{ entityType: string; entityId: string }>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const mcpIds = [...new Set(commentList.filter(c => c.entityType === 'mcp').map(c => c.entityId))];
  const skillIds = [...new Set(commentList.filter(c => c.entityType === 'skill').map(c => c.entityId))];
  const collectionIds = [...new Set(commentList.filter(c => c.entityType === 'collection').map(c => c.entityId))];

  if (mcpIds.length > 0) {
    const pkgs = await db.select({ id: mcpPackages.id, name: mcpPackages.name })
      .from(mcpPackages).where(
        // drizzle-orm inArray requires specific import
        (await import('drizzle-orm')).inArray(mcpPackages.id, mcpIds)
      );
    for (const p of pkgs) map.set(`mcp:${p.id}`, p.name);
  }
  // Fallback for missing
  for (const id of mcpIds) {
    if (!map.has(`mcp:${id}`)) map.set(`mcp:${id}`, `MCP ${id.slice(0, 8)}`);
  }

  if (skillIds.length > 0) {
    const pkgs = await db.select({ id: skillPackages.id, name: skillPackages.name })
      .from(skillPackages).where(
        (await import('drizzle-orm')).inArray(skillPackages.id, skillIds)
      );
    for (const p of pkgs) map.set(`skill:${p.id}`, p.name);
  }
  for (const id of skillIds) {
    if (!map.has(`skill:${id}`)) map.set(`skill:${id}`, `Skill ${id.slice(0, 8)}`);
  }

  if (collectionIds.length > 0) {
    const cols = await db.select({ id: collections.id, name: collections.name })
      .from(collections).where(
        (await import('drizzle-orm')).inArray(collections.id, collectionIds)
      );
    for (const c of cols) map.set(`collection:${c.id}`, c.name);
  }
  for (const id of collectionIds) {
    if (!map.has(`collection:${id}`)) map.set(`collection:${id}`, `Collection ${id.slice(0, 8)}`);
  }

  return map;
}
```

等一下 — 不能用 dynamic import `= await import()`。需要静态导入 `inArray`。

修改 import：
```typescript
import { eq, desc, count, and, like, inArray, type SQL } from 'drizzle-orm';
```

然后 resolveEntityNames 中的 `(await import('drizzle-orm')).inArray(...)` 都改为 `inArray(...)`。

- [ ] **Step 2: 创建删除 API**

`app/api/admin/comments/[id]/route.ts`:

```typescript
/**
 * Admin Comment Delete API
 *
 * DELETE /api/admin/comments/[id] - Delete a comment
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, comments } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.delete');
    const { id } = await params;

    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, id),
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    await db.delete(comments).where(eq(comments.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'comment',
      entityId: id,
      action: 'delete',
      reason: 'Moderated comment removal',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 8: 评论审核页面

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\admin\comments\comment-moderation.tsx`
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\admin\comments\index.ts`
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(admin)\admin\comments\page.tsx`

- [ ] **Step 1: 创建 barrel export**

`components/admin/comments/index.ts`:
```typescript
export { CommentModeration } from './comment-moderation';
```

- [ ] **Step 2: 创建客户端组件**

`components/admin/comments/comment-moderation.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/utils';

interface CommentItem {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  mcp: 'MCP',
  skill: '技能',
  collection: '合集',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CommentModeration() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentEntityType = searchParams.get('entityType') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        entityType: currentEntityType,
      });
      const res = await fetch(`/api/admin/comments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const data = await res.json();
      setComments(data.comments);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentEntityType]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/comments?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/comments/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete comment');
      setDeleteId(null);
      fetchComments();
    } catch {
      setError('删除评论失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">评论管理</h1>
          <p className="text-muted-foreground">审核和管理用户评论</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'mcp', 'skill', 'collection'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateFilter('entityType', type)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentEntityType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {type === 'all' ? '全部' : ENTITY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchComments} className="mt-2 text-sm text-primary hover:underline">重试</button>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无评论</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
                <th className="px-4 py-3 text-left text-sm font-medium">内容</th>
                <th className="px-4 py-3 text-left text-sm font-medium">所属实体</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">{getInitials(c.user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{c.user.displayName}</span>
                        <span className="text-muted-foreground ml-1">@{c.user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm max-w-[300px] truncate">
                    {c.content.length > 80 ? `${c.content.slice(0, 80)}...` : c.content}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Badge variant="outline">{ENTITY_TYPE_LABELS[c.entityType] || c.entityType}</Badge>
                      <span className="text-muted-foreground">{c.entityName}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(c.id)}
                      title="删除评论"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/comments?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {comments.length} / {pagination.total} 条评论
      </p>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              此操作不可撤销。确定要删除这条评论吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: 创建页面**

`app/(admin)/admin/comments/page.tsx`:

```typescript
import { CommentModeration } from '@/components/admin/comments';

export const metadata = {
  title: '评论管理',
};

export default function CommentsPage() {
  return <CommentModeration />;
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 9: 合集审核 API

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\collections\route.ts`
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\admin\collections\[id]\route.ts`

- [ ] **Step 1: 创建列表 API**

`app/api/admin/collections/route.ts`:

```typescript
/**
 * Admin Collections API
 *
 * GET /api/admin/collections - List all collections for moderation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, collections, users } from '@/lib/db';
import { eq, desc, count, and, like, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listCollectionsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  visibility: z.enum(['all', 'public', 'private']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listCollectionsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, search, visibility } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (visibility === 'public') {
      conditions.push(eq(collections.isPublic, true));
    } else if (visibility === 'private') {
      conditions.push(eq(collections.isPublic, false));
    }
    if (search) {
      conditions.push(like(collections.name, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(collections)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const collectionList = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        isPublic: collections.isPublic,
        itemCount: collections.itemCount,
        forksCount: collections.forksCount,
        favoritesCount: collections.favoritesCount,
        createdAt: collections.createdAt,
        ownerId: collections.ownerId,
        ownerName: users.username,
        ownerDisplayName: users.displayName,
      })
      .from(collections)
      .innerJoin(users, eq(collections.ownerId, users.id))
      .where(whereClause)
      .orderBy(desc(collections.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      collections: collectionList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List admin collections error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建删除 API**

`app/api/admin/collections/[id]/route.ts`:

```typescript
/**
 * Admin Collection Delete API
 *
 * DELETE /api/admin/collections/[id] - Delete a collection
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, collections } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.delete');
    const { id } = await params;

    const collection = await db.query.collections.findFirst({
      where: eq(collections.id, id),
    });

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    await db.delete(collections).where(eq(collections.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'collection',
      entityId: id,
      action: 'delete',
      reason: `Deleted collection: ${collection.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete collection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 10: 合集审核页面

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\admin\collections\collection-moderation.tsx`
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\admin\collections\index.ts`
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(admin)\admin\collections\page.tsx`

- [ ] **Step 1: 创建 barrel export**

`components/admin/collections/index.ts`:
```typescript
export { CollectionModeration } from './collection-moderation';
```

- [ ] **Step 2: 创建客户端组件**

`components/admin/collections/collection-moderation.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebouncedCallback } from 'use-debounce';

interface CollectionItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  forksCount: number;
  favoritesCount: number;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerDisplayName: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CollectionModeration() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');

  const currentVisibility = searchParams.get('visibility') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        visibility: currentVisibility,
      });
      const search = searchParams.get('search');
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/collections?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch collections');
      const data = await res.json();
      setCollections(data.collections);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentVisibility, searchParams]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/collections?${params.toString()}`);
  };

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateFilter('search', value);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/collections/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete collection');
      setDeleteId(null);
      fetchCollections();
    } catch {
      setError('删除合集失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">合集管理</h1>
          <p className="text-muted-foreground">审核和管理用户合集</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="按合集名称搜索..."
            value={searchValue}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'public', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => updateFilter('visibility', v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentVisibility === v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {v === 'all' ? '全部' : v === 'public' ? '公开' : '私有'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchCollections} className="mt-2 text-sm text-primary hover:underline">重试</button>
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无合集</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">作者</th>
                <th className="px-4 py-3 text-left text-sm font-medium">条目</th>
                <th className="px-4 py-3 text-left text-sm font-medium">收藏</th>
                <th className="px-4 py-3 text-left text-sm font-medium">可见性</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    @{c.ownerName}
                  </td>
                  <td className="px-4 py-3 text-sm">{c.itemCount}</td>
                  <td className="px-4 py-3 text-sm">{c.favoritesCount}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={c.isPublic ? 'default' : 'secondary'}>
                      {c.isPublic ? '公开' : '私有'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(c.id)}
                      title="删除合集"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/collections?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {collections.length} / {pagination.total} 个合集
      </p>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              此操作不可撤销。确定要删除这个合集吗？所有合集内容将被移除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: 创建页面**

`app/(admin)/admin/collections/page.tsx`:

```typescript
import { CollectionModeration } from '@/components/admin/collections';

export const metadata = {
  title: '合集管理',
};

export default function CollectionsPage() {
  return <CollectionModeration />;
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 11: 侧边栏 + 路由注册更新

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\sidebar.tsx`
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\navigation\route-registry.ts`

- [ ] **Step 1: 侧边栏 adminNavigation 新增评论/合集入口**

在 `sidebar.tsx` 的 `adminNavigation` 数组中，在 reports 条目之后、logs 条目之前插入：

```typescript
    {
      name: t('nav.comments', '评论管理'),
      href: '/admin/comments',
      icon: MessageSquare,
      permission: 'content.moderate',
    },
    {
      name: t('nav.collections', '合集管理'),
      href: '/admin/collections',
      icon: Layers,
      permission: 'content.moderate',
    },
```

注意 `MessageSquare` 已导入（第14行），`Layers` 已导入（第20行），无需新增 import。

- [ ] **Step 2: 路由注册表新增**

在 `route-registry.ts` 的 `routeRegistry` 中，`/admin/logs` 之后添加：

```typescript
  "/admin/comments": {
    label: "评论管理",
    icon: MessageSquare,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/collections": {
    label: "合集管理",
    icon: Layers,
    parent: "/admin",
    dropdownCategory: "管理",
  },
```

`MessageSquare` 和 `Layers` 已在文件中导入。

- [ ] **Step 3: 验证 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 12: 最终验证

- [ ] **Step 1: 运行完整 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

预期：通过，无错误。

- [ ] **Step 2: 检查 DB schema 同步**

确认 `db:push` 已在 Task 1 执行，users 表包含新字段。

- [ ] **Step 3: 手动验证清单**

- [ ] 以 super_admin 登录，访问 `/admin` → 侧边栏显示完整管理员菜单（含评论管理、合集管理）
- [ ] 访问 `/admin/users` → 用户列表显示状态列，操作栏有警告/封禁按钮
- [ ] 警告用户 → 弹出对话框填写原因，确认后状态变为"已警告"
- [ ] 封禁用户 → 弹出对话框填写原因，确认后状态变为"已封禁"
- [ ] 解封用户 → 点击解封按钮，状态恢复"正常"
- [ ] 修改用户角色为 moderator → 成功（super_admin 权限）
- [ ] 以 moderator 登录 → 侧边栏不显示评论管理/合集管理（无 content.moderate 权限）
- [ ] 访问 `/admin/comments` → 评论列表显示，可按实体类型筛选
- [ ] 删除评论 → 确认对话框，删除成功
- [ ] 访问 `/admin/collections` → 合集列表显示，可搜索和筛选
- [ ] 删除合集 → 确认对话框，删除成功
- [ ] 访问 `/admin/logs` → 可看到刚才的 warn/ban/delete 操作记录
- [ ] 以普通用户登录 → 侧边栏无管理员章节，访问 `/admin/*` 被重定向
