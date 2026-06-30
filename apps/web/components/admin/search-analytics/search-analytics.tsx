'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock } from 'lucide-react';

interface TopSearch {
  query: string;
  count: number;
  lastSearchedAt: string;
}

interface RecentSearch {
  id: string;
  query: string;
  resultCount: number;
  searchedAt: string;
  userId: string | null;
}

interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

export function SearchAnalytics() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [topSearches, setTopSearches] = useState<TopSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'top' | 'recent'>('top');

  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      const res = await fetch(`/api/admin/search-analytics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch search analytics');
      const data = await res.json();
      setTopSearches(data.topSearches);
      setRecentSearches(data.recentSearches);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally { setLoading(false); }
  }, [currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/search-analytics?${params.toString()}`);
  };

  const maxCount = topSearches.length > 0 ? topSearches[0].count : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">搜索分析</h1>
        <p className="text-muted-foreground">查看用户搜索趋势和热门查询</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('top')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            tab === 'top' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> 热门搜索
        </button>
        <button
          type="button"
          onClick={() => setTab('recent')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            tab === 'recent' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          <Clock className="h-4 w-4" /> 最近搜索
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchData} className="mt-2 text-sm text-primary hover:underline">重试</button></div>
      ) : tab === 'top' ? (
        topSearches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">暂无搜索数据</p></div>
        ) : (
          <div className="space-y-3">
            {topSearches.map((item, i) => (
              <div key={item.query} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                <span className="w-8 text-center font-bold text-muted-foreground">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.query}</span>
                    <Badge variant="secondary" className="shrink-0">{item.count} 次</Badge>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max((item.count / maxCount) * 100, 1)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(item.lastSearchedAt)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        recentSearches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">暂无搜索记录</p></div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">查询</th>
                <th className="px-4 py-3 text-left text-sm font-medium">结果数</th>
                <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
              </tr></thead>
              <tbody>
                {recentSearches.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{s.query}</td>
                    <td className="px-4 py-3 text-sm">{s.resultCount}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.userId ? s.userId.slice(0, 8) : '匿名'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(s.searchedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'recent' && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{p}</button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {tab === 'top' ? `共 ${topSearches.length} 个热门查询词` : `显示 ${recentSearches.length} / ${pagination.total} 条搜索记录`}
      </p>
    </div>
  );
}
