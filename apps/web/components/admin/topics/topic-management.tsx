'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Trash2, Star, ShieldOff } from 'lucide-react';

interface Topic {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  momentCount: number;
  lastMomentAt: string | null;
  isFeatured: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export function TopicManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentFilter = searchParams.get('filter') || 'all';

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formSlug, setFormSlug] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsFeatured, setFormIsFeatured] = useState(false);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/topics?filter=${currentFilter}`);
      if (!res.ok) throw new Error('Failed to fetch topics');
      const data = await res.json();
      setTopics(data.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  }, [currentFilter]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const updateFilter = (f: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f && f !== 'all') params.set('filter', f);
    else params.delete('filter');
    router.push(`/admin/topics?${params.toString()}`);
  };

  const openCreateDialog = () => {
    setEditingTopic(null);
    setFormSlug('');
    setFormDisplayName('');
    setFormDescription('');
    setFormIsFeatured(false);
    setDialogOpen(true);
  };

  const openEditDialog = (topic: Topic) => {
    setEditingTopic(topic);
    setFormSlug(topic.slug);
    setFormDisplayName(topic.displayName);
    setFormDescription(topic.description ?? '');
    setFormIsFeatured(topic.isFeatured);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        slug: formSlug,
        display_name: formDisplayName,
        description: formDescription || null,
        is_featured: formIsFeatured,
      };
      const res = editingTopic
        ? await fetch(`/api/admin/topics/${editingTopic.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch('/api/admin/topics', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save topic');
      }
      setDialogOpen(false);
      fetchTopics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = async (topic: Topic, field: 'isFeatured' | 'isBlocked') => {
    setTogglingId(topic.id);
    try {
      const body = field === 'isFeatured'
        ? { is_featured: !topic.isFeatured }
        : { is_blocked: !topic.isBlocked };
      const res = await fetch(`/api/admin/topics/${topic.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update topic');
      fetchTopics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update topic');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/topics/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete topic');
      setDeleteId(null);
      fetchTopics();
    } catch {
      setError('删除话题失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">话题管理</h1>
          <p className="text-muted-foreground">管理动态话题/标签，控制精选和屏蔽</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'featured', 'blocked'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => updateFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {f === 'all' ? '全部' : f === 'featured' ? '精选' : '已屏蔽'}
            </button>
          ))}
          <Button onClick={openCreateDialog}>新建话题</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchTopics} className="mt-2 text-sm text-primary hover:underline">重试</button>
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无话题</p>
          <p className="mt-2 text-sm text-muted-foreground">点击「新建话题」创建第一个话题</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Slug</th>
                <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium">动态数</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{topic.displayName}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{topic.slug}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{topic.description || '-'}</td>
                  <td className="px-4 py-3 text-sm">{topic.momentCount}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      {topic.isFeatured && <Badge variant="default">精选</Badge>}
                      {topic.isBlocked && <Badge variant="destructive">已屏蔽</Badge>}
                      {!topic.isFeatured && !topic.isBlocked && <Badge variant="secondary">普通</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleTopic(topic, 'isFeatured')} disabled={togglingId === topic.id} title={topic.isFeatured ? '取消精选' : '设为精选'}>
                        <Star className={`h-4 w-4 ${topic.isFeatured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleTopic(topic, 'isBlocked')} disabled={togglingId === topic.id} title={topic.isBlocked ? '取消屏蔽' : '屏蔽'}>
                        <ShieldOff className={`h-4 w-4 ${topic.isBlocked ? 'text-destructive' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(topic)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(topic.id)} disabled={togglingId === topic.id}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">共 {topics.length} 个话题</p>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTopic ? '编辑话题' : '新建话题'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="displayName">名称</Label><Input id="displayName" value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} placeholder="话题名称" /></div>
            <div className="space-y-2"><Label htmlFor="slug">Slug</Label><Input id="slug" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="url-friendly-slug" /></div>
            <div className="space-y-2"><Label htmlFor="description">描述</Label><Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="话题描述（可选）" rows={3} /></div>
            <div className="flex items-center justify-between"><Label htmlFor="isFeatured">设为精选</Label><Switch id="isFeatured" checked={formIsFeatured} onCheckedChange={setFormIsFeatured} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !formDisplayName || !formSlug}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>此操作不可撤销。确定要删除这个话题吗？</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
