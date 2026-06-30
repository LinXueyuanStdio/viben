'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/shared/pagination';
import { UserTable } from './user-table';
import { Loader2, Search } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

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

interface UserManagementProps {
  initialSearch?: string;
  initialRole?: string;
  initialSort?: string;
  currentUserRole?: string;
}

export function UserManagement({
  initialSearch,
  initialRole,
  initialSort,
  currentUserRole = '',
}: UserManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSearch = searchParams.get('search') || initialSearch || '';
  const currentRole = searchParams.get('role') || initialRole || '';
  const currentSort = searchParams.get('sort') || initialSort || 'newest';

  const [searchValue, setSearchValue] = useState(currentSearch);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        sort: currentSort,
      });

      if (currentSearch) {
        params.set('search', currentSearch);
      }

      if (currentRole) {
        params.set('role', currentRole);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentSearch, currentRole, currentSort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateSearchParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset page when filter changes
      if (key !== 'page') {
        params.delete('page');
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateSearchParams('search', value);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleRoleChange = (value: string) => {
    updateSearchParams('role', value === 'all' ? '' : value);
  };

  const handleSortChange = (value: string) => {
    updateSearchParams('sort', value);
  };

  const handleRoleUpdate = async (userId: string, newRole: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to update role' };
      }

      fetchUsers();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const handleBan = async (userId: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban', reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to ban user' };
      }

      fetchUsers();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const handleUnban = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban' }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to unban user' };
      }

      fetchUsers();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const handleWarn = async (userId: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to warn user' };
      }

      fetchUsers();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="按用户名或邮箱搜索..."
            value={searchValue}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={currentRole || 'all'} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="所有角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有角色</SelectItem>
              <SelectItem value="user">用户</SelectItem>
              <SelectItem value="developer">开发者</SelectItem>
              <SelectItem value="support">客服</SelectItem>
              <SelectItem value="moderator">版主</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
              <SelectItem value="super_admin">超级管理员</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">最新</SelectItem>
              <SelectItem value="oldest">最早</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 text-sm text-primary hover:underline"
          >
            重试
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">未找到用户</p>
        </div>
      ) : (
        <>
          <UserTable
            users={users}
            currentUserRole={currentUserRole}
            onRoleUpdate={handleRoleUpdate}
            onBan={handleBan}
            onUnban={handleUnban}
            onWarn={handleWarn}
          />

          {pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            显示 {users.length} / {pagination.total} 位用户
          </p>
        </>
      )}
    </div>
  );
}
