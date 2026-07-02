'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Trash2, Search, Eye, Pencil, X, Check, Package, Sparkles, User, Calendar, Bookmark, GitFork } from 'lucide-react';
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
import { formatDate } from '@/lib/utils';

// ============================================
// Types
// ============================================

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

interface CollectionDetailItem {
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  itemName: string;
  itemSlug: string | null;
  note: string | null;
  position: number;
  addedAt: string;
}

interface CollectionDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  forksCount: number;
  bookmarksCount: number;
  createdAt: string;
  updatedAt: string;
  forkedFromId: string | null;
  ownerId: string;
  ownerName: string;
  ownerDisplayName: string;
}

// ============================================
// Component
// ============================================

export function CollectionModeration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  // List state
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');

  // Detail state
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [detailItems, setDetailItems] = useState<CollectionDetailItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentVisibility = searchParams.get('visibility') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSearch = searchParams.get('search') || '';

  // ============================================
  // Fetch list
  // ============================================

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

  // ============================================
  // Fetch detail
  // ============================================

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/admin/collections/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setDetailError('Collection not found');
        } else {
          throw new Error('Failed to fetch collection detail');
        }
        return;
      }
      const data = await res.json();
      setDetail(data.collection);
      setDetailItems(data.items || []);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : t('dashboard.admin.collections.loadError'));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  // Open detail dialog
  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setIsEditing(false);
    setDetail(null);
    setDetailItems([]);
    setDetailError(null);
    fetchDetail(id);
  }, [fetchDetail]);

  // Close detail dialog
  const closeDetail = useCallback(() => {
    setDetailId(null);
    setDetail(null);
    setDetailItems([]);
    setDetailError(null);
    setIsEditing(false);
  }, []);

  // Start editing
  const startEditing = useCallback(() => {
    if (!detail) return;
    setEditName(detail.name);
    setEditDescription(detail.description ?? '');
    setEditIsPublic(detail.isPublic);
    setIsEditing(true);
  }, [detail]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Save changes
  const saveChanges = useCallback(async () => {
    if (!detailId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editName !== detail?.name) body.name = editName;
      if (editDescription !== (detail?.description ?? '')) body.description = editDescription || null;
      if (editIsPublic !== detail?.isPublic) body.isPublic = editIsPublic;

      if (Object.keys(body).length === 0) {
        setIsEditing(false);
        return;
      }

      const res = await fetch(`/api/admin/collections/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update collection');
      }

      toast.success(t('dashboard.admin.collections.editSuccess'));
      setIsEditing(false);
      fetchDetail(detailId);
      fetchCollections();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.admin.collections.editError'));
    } finally {
      setSaving(false);
    }
  }, [detailId, editName, editDescription, editIsPublic, detail, fetchDetail, fetchCollections, t]);

  // ============================================
  // Filter handlers
  // ============================================

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

  // ============================================
  // Delete handler
  // ============================================

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/collections/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete collection');
      toast.success(t('dashboard.admin.collections.deleteSuccess'));
      fetchCollections();
    } catch {
      toast.error(t('dashboard.admin.collections.deleteError'));
    } finally {
      setDeleteId(null);
      setDeleting(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  const ItemTypeIcon = ({ type }: { type: 'mcp' | 'skill' }) =>
    type === 'mcp' ? <Package className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.collections.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.collections.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
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

      {/* Content */}
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
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => openDetail(c.id)}
                >
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
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDetail(c.id)}
                        title={t('dashboard.admin.collections.viewDetails')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(c.id)}
                        title={t('dashboard.admin.collections.delete')}
                      >
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

      {/* Pagination */}
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

      {/* Delete Confirmation Dialog */}
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

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={closeDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && !isEditing && detail.name}
              {isEditing && t('dashboard.admin.collections.editTitle')}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {detailError && (
            <div className="py-8 text-center text-destructive">{detailError}</div>
          )}

          {detail && !detailLoading && !isEditing && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Header Info */}
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={detail.isPublic ? 'default' : 'secondary'}>
                        {detail.isPublic ? t('dashboard.admin.collections.filterPublic') : t('dashboard.admin.collections.filterPrivate')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />@{detail.ownerName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(detail.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    {t('dashboard.admin.collections.itemCount', { count: detail.itemCount })}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Bookmark className="h-4 w-4" />
                    {t('dashboard.admin.collections.bookmarkCount', { count: detail.bookmarksCount })}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <GitFork className="h-4 w-4" />
                    {t('dashboard.admin.collections.forkCount', { count: detail.forksCount })}
                  </span>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.collections.detailDescription')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {detail.description || t('dashboard.admin.collections.noDescription')}
                  </p>
                </div>

                {/* Slug & ID */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.collections.detailMeta')}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Slug: </span>
                      <span className="font-mono text-xs">{detail.slug}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ID: </span>
                      <span className="font-mono text-xs">{detail.id.slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Items List */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.collections.detailItems')} ({detailItems.length})</h4>
                  {detailItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('dashboard.admin.collections.noItems')}</p>
                  ) : (
                    <div className="space-y-2">
                      {detailItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                        >
                          <ItemTypeIcon type={item.itemType as 'mcp' | 'skill'} />
                          <span className="flex-1 font-medium">{item.itemName}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.itemType === 'mcp' ? 'MCP' : 'Skill'}
                          </Badge>
                          {item.note && (
                            <span className="text-muted-foreground text-xs max-w-[200px] truncate" title={item.note}>
                              {item.note}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    {t('dashboard.admin.collections.edit')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      closeDetail();
                      setDeleteId(detail.id);
                    }}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {t('dashboard.admin.collections.delete')}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Edit Mode */}
          {detail && isEditing && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t('dashboard.admin.collections.editName')}</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-desc">{t('dashboard.admin.collections.editDescription')}</Label>
                  <Textarea
                    id="edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="edit-visibility">{t('dashboard.admin.collections.editVisibility')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {editIsPublic ? t('dashboard.admin.collections.filterPublic') : t('dashboard.admin.collections.filterPrivate')}
                    </p>
                  </div>
                  <Switch
                    id="edit-visibility"
                    checked={editIsPublic}
                    onCheckedChange={setEditIsPublic}
                  />
                </div>

                <Separator />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                    <X className="mr-1.5 h-4 w-4" />
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={saveChanges} disabled={saving || !editName.trim()}>
                    {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
