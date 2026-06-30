'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface RankingSnapshot {
  id: string;
  rankingKey: string;
  entityType: string;
  timeWindow: string;
  scopeType: string;
  scopeId: string | null;
  algorithmVersion: string;
  status: 'building' | 'ready' | 'failed' | 'expired';
  generatedAt: string | null;
  validFrom: string;
  validUntil: string | null;
  sourceFrom: string | null;
  sourceUntil: string | null;
  itemCount: number;
  createdAt: string;
}

interface RankingItem {
  id: string;
  rank: number;
  entityType: string;
  entityId: string;
  score: number;
  rawScore: number;
  reason: string;
  title: string;
  description: string | null;
  userId: string | null;
  userSlug: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  delta: string | null;
  scoreLabel: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  building: { label: '构建中', variant: 'secondary' },
  ready: { label: '就绪', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
  expired: { label: '已过期', variant: 'outline' },
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

export function RankingManagement() {
  const [snapshots, setSnapshots] = useState<RankingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'building' | 'failed' | 'expired'>('all');
  const [rebuilding, setRebuilding] = useState(false);

  // Detail view state
  const [selectedSnapshot, setSelectedSnapshot] = useState<RankingSnapshot | null>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rankings?status=${statusFilter}`);
      if (!res.ok) throw new Error('Failed to fetch rankings');
      const data = await res.json();
      setSnapshots(data.snapshots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const fetchItems = async (snapshot: RankingSnapshot) => {
    setSelectedSnapshot(snapshot);
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/admin/rankings/${snapshot.id}`);
      if (!res.ok) throw new Error('Failed to fetch ranking items');
      const data = await res.json();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/admin/rankings/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'published_page', timeWindow: '7d' }),
      });
      if (!res.ok) throw new Error('Failed to trigger rebuild');
      const data = await res.json();
      toast.success(data.message || '榜单重建成功');
      fetchSnapshots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重建榜单失败');
    } finally {
      setRebuilding(false);
    }
  };

  // Detail view
  if (selectedSnapshot) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSnapshot(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold">
              榜单详情 — {selectedSnapshot.rankingKey}
            </h1>
            <p className="text-muted-foreground">
              时间窗口: {selectedSnapshot.timeWindow} · 条目数: {selectedSnapshot.itemCount} ·{' '}
              生成时间: {formatDateTime(selectedSnapshot.generatedAt)}
            </p>
          </div>
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg text-muted-foreground">暂无排行条目</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium w-16">排名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">作者</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">评分</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">数据</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">变化</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        item.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium max-w-[300px] truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.entityType}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.authorName || item.userSlug || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {item.score.toFixed(1)}
                      {item.scoreLabel && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.scoreLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <span title={`浏览${item.viewCount ?? 0} 点赞${item.likeCount ?? 0} 评论${item.commentCount ?? 0}`}>
                        👁 {item.viewCount ?? 0} · ❤ {item.likeCount ?? 0} · 💬 {item.commentCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.delta ? (
                        <Badge variant={item.delta.startsWith('up') ? 'default' : 'secondary'}>
                          {item.delta}
                        </Badge>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">榜单管理</h1>
          <p className="text-muted-foreground">查看榜单快照和排行数据，手动触发榜单重建</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'ready', 'building', 'failed', 'expired'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? '全部' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
          <Button onClick={handleRebuild} disabled={rebuilding}>
            {rebuilding ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            重建榜单
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchSnapshots} className="mt-2 text-sm text-primary hover:underline">
            重试
          </button>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无榜单快照</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">榜单 Key</th>
                <th className="px-4 py-3 text-left text-sm font-medium">实体类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间窗口</th>
                <th className="px-4 py-3 text-left text-sm font-medium">范围</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">条目数</th>
                <th className="px-4 py-3 text-left text-sm font-medium">生成时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => {
                const statusConf = STATUS_CONFIG[snap.status] || STATUS_CONFIG.building;
                return (
                  <tr key={snap.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{snap.rankingKey}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{snap.entityType}</td>
                    <td className="px-4 py-3 text-sm">{snap.timeWindow}</td>
                    <td className="px-4 py-3 text-sm">{snap.scopeType}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{snap.itemCount}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(snap.generatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchItems(snap)}
                        disabled={snap.status === 'building'}
                      >
                        查看条目
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        共 {snapshots.length} 个快照
      </p>
    </div>
  );
}
