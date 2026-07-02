'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Clock, Eye, Search as SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Pagination } from '@/components/shared/pagination';
import { BatchActionsBar } from '@/components/admin/batch-actions-bar';
import type { BatchAction } from '@/components/admin/batch-actions-bar';
import { useDebouncedCallback } from 'use-debounce';
import { formatDate, cn } from '@/lib/utils';

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

interface DraftDetail {
  id: string;
  packageType: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface PaginationInfo {
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
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DraftItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DraftDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const currentPackageType = searchParams.get('package_type') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSearch = searchParams.get('search') || '';
  const [searchValue, setSearchValue] = useState(currentSearch);

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
      if (currentSearch) {
        params.set('search', currentSearch);
      }
      const res = await fetch(`/api/admin/drafts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch drafts');
      const data = await res.json();
      setDrafts(data.drafts);
      setPagination(data.pagination);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载草稿数据失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentPackageType, currentSearch]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/drafts?${params.toString()}`);
  };

  const debouncedSearch = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    params.delete('page');
    router.push(`/admin/drafts?${params.toString()}`);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const fetchDraftDetail = async (id: string) => {
    setDetailTarget(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/drafts/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || '获取草稿详情失败');
      }
      const data = await res.json();
      setDetailData(data.draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载草稿详情失败');
      setDetailTarget(null);
    } finally {
      setDetailLoading(false);
    }
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

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(drafts.map((d) => d.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Batch actions
  const batchActions: BatchAction[] = [
    {
      key: 'delete',
      label: '批量删除',
      variant: 'destructive',
      requireConfirm: true,
      confirmTitle: '批量删除草稿',
      confirmDescription: `确定要删除选中的 ${selectedIds.size} 个草稿吗？此操作不可撤销。`,
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/drafts/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', ids }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch delete failed');
          toast.success(`已删除 ${data.affected} 个草稿`);
          deselectAll();
          fetchDrafts();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量删除失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="按用户名或昵称搜索..."
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      {/* Batch Actions Bar */}
      <BatchActionsBar
        selectedCount={selectedIds.size}
        totalCount={drafts.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        actions={batchActions}
        loading={batchLoading}
      />

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
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
                    checked={selectedIds.size === drafts.length && drafts.length > 0}
                    onChange={() => {
                      if (selectedIds.size === drafts.length) {
                        deselectAll();
                      } else {
                        selectAll();
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">数据预览</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">过期时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const isSelected = selectedIds.has(d.id);
                return (
                  <tr
                    key={d.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/30',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(d.id)}
                      />
                    </td>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => fetchDraftDetail(d.id)}
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(d)}
                          title="删除草稿"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
          />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {drafts.length} 条，共 {pagination.total} 条草稿
      </p>

      <Dialog open={!!detailTarget} onOpenChange={() => { setDetailTarget(null); setDetailData(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>草稿详情</DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {detailData && !detailLoading && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={detailData.user.avatarUrl ?? undefined} />
                    <AvatarFallback>{getInitials(detailData.user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{detailData.user.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{detailData.user.username}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto">
                    {packageTypeLabels[detailData.packageType] || detailData.packageType}
                  </Badge>
                </div>

                <Separator />

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">创建时间：</span>
                    <span>{formatDate(detailData.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">更新时间：</span>
                    <span>{formatDate(detailData.updatedAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">过期时间：</span>
                    <span className={isExpired(detailData.expiresAt) ? 'text-destructive' : ''}>
                      {formatDate(detailData.expiresAt)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Data Fields */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">草稿数据</h4>
                  {detailData.data && typeof detailData.data === 'object' && Object.keys(detailData.data).length > 0 ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border p-3">
                        <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                          {JSON.stringify(detailData.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">无数据</p>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

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
