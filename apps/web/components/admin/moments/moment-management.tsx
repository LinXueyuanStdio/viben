'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, EyeOff, Eye, Trash2 } from 'lucide-react';

interface Moment {
  id: string;
  uid: string;
  kind: string;
  body: string | null;
  visibility: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number | null;
  isPinned: boolean;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorUsername: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const KIND_LABELS: Record<string, string> = {
  post: '帖子',
  page_update: '页面更新',
  repost: '转发',
  system: '系统',
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: '公开',
  unlisted: '不公开',
  private: '私有',
};

export function MomentManagement() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'post' | 'page_update' | 'repost' | 'system'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchMoments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        kind: kindFilter,
        visibility: visibilityFilter,
      });
      const res = await fetch(`/api/admin/moments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch moments');
      const data = await res.json();
      setMoments(data.moments);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moments');
    } finally {
      setLoading(false);
    }
  }, [page, kindFilter, visibilityFilter]);

  useEffect(() => {
    fetchMoments();
  }, [fetchMoments]);

  const handleAction = async (id: string, action: 'hide' | 'unhide' | 'delete') => {
    const confirmMsg = action === 'delete' ? '确定删除此动态？' : action === 'hide' ? '确定隐藏此动态？' : '确定恢复可见？';
    if (!confirm(confirmMsg)) return;
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/moments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} moment`);
      fetchMoments();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} moment`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">动态管理</h1>
          <p className="text-muted-foreground">查看和管理社区动态内容</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">类型:</span>
          {(['all', 'post', 'page_update', 'repost', 'system'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKindFilter(k); setPage(1); }}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                kindFilter === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {k === 'all' ? '全部' : KIND_LABELS[k] || k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">可见性:</span>
          {(['all', 'public', 'unlisted', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setVisibilityFilter(v); setPage(1); }}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                visibilityFilter === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {v === 'all' ? '全部' : VISIBILITY_LABELS[v] || v}
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
          <button onClick={fetchMoments} className="mt-2 text-sm text-primary hover:underline">重试</button>
        </div>
      ) : moments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无动态</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">作者</th>
                <th className="px-4 py-3 text-left text-sm font-medium">内容</th>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">可见性</th>
                <th className="px-4 py-3 text-left text-sm font-medium">互动</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {moments.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {m.authorName || m.authorUsername || '未知'}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-[250px] truncate">
                    {m.body?.slice(0, 100) || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline">{KIND_LABELS[m.kind] || m.kind}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {VISIBILITY_LABELS[m.visibility] || m.visibility}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    ❤ {m.likeCount} · 💬 {m.commentCount} · 🔄 {m.repostCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {m.visibility !== 'private' ? (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleAction(m.id, 'hide')}
                          disabled={actingId === m.id}
                          title="隐藏"
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleAction(m.id, 'unhide')}
                          disabled={actingId === m.id}
                          title="恢复可见"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleAction(m.id, 'delete')}
                        disabled={actingId === m.id}
                        title="删除"
                      >
                        {actingId === m.id && actingId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                p === page ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {moments.length} / {pagination.total} 条动态
      </p>
    </div>
  );
}
