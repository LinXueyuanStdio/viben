'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebouncedCallback } from 'use-debounce';

interface CollectionItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  forksCount: number;
  bookmarksCount: number;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerDisplayName: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CollectionModeration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');

  const currentVisibility = searchParams.get('visibility') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSearch = searchParams.get('search') || '';

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        visibility: currentVisibility,
      });
      if (currentSearch) params.set('search', currentSearch);
      const res = await fetch(`/api/admin/collections?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch collections');
      const data = await res.json();
      setCollections(data.collections);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.collections.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentVisibility, currentSearch, t]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/collections?${params.toString()}`);
  };

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateFilter('search', value);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/collections/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete collection');
      fetchCollections();
    } catch {
      toast.error(t('dashboard.admin.collections.deleteError'));
    } finally {
      setDeleteId(null);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.collections.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.collections.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('dashboard.admin.collections.searchPlaceholder')}
            value={searchValue}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'public', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => updateFilter('visibility', v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentVisibility === v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {v === 'all' ? t('dashboard.admin.collections.filterAll') : v === 'public' ? t('dashboard.admin.collections.filterPublic') : t('dashboard.admin.collections.filterPrivate')}
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
          <button onClick={fetchCollections} className="mt-2 text-sm text-primary hover:underline">{t('dashboard.admin.collections.retry')}</button>
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.collections.emptyTitle')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.collections.columns.name')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.collections.columns.author')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.collections.columns.items')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.collections.columns.favorites')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.collections.columns.visibility')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.collections.columns.createdAt')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.collections.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    @{c.ownerName}
                  </td>
                  <td className="px-4 py-3 text-sm">{c.itemCount}</td>
                  <td className="px-4 py-3 text-sm">{c.bookmarksCount}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={c.isPublic ? 'default' : 'secondary'}>
                      {c.isPublic ? t('dashboard.admin.collections.filterPublic') : t('dashboard.admin.collections.filterPrivate')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(c.id)}
                      title={t('dashboard.admin.collections.delete')}
                    >
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
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/collections?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {t('dashboard.admin.collections.showing', { count: collections.length, total: pagination.total })}
      </p>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.collections.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.collections.deleteConfirmDesc')}
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
