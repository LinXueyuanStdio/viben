'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
import { Pagination } from '@/components/shared/pagination';
import { Loader2, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: unknown;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function CategoryManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSearch = searchParams.get('search') || '';

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Search with debounce
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [formSlug, setFormSlug] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const filterLabels: Record<string, string> = {
    all: t('dashboard.admin.comments.filterAll'),
    active: t('dashboard.admin.categories.enabled'),
    inactive: t('dashboard.admin.categories.disabled'),
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', currentStatus);
      params.set('page', String(currentPage));
      params.set('limit', '20');
      if (currentSearch) params.set('search', currentSearch);
      const res = await fetch(`/api/admin/categories?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data.categories);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.categories.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentStatus, currentPage, currentSearch, t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const updateFilter = (status: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (currentSearch) params.set('search', currentSearch);
    router.push(`/admin/categories?${params.toString()}`);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Set debounce
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (currentStatus !== 'all') params.set('status', currentStatus);
      if (value) params.set('search', value);
      router.push(`/admin/categories?${params.toString()}`);
    }, 300);
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormSlug('');
    setFormName('');
    setFormDescription('');
    setFormSortOrder(0);
    setFormIsActive(true);
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (cat: Category) => {
    setEditingCategory(cat);
    setFormSlug(cat.slug);
    setFormName(cat.name);
    setFormDescription(cat.description ?? '');
    setFormSortOrder(cat.sortOrder);
    setFormIsActive(cat.isActive);
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        slug: formSlug,
        name: formName,
        description: formDescription || undefined,
        sort_order: formSortOrder,
        is_active: formIsActive,
      };

      let res: Response;
      if (editingCategory) {
        res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save category');
      }

      setDialogOpen(false);
      setSaveError(null);
      toast.success(editingCategory ? t('dashboard.admin.categories.updateSuccess') : t('dashboard.admin.categories.createSuccess'));
      fetchCategories();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('dashboard.admin.categories.actionError');
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete category');
      }
      setDeleteId(null);
      toast.success(t('dashboard.admin.categories.deleteSuccess'));
      fetchCategories();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('dashboard.admin.categories.actionError');
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.categories.title')}</h1>
            <p className="text-muted-foreground">{t('dashboard.admin.categories.subtitle')}</p>
          </div>
          <Button onClick={openCreateDialog}>{t('dashboard.admin.categories.create')}</Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索分类名称或 slug..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateFilter(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  currentStatus === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {filterLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchCategories} className="mt-2 text-sm text-primary hover:underline">
            {t('dashboard.admin.categories.retry')}
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.categories.emptyTitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground">点击「{t('dashboard.admin.categories.create')}」创建第一个分类</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.categories.columns.name')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.categories.columns.slug')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.categories.columns.description')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.categories.columns.sortOrder')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.categories.columns.status')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.categories.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                    {cat.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">{cat.sortOrder}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={cat.isActive ? 'default' : 'secondary'}>
                      {cat.isActive ? t('dashboard.admin.categories.enabled') : t('dashboard.admin.categories.disabled')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(cat.id)}>
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {pagination.total} 个分类
        </p>
        {pagination.totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={pagination.totalPages} />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('dashboard.admin.categories.form.editTitle') : t('dashboard.admin.categories.form.createTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('dashboard.admin.categories.form.name')}</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('dashboard.admin.categories.form.name')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('dashboard.admin.categories.form.slug')}</Label>
              <Input
                id="slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="url-friendly-slug"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('dashboard.admin.categories.form.description')}</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('dashboard.admin.categories.form.description') + '（可选）'}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t('dashboard.admin.categories.form.sortOrder')}</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">{t('dashboard.admin.categories.columns.status')}</Label>
              <Switch
                id="isActive"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>
          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName || !formSlug}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.categories.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.categories.deleteConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
