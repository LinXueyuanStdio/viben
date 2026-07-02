'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string; type: string; title: string; body: string | null;
  readAt: string | null; createdAt: string;
  recipientId: string; recipientName: string | null;
  actorName: string | null; pageUid: string | null; pageAuthorSlug: string | null;
}

interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-CN');
}

export function NotificationManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentReadStatus = searchParams.get('read_status') || 'all';
  const currentType = searchParams.get('type') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) {
      types.add(item.type);
    }
    return Array.from(types).sort();
  }, [items]);

  const fetchItems = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20', read_status: currentReadStatus });
      if (currentType !== 'all') {
        params.set('type', currentType);
      }
      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      setItems(data.notifications);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally { setLoading(false); }
  }, [currentPage, currentReadStatus, currentType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== 'all') params.set(key, value); else params.delete(key);
    params.delete('page');
    router.push(`/admin/notifications?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/notifications?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/notifications/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notification');
      toast.success('通知已删除');
      setDeleteId(null);
      fetchItems();
    } catch {
      toast.error('删除通知失败');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-2xl font-bold">通知管理</h1><p className="text-muted-foreground">查看系统通知记录</p></div>
        <div className="flex gap-2">
          <Select value={currentType} onValueChange={(v) => updateFilter('type', v)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="所有类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类型</SelectItem>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(['all', 'unread', 'read'] as const).map((s) => (
            <button key={s} type="button" onClick={() => updateFilter('read_status', s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${currentReadStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s === 'all' ? '全部' : s === 'unread' ? '未读' : '已读'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchItems} className="mt-2 text-sm text-primary hover:underline">重试</button></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">暂无通知</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
              <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium">接收者</th>
              <th className="px-4 py-3 text-left text-sm font-medium">触发者</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr></thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">
                    {n.title}
                    {n.body && <span className="block text-xs text-muted-foreground truncate mt-0.5">{n.body}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm"><Badge variant="outline" className="font-mono text-xs">{n.type}</Badge></td>
                  <td className="px-4 py-3 text-sm">{n.recipientName || n.recipientId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{n.actorName || '-'}</td>
                  <td className="px-4 py-3 text-sm"><Badge variant={n.readAt ? 'secondary' : 'default'}>{n.readAt ? '已读' : '未读'}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatRelativeTime(n.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(n.id)}>
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
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{p}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">显示 {items.length} / {pagination.total} 条通知</p>

      <Dialog open={!!deleteId} onOpenChange={() => { if (!deleting) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>此操作不可撤销。确定要删除此通知吗？</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
