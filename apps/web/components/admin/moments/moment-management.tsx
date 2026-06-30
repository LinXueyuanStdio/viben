'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, EyeOff, Eye, Trash2 } from 'lucide-react';

interface Moment {
  id: string; uid: string; kind: string; body: string | null; visibility: string;
  likeCount: number; commentCount: number; repostCount: number; viewCount: number | null;
  isPinned: boolean; createdAt: string; authorId: string; authorName: string | null; authorUsername: string | null;
}

interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
}

const KIND_LABELS: Record<string, string> = { post: '帖子', page_update: '页面更新', repost: '转发', system: '系统' };
const VISIBILITY_LABELS: Record<string, string> = { public: '公开', unlisted: '不公开', private: '私有' };

export function MomentManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const currentKind = searchParams.get('kind') || 'all';
  const currentVisibility = searchParams.get('visibility') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; action: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMoments = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20', kind: currentKind, visibility: currentVisibility });
      const res = await fetch(`/api/admin/moments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch moments');
      const data = await res.json();
      setMoments(data.moments);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moments');
    } finally { setLoading(false); }
  }, [currentPage, currentKind, currentVisibility]);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value); else params.delete(key);
    params.delete('page');
    router.push(`/admin/moments?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/moments?${params.toString()}`);
  };

  const handleAction = async (id: string, action: 'hide' | 'unhide' | 'delete') => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/moments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} moment`);
      setDeleteTarget(null);
      fetchMoments();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} moment`);
    } finally { setActingId(null); }
  };

  const confirmAction = (id: string, action: 'hide' | 'unhide' | 'delete') => {
    const labels = { hide: '隐藏', unhide: '恢复可见', delete: '删除' };
    setDeleteTarget({ id, action, label: labels[action] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-2xl font-bold">动态管理</h1><p className="text-muted-foreground">查看和管理社区动态内容</p></div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">类型:</span>
          {(['all', 'post', 'page_update', 'repost', 'system'] as const).map((k) => (
            <button key={k} type="button" onClick={() => updateFilter('kind', k)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${currentKind === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {k === 'all' ? '全部' : KIND_LABELS[k] || k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">可见性:</span>
          {(['all', 'public', 'unlisted', 'private'] as const).map((v) => (
            <button key={v} type="button" onClick={() => updateFilter('visibility', v)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${currentVisibility === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {v === 'all' ? '全部' : VISIBILITY_LABELS[v] || v}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchMoments} className="mt-2 text-sm text-primary hover:underline">重试</button></div>
      ) : moments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">暂无动态</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">作者</th><th className="px-4 py-3 text-left text-sm font-medium">内容</th>
              <th className="px-4 py-3 text-left text-sm font-medium">类型</th><th className="px-4 py-3 text-left text-sm font-medium">可见性</th>
              <th className="px-4 py-3 text-left text-sm font-medium">互动</th><th className="px-4 py-3 text-left text-sm font-medium">时间</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr></thead>
            <tbody>
              {moments.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{m.authorName || m.authorUsername || '未知'}</td>
                  <td className="px-4 py-3 text-sm max-w-[250px] truncate">{m.body?.slice(0, 100) || '-'}</td>
                  <td className="px-4 py-3 text-sm"><Badge variant="outline">{KIND_LABELS[m.kind] || m.kind}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{VISIBILITY_LABELS[m.visibility] || m.visibility}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">❤ {m.likeCount} · 💬 {m.commentCount} · 🔄 {m.repostCount}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(m.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                    {m.visibility !== 'private' ? (
                      <Button variant="ghost" size="sm" onClick={() => confirmAction(m.id, 'hide')} disabled={actingId === m.id} title="隐藏"><EyeOff className="h-4 w-4" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => confirmAction(m.id, 'unhide')} disabled={actingId === m.id} title="恢复可见"><Eye className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => confirmAction(m.id, 'delete')} disabled={actingId === m.id} title="删除">
                      {actingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{p}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">显示 {moments.length} / {pagination.total} 条动态</p>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认{deleteTarget?.label}</DialogTitle><DialogDescription>确定要{deleteTarget?.label}此动态吗？</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</Button>
            <Button variant={deleteTarget?.action === 'delete' ? 'destructive' : 'default'}
              onClick={() => deleteTarget && handleAction(deleteTarget.id, deleteTarget.action as 'hide' | 'unhide' | 'delete')}
              disabled={actingId === deleteTarget?.id}>
              {actingId === deleteTarget?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}确认{deleteTarget?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
