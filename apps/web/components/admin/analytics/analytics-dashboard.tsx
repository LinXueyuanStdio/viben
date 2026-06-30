'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, Users, Heart, MessageSquare, Share2, TrendingUp } from 'lucide-react';

interface DailyStat {
  statDate: string;
  viewCount: number;
  uniqueViewerCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface Summary {
  totalViews: number;
  totalUniqueViewers: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

interface TopEntity {
  entityType: string;
  entityId: string;
  totalViews: number;
  totalUniqueViewers: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

interface AnalyticsData {
  summary: Summary;
  dailyStats: DailyStat[];
  topEntities: TopEntity[];
  meta: {
    range: string;
    entityType: string | null;
    startDate: string | null;
    endDate: string | null;
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

const RANGE_OPTIONS = [
  { value: '7d' as const, label: '最近 7 天' },
  { value: '30d' as const, label: '最近 30 天' },
  { value: 'all' as const, label: '全部' },
];

export function AnalyticsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRange = (searchParams.get('range') as '7d' | '30d' | 'all') || '7d';
  const currentEntityType = searchParams.get('entity_type') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: currentRange });
      if (currentEntityType) {
        params.set('entity_type', currentEntityType);
      }
      const res = await fetch(`/api/admin/analytics?${params.toString()}`);
      if (!res.ok) throw new Error('加载数据失败');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [currentRange, currentEntityType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setRange = (range: '7d' | '30d' | 'all') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.push(`/admin/analytics?${params.toString()}`);
  };

  // Bar chart scaling
  const maxDailyViews =
    data?.dailyStats && data.dailyStats.length > 0
      ? Math.max(...data.dailyStats.map((d) => d.viewCount), 1)
      : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">内容分析</h1>
          <p className="text-muted-foreground">查看内容浏览、互动等数据趋势</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentRange === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
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
            type="button"
            onClick={fetchData}
            className="mt-2 text-sm text-primary hover:underline"
          >
            重试
          </button>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="text-xs font-medium">总浏览量</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{formatNumber(data.summary.totalViews)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">独立访客</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{formatNumber(data.summary.totalUniqueViewers)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                <span className="text-xs font-medium">点赞</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{formatNumber(data.summary.totalLikes)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs font-medium">评论</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{formatNumber(data.summary.totalComments)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Share2 className="h-4 w-4" />
                <span className="text-xs font-medium">分享</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{formatNumber(data.summary.totalShares)}</p>
            </div>
          </div>

          {/* Daily Views Bar Chart */}
          <div className="rounded-xl border bg-card">
            <div className="border-b px-6 py-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <TrendingUp className="h-4 w-4" />
                每日浏览量
              </h2>
            </div>
            <div className="px-6 py-4">
              {data.dailyStats.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">暂无数据</p>
              ) : (
                <div className="flex items-end gap-1" style={{ height: 200 }}>
                  {data.dailyStats.map((day) => {
                    const heightPct = (day.viewCount / maxDailyViews) * 100;
                    return (
                      <div
                        key={day.statDate}
                        className="group relative flex flex-1 flex-col items-center justify-end"
                      >
                        <div
                          className="w-full rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                        />
                        <span className="mt-2 text-[10px] text-muted-foreground">
                          {formatDate(day.statDate)}
                        </span>
                        {/* Tooltip */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs shadow opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                          {formatNumber(day.viewCount)} 次浏览
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top 10 Entities Table */}
          <div className="rounded-xl border bg-card">
            <div className="border-b px-6 py-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <TrendingUp className="h-4 w-4" />
                热门内容 Top 10
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium">ID</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">浏览量</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">独立访客</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">点赞</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">评论</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">分享</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topEntities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    data.topEntities.map((entity, i) => (
                      <tr
                        key={`${entity.entityType}-${entity.entityId}`}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-bold text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 text-sm">{entity.entityType}</td>
                        <td className="px-4 py-3 text-sm font-mono text-xs max-w-[200px] truncate">
                          {entity.entityId}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatNumber(entity.totalViews)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatNumber(entity.totalUniqueViewers)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatNumber(entity.totalLikes)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatNumber(entity.totalComments)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatNumber(entity.totalShares)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
