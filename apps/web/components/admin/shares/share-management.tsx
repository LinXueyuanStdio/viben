'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShareItem {
  id: string;
  uid: string;
  entityType: string;
  entityId: string;
  channel: string;
  targetUrl: string;
  htmlDirectUrl: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  openCount: number;
  uniqueOpenCount: number;
  createdAt: string;
  status: 'active' | 'expired' | 'revoked';
  createdBy: {
    userId: string;
    username: string;
    displayName: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen) + '...';
}

export function ShareManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [shares, setShares] = useState<ShareItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const statusLabels: Record<string, string> = {
    active: '活跃',
    expired: '已过期',
    revoked: '已撤销',
  };

  const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    expired: 'secondary',
    revoked: 'destructive',
  };

  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        status: currentStatus,
      });
      const res = await fetch(`/api/admin/shares?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch shares');
      const data = await res.json();
      setShares(data.shares);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分享链接失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentStatus]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/shares?${params.toString()}`);
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/shares/${revokeId}`, { method: 'PATCH' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revoke share link');
      }
      toast.success('分享链接已撤销');
      fetchShares();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '撤销失败');
    } finally {
      setRevokeId(null);
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">分享管理</h1>
          <p className="text-muted-foreground">管理所有分享链接，查看统计数据与操作记录</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'expired', 'revoked'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateFilter('status', s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? '全部' : statusLabels[s]}
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
          <button
            onClick={fetchShares}
            className="mt-2 text-sm text-primary hover:underline"
          >
            重试
          </button>
        </div>
      ) : shares.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无分享链接</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">UID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">实体类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">实体ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">目标URL</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">渠道</th>
                  <th className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">打开次数</th>
                  <th className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">独立打开</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">创建者</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">创建时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">状态</th>
                  <th className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {s.uid.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline">{s.entityType}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {s.entityId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px]">
                      <a
                        href={s.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate block"
                        title={s.targetUrl}
                      >
                        {truncateUrl(s.targetUrl)}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="secondary">{s.channel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">{s.openCount}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono">{s.uniqueOpenCount}</td>
                    <td className="px-4 py-3 text-sm">
                      {s.createdBy ? (
                        <span>
                          <span className="font-medium">{s.createdBy.displayName}</span>
                          <span className="text-muted-foreground ml-1">
                            @{s.createdBy.username}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">未知</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusVariants[s.status]}>{statusLabels[s.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRevokeId(s.id)}
                          title="撤销分享链接"
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                onClick={() => router.push(`/admin/shares?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {shares.length} / {pagination.total} 条分享链接
      </p>

      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤销分享链接</DialogTitle>
            <DialogDescription>
              确定要撤销此分享链接吗？撤销后该链接将无法继续访问。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeId(null)}
              disabled={revoking}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认撤销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
