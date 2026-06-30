'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DraftItem {
  id: string;
  packageType: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  dataPreview: string;
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-CN');
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function DraftManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DraftItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentPackageType = searchParams.get('package_type') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const packageTypeLabels: Record<string, string> = {
    mcp: 'MCP',
    skill: '技能',
  };

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        package_type: currentPackageType,
      });
      const res = await fetch(`/api/admin/drafts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch drafts');
      const data = await res.json();
      setDrafts(data.drafts);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载草稿数据失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentPackageType]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/drafts?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/drafts/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete draft');
      fetchDrafts();
      toast.success('草稿已删除');
    } catch {
      toast.error('删除草稿失败');
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">草稿管理</h1>
          <p className="text-muted-foreground">管理用户未发布的草稿数据</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'mcp', 'skill'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateFilter('package_type', type)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentPackageType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {type === 'all' ? '全部' : packageTypeLabels[type]}
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
          <button onClick={fetchDrafts} className="mt-2 text-sm text-primary hover:underline">重试</button>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无草稿数据</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">数据预览</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">过期时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={d.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">{getInitials(d.user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{d.user.displayName}</span>
                        <span className="text-muted-foreground ml-1">@{d.user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline">{packageTypeLabels[d.packageType] || d.packageType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm max-w-[250px] truncate text-muted-foreground">
                    {d.dataPreview}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(d.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <span className={`flex items-center gap-1 ${isExpired(d.expiresAt) ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <Clock className="h-3 w-3" />
                      {isExpired(d.expiresAt) ? '已过期' : formatRelativeTime(d.expiresAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(d)}
                      title="删除草稿"
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
                onClick={() => router.push(`/admin/drafts?${params.toString()}`)}
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
        显示 {drafts.length} 条，共 {pagination.total} 条草稿
      </p>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除草稿</DialogTitle>
            <DialogDescription>
              确定要删除该草稿吗？此操作不可撤销。草稿删除后将无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</Button>
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
