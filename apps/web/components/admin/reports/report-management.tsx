'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Report {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  reporterId: string;
  reporterName: string | null;
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
  comment: '评论',
  collection: '合集',
  user: '用户',
  published_page: '页面',
};

const REASON_LABELS: Record<string, string> = {
  spam: '垃圾信息',
  inappropriate: '不当内容',
  copyright: '版权问题',
  security: '安全问题',
  other: '其他',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: '待处理', variant: 'default' },
  resolved: { label: '已处理', variant: 'secondary' },
  dismissed: { label: '已驳回', variant: 'outline' },
};

export function ReportManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const currentStatus = searchParams.get('status') || 'pending';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        status: currentStatus,
      });

      const res = await fetch(`/api/admin/reports?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await res.json();
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentStatus]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'pending') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page');
    router.push(`/admin/reports?${params.toString()}`);
  };

  const handleAction = async (id: string, action: 'resolve' | 'dismiss') => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} report`);
      }

      fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} report`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">举报管理</h1>
          <p className="text-muted-foreground">查看和处理用户举报</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'resolved', 'dismissed', 'all'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => updateStatusFilter(status)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentStatus === status || (status === 'pending' && !searchParams.get('status'))
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {status === 'all' ? '全部' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
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
            onClick={fetchReports}
            className="mt-2 text-sm text-primary hover:underline"
          >
            重试
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无举报</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentStatus === 'pending' ? '没有待处理的举报' : '没有符合条件的举报'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">举报人</th>
                <th className="px-4 py-3 text-left text-sm font-medium">实体类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">实体ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">原因</th>
                <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={report.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{report.reporterName || '未知'}</td>
                    <td className="px-4 py-3 text-sm">
                      {ENTITY_TYPE_LABELS[report.entityType] || report.entityType}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs max-w-[120px] truncate">
                      {report.entityId.slice(0, 12)}...
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {REASON_LABELS[report.reason] || report.reason}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">
                      {report.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {report.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(report.id, 'resolve')}
                            disabled={actingId === report.id}
                          >
                            {actingId === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              '处理'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(report.id, 'dismiss')}
                            disabled={actingId === report.id}
                          >
                            驳回
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/reports?${params.toString()}`)}
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

      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        显示 {reports.length} / {pagination.total} 条举报
      </p>
    </div>
  );
}
