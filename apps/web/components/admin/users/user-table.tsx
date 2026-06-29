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
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserTableProps {
  users: User[];
  onRoleUpdate: (userId: string, newRole: 'user' | 'developer') => Promise<boolean>;
}

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  developer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  support: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  moderator: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  super_admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
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

export function UserTable({ users, onRoleUpdate }: UserTableProps) {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (newRole !== 'user' && newRole !== 'developer') return;

    setUpdatingUserId(userId);
    try {
      const success = await onRoleUpdate(userId, newRole);
      if (success) {
        toast.success(`角色已更新为 ${newRole === 'user' ? '用户' : '开发者'}`);
      } else {
        toast.error('更新角色失败');
      }
    } catch {
      toast.error('更新角色失败');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const isAdminRole = (role: string) => {
    return ['admin', 'super_admin', 'moderator', 'support'].includes(role);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">用户</TableHead>
            <TableHead>角色</TableHead>
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
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(user.lastLoginAt)}
              </TableCell>
              <TableCell className="text-right">
                {isAdminRole(user.role) ? (
                  <span className="text-sm text-muted-foreground">-</span>
                ) : updatingUserId === user.id ? (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                ) : (
                  <Select
                    value={user.role}
                    onValueChange={(value) => handleRoleChange(user.id, value)}
                  >
                    <SelectTrigger className="w-[120px] ml-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">用户</SelectItem>
                      <SelectItem value="developer">开发者</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
