'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Star } from 'lucide-react';

interface Feedback {
  id: string;
  pageId: string;
  category: string;
  rating: number;
  content: string;
  createdAt: string;
  reporterId: string;
  reporterName: string | null;
  reporterDisplayName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CATEGORY_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  bug: { label: 'Bug', variant: 'destructive' },
  suggestion: { label: '建议', variant: 'default' },
  other: { label: '其他', variant: 'secondary' },
};

export function FeedbackManagement() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'bug' | 'suggestion' | 'other'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        category: categoryFilter,
      });
      const res = await fetch(`/api/admin/feedbacks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch feedbacks');
      const data = await res.json();
      setFeedbacks(data.feedbacks);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedbacks');
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此反馈？')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/feedbacks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete feedback');
      fetchFeedbacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feedback');
    } finally {
      setDeletingId(null);
    }
  };

  const renderStars = (rating: number) => (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">反馈管理</h1>
          <p className="text-muted-foreground">查看和管理用户反馈与建议</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'bug', 'suggestion', 'other'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setCategoryFilter(c); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              categoryFilter === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {c === 'all' ? '全部' : CATEGORY_CONFIG[c]?.label || c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchFeedbacks} className="mt-2 text-sm text-primary hover:underline">重试</button>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无反馈</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
                <th className="px-4 py-3 text-left text-sm font-medium">页面ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
                <th className="px-4 py-3 text-left text-sm font-medium">评分</th>
                <th className="px-4 py-3 text-left text-sm font-medium">内容</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f) => {
                const catConf = CATEGORY_CONFIG[f.category] || CATEGORY_CONFIG.other;
                return (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {f.reporterDisplayName || f.reporterName || '匿名'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs max-w-[120px] truncate">
                      {f.pageId.slice(0, 12)}...
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={catConf.variant}>{catConf.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{renderStars(f.rating)}</td>
                    <td className="px-4 py-3 text-sm max-w-[250px] truncate">{f.content}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleDelete(f.id)}
                        disabled={deletingId === f.id}
                      >
                        {deletingId === f.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
        显示 {feedbacks.length} / {pagination.total} 条反馈
      </p>
    </div>
  );
}
