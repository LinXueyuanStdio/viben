'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
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
import { Loader2, Trash2, Key, Clock } from 'lucide-react';

interface ApiKey {
  id: string; name: string; keyPrefix: string; scopes: string[];
  lastUsedAt: string | null; expiresAt: string | null;
  createdAt: string; userId: string; username: string | null;
}

interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function ApiKeyManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchKeys = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (currentStatus !== 'all') {
        params.set('status', currentStatus);
      }
      const res = await fetch(`/api/admin/api-keys?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const data = await res.json();
      setKeys(data.apiKeys);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally { setLoading(false); }
  }, [currentPage, currentStatus]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/admin/api-keys?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/api-keys?${params.toString()}`);
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${revokeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke API key');
      toast.success('API 密钥已撤销');
      setRevokeId(null);
      fetchKeys();
    } catch {
      toast.error('撤销 API 密钥失败');
    } finally { setRevoking(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">API 密钥管理</h1>
          <p className="text-muted-foreground">查看和管理用户 API 密钥</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={currentStatus} onValueChange={(v) => updateFilter('status', v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="状态筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="active">有效</SelectItem>
              <SelectItem value="expired">已过期</SelectItem>
              <SelectItem value="permanent">永久</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchKeys} className="mt-2 text-sm text-primary hover:underline">重试</button></div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">暂无 API 密钥</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Key 前缀</th>
              <th className="px-4 py-3 text-left text-sm font-medium">所属用户</th>
              <th className="px-4 py-3 text-left text-sm font-medium">权限范围</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">最后使用</th>
              <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr></thead>
            <tbody>
              {keys.map((k) => {
                const expired = isExpired(k.expiresAt);
                return (
                  <tr key={k.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      {k.name}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs">{k.keyPrefix}...</td>
                    <td className="px-4 py-3 text-sm">{k.username || k.userId.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1 flex-wrap">
                        {(k.scopes || []).map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {expired ? (
                        <Badge variant="destructive">已过期</Badge>
                      ) : k.expiresAt ? (
                        <Badge variant="default">有效</Badge>
                      ) : (
                        <Badge variant="secondary">永久</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(k.lastUsedAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(k.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setRevokeId(k.id)} title="撤销密钥">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{p}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">显示 {keys.length} / {pagination.total} 个 API 密钥</p>

      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认撤销</DialogTitle><DialogDescription>此操作将立即撤销该 API 密钥，用户将无法再使用它进行认证。此操作不可撤销。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)} disabled={revoking}>取消</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>{revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}确认撤销</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
