'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Pagination } from '@/components/shared/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Trash2, Star, ShieldOff, Search } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function TopicManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentFilter = searchParams.get('filter') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSearch = searchParams.get('search') || '';

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

  // Search state
  const [searchValue, setSearchValue] = useState(currentSearch);

  const filterLabels: Record<string, string> = {
    all: t('dashboard.admin.comments.filterAll'),
    featured: t('dashboard.admin.topics.featured'),
    blocked: t('dashboard.admin.topics.blocked'),
  };

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        filter: currentFilter,
        page: String(currentPage),
        limit: '20',
      });
      if (currentSearch) {
        params.set('search', currentSearch);
      }
      const res = await fetch(`/api/admin/topics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch topics');
      const data = await res.json();
      setTopics(data.topics);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.topics.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentFilter, currentPage, currentSearch, t]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const updateFilter = (f: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f && f !== 'all') params.set('filter', f);
    else params.delete('filter');
    params.delete('page');
    router.push(`/admin/topics?${params.toString()}`);
  };

  const debouncedSearch = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    params.delete('page');
    router.push(`/admin/topics?${params.toString()}`);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
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
      setError(err instanceof Error ? err.message : t('dashboard.admin.topics.actionError'));
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
      setError(err instanceof Error ? err.message : t('dashboard.admin.topics.actionError'));
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
      setError(t('dashboard.admin.topics.actionError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.topics.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.topics.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog}>{t('dashboard.admin.topics.create')}</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索话题名称或 slug..."
            value={searchValue}
            onChange={handleSearchChange}
            className="pl-9"
          />
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
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchTopics} className="mt-2 text-sm text-primary hover:underline">{t('dashboard.admin.topics.retry')}</button>
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.topics.emptyTitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground">点击「{t('dashboard.admin.topics.create')}」创建第一个话题</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.topics.columns.name')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.topics.columns.slug')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.topics.columns.description')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.topics.columns.momentCount')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.topics.columns.status')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.topics.columns.actions')}</th>
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
                      {topic.isFeatured && <Badge variant="default">{t('dashboard.admin.topics.featured')}</Badge>}
                      {topic.isBlocked && <Badge variant="destructive">{t('dashboard.admin.topics.blocked')}</Badge>}
                      {!topic.isFeatured && !topic.isBlocked && <Badge variant="secondary">普通</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleTopic(topic, 'isFeatured')} disabled={togglingId === topic.id} title={topic.isFeatured ? t('dashboard.admin.topics.unfeature') : t('dashboard.admin.topics.feature')}>
                        <Star className={`h-4 w-4 ${topic.isFeatured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleTopic(topic, 'isBlocked')} disabled={togglingId === topic.id} title={topic.isBlocked ? t('dashboard.admin.topics.unblock') : t('dashboard.admin.topics.block')}>
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

      {pagination.totalPages > 1 && (
        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} />
      )}

      <p className="text-sm text-muted-foreground">显示 {topics.length} / {pagination.total} 个话题</p>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTopic ? t('dashboard.admin.topics.form.editTitle') : t('dashboard.admin.topics.form.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="displayName">{t('dashboard.admin.topics.form.name')}</Label><Input id="displayName" value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} placeholder={t('dashboard.admin.topics.form.name')} /></div>
            <div className="space-y-2"><Label htmlFor="slug">{t('dashboard.admin.topics.form.slug')}</Label><Input id="slug" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="url-friendly-slug" /></div>
            <div className="space-y-2"><Label htmlFor="description">{t('dashboard.admin.topics.form.description')}</Label><Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={t('dashboard.admin.topics.form.description') + '（可选）'} rows={3} /></div>
            <div className="flex items-center justify-between"><Label htmlFor="isFeatured">{t('dashboard.admin.topics.feature')}</Label><Switch id="isFeatured" checked={formIsFeatured} onCheckedChange={setFormIsFeatured} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !formDisplayName || !formSlug}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dashboard.admin.topics.deleteConfirm')}</DialogTitle><DialogDescription>{t('dashboard.admin.topics.deleteConfirmDesc')}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
