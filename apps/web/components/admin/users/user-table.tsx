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
import { Loader2, AlertTriangle, Ban, CheckCircle, Eye } from 'lucide-react';

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
  onRoleUpdate: (userId: string, newRole: string) => Promise<{ success: boolean; error?: string }>;
  onBan: (userId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  onUnban: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onWarn: (userId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  onViewDetail: (userId: string) => void;
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

export function UserTable({ users, currentUserRole, onRoleUpdate, onBan, onUnban, onWarn, onViewDetail }: UserTableProps) {
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
      const result = await onRoleUpdate(userId, newRole);
      if (result.success) {
        toast.success(`角色已更新为 ${ROLE_LABELS[newRole] || newRole}`);
      } else {
        toast.error(result.error || '更新角色失败');
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
      const result = await onBan(banDialog.userId, reason.trim());
      if (result.success) {
        toast.success(`已封禁 ${banDialog.username}`);
        setBanDialog(null);
        setReason('');
      } else {
        toast.error(result.error || '封禁失败');
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
      const result = await onUnban(userId);
      if (result.success) {
        toast.success('已解封');
      } else {
        toast.error(result.error || '解封失败');
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
      const result = await onWarn(warnDialog.userId, reason.trim());
      if (result.success) {
        toast.success(`已警告 ${warnDialog.username}`);
        setWarnDialog(null);
        setReason('');
      } else {
        toast.error(result.error || '警告失败');
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
                    {/* Detail button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="查看详情"
                      onClick={() => onViewDetail(user.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

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
