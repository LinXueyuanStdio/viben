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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Pencil, Trash2, ArrowLeft, Plus, Clock } from 'lucide-react';

interface OperationSlot {
  id: string; uid: string; surface: string; slotKey: string; name: string;
  description: string | null; layoutType: string; locale: string;
  minItems: number; maxItems: number; sortOrder: number; isActive: boolean; fallbackStrategy: string;
}

interface OperationItem {
  id: string; uid: string; slotId: string; itemType: string;
  targetEntityType: string | null; targetEntityId: string | null; targetEntityUid: string | null; targetUrl: string | null;
  title: string; subtitle: string | null; description: string | null;
  imageUrl: string | null; ctaLabel: string | null; badgeLabel: string | null;
  locale: string; startsAt: string | null; endsAt: string | null;
  sortOrder: number; isActive: boolean; visibility: 'draft' | 'scheduled' | 'published' | 'archived';
}

export function OperationManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const VISIBILITY_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: t('dashboard.admin.operations.visibility.draft'), variant: 'secondary' },
    scheduled: { label: t('dashboard.admin.operations.visibility.scheduled'), variant: 'default' },
    published: { label: t('dashboard.admin.operations.visibility.published'), variant: 'default' },
    archived: { label: t('dashboard.admin.operations.visibility.archived'), variant: 'outline' },
  };

  // Slot list
  const [slots, setSlots] = useState<OperationSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Slot dialog
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<OperationSlot | null>(null);
  const [formUid, setFormUid] = useState('');
  const [formSurface, setFormSurface] = useState('');
  const [formSlotKey, setFormSlotKey] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLayoutType, setFormLayoutType] = useState('list');
  const [formLocale, setFormLocale] = useState('default');
  const [formMinItems, setFormMinItems] = useState(0);
  const [formMaxItems, setFormMaxItems] = useState(10);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formFallbackStrategy, setFormFallbackStrategy] = useState('none');

  // Items sub-view
  const slotIdParam = searchParams.get('slot_id');
  const [selectedSlot, setSelectedSlot] = useState<OperationSlot | null>(null);
  const [items, setItems] = useState<OperationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OperationItem | null>(null);
  const [itemUid, setItemUid] = useState('');
  const [itemType, setItemType] = useState('');
  const [itemTargetUrl, setItemTargetUrl] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemSubtitle, setItemSubtitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemCtaLabel, setItemCtaLabel] = useState('');
  const [itemBadgeLabel, setItemBadgeLabel] = useState('');
  const [itemLocale, setItemLocale] = useState('default');
  const [itemStartsAt, setItemStartsAt] = useState('');
  const [itemEndsAt, setItemEndsAt] = useState('');
  const [itemTargetEntityType, setItemTargetEntityType] = useState('');
  const [itemTargetEntityId, setItemTargetEntityId] = useState('');
  const [itemTargetEntityUid, setItemTargetEntityUid] = useState('');
  const [itemSortOrder, setItemSortOrder] = useState(0);
  const [itemIsActive, setItemIsActive] = useState(true);
  const [itemVisibility, setItemVisibility] = useState<'draft' | 'scheduled' | 'published' | 'archived'>('draft');

  // Pagination
  const ITEMS_PAGE_SIZE = 10;
  const [itemsPage, setItemsPage] = useState(1);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'slot' | 'item'; id: string; label: string } | null>(null);

  // Revisions
  const [revisionsDialogOpen, setRevisionsDialogOpen] = useState(false);
  const [revisionsSurface, setRevisionsSurface] = useState('');
  const [revisionsLocale, setRevisionsLocale] = useState('');
  const [revisions, setRevisions] = useState<{
    id: string; uid: string; revisionNumber: number;
    status: string; publishedAt: string | null; publishedBy: string | null;
    createdBy: string | null; createdAt: string;
  }[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/operations/slots');
      if (!res.ok) throw new Error('Failed to fetch slots');
      const data = await res.json();
      setSlots(data.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.operations.loadError'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Slot CRUD
  const openSlotCreate = () => {
    setEditingSlot(null);
    setFormUid(''); setFormSurface(''); setFormSlotKey(''); setFormName(''); setFormDescription('');
    setFormLayoutType('list'); setFormLocale('default'); setFormMinItems(0); setFormMaxItems(10);
    setFormSortOrder(0); setFormIsActive(true); setFormFallbackStrategy('none');
    setSlotDialogOpen(true);
  };

  const openSlotEdit = (slot: OperationSlot) => {
    setEditingSlot(slot);
    setFormUid(slot.uid); setFormSurface(slot.surface); setFormSlotKey(slot.slotKey);
    setFormName(slot.name); setFormDescription(slot.description ?? ''); setFormLayoutType(slot.layoutType);
    setFormLocale(slot.locale); setFormMinItems(slot.minItems); setFormMaxItems(slot.maxItems);
    setFormSortOrder(slot.sortOrder); setFormIsActive(slot.isActive); setFormFallbackStrategy(slot.fallbackStrategy);
    setSlotDialogOpen(true);
  };

  const handleSlotSave = async () => {
    setSaving(true);
    try {
      const body = { uid: formUid, surface: formSurface, slot_key: formSlotKey, name: formName,
        description: formDescription || null, layout_type: formLayoutType, locale: formLocale,
        min_items: formMinItems, max_items: formMaxItems, sort_order: formSortOrder,
        is_active: formIsActive, fallback_strategy: formFallbackStrategy };
      const res = editingSlot
        ? await fetch(`/api/admin/operations/slots/${editingSlot.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/admin/operations/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to save slot'); }
      setSlotDialogOpen(false);
      fetchSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.operations.actionError'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'slot') {
        await fetch(`/api/admin/operations/slots/${deleteTarget.id}`, { method: 'DELETE' });
        fetchSlots();
      } else {
        await fetch(`/api/admin/operations/items/${deleteTarget.id}`, { method: 'DELETE' });
        if (selectedSlot) fetchItems(selectedSlot);
      }
      setDeleteTarget(null);
    } catch {
      setError(deleteTarget.type === 'slot' ? t('dashboard.admin.operations.actionError') : t('dashboard.admin.operations.deleteItemError'));
    } finally { setDeleting(false); }
  };

  const fetchRevisions = async (surface: string, locale: string) => {
    setRevisionsSurface(surface);
    setRevisionsLocale(locale);
    setRevisionsDialogOpen(true);
    setRevisionsLoading(true);
    try {
      const res = await fetch(`/api/admin/operations/revisions?surface=${encodeURIComponent(surface)}&locale=${encodeURIComponent(locale)}`);
      if (!res.ok) throw new Error('Failed to fetch revisions');
      setRevisions((await res.json()).revisions);
    } catch {
      setRevisions([]);
    } finally { setRevisionsLoading(false); }
  };

  // Items
  const fetchItems = async (slot: OperationSlot) => {
    setItemsLoading(true);
    setItemsPage(1);
    try {
      const res = await fetch(`/api/admin/operations/slots/${slot.id}/items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      setItems((await res.json()).items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.operations.loadError'));
    } finally { setItemsLoading(false); }
  };

  const openSlotItems = (slot: OperationSlot) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('slot_id', slot.id);
    router.push(`/admin/operations?${params.toString()}`);
    setSelectedSlot(slot);
    fetchItems(slot);
  };

  const backToSlots = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('slot_id');
    router.push(`/admin/operations?${params.toString()}`);
    setSelectedSlot(null);
  };

  const openItemCreate = () => {
    setEditingItem(null);
    setItemUid(''); setItemType(''); setItemTargetUrl(''); setItemTitle(''); setItemSubtitle('');
    setItemDescription(''); setItemImageUrl(''); setItemCtaLabel(''); setItemBadgeLabel('');
    setItemLocale('default'); setItemStartsAt(''); setItemEndsAt('');
    setItemTargetEntityType(''); setItemTargetEntityId(''); setItemTargetEntityUid('');
    setItemSortOrder(items.length); setItemIsActive(true); setItemVisibility('draft');
    setItemDialogOpen(true);
  };

  const openItemEdit = (item: OperationItem) => {
    setEditingItem(item);
    setItemUid(item.uid); setItemType(item.itemType); setItemTargetUrl(item.targetUrl ?? '');
    setItemTitle(item.title); setItemSubtitle(item.subtitle ?? ''); setItemDescription(item.description ?? '');
    setItemImageUrl(item.imageUrl ?? ''); setItemCtaLabel(item.ctaLabel ?? ''); setItemBadgeLabel(item.badgeLabel ?? '');
    setItemLocale(item.locale); setItemStartsAt(item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : '');
    setItemEndsAt(item.endsAt ? new Date(item.endsAt).toISOString().slice(0, 16) : '');
    setItemTargetEntityType(item.targetEntityType ?? ''); setItemTargetEntityId(item.targetEntityId ?? ''); setItemTargetEntityUid(item.targetEntityUid ?? '');
    setItemSortOrder(item.sortOrder); setItemIsActive(item.isActive); setItemVisibility(item.visibility);
    setItemDialogOpen(true);
  };

  const handleItemSave = async () => {
    if (!selectedSlot && !editingItem) return;
    setSaving(true);
    try {
      const body = { uid: itemUid, item_type: itemType,
        target_entity_type: itemTargetEntityType || null,
        target_entity_id: itemTargetEntityId || null,
        target_entity_uid: itemTargetEntityUid || null,
        target_url: itemTargetUrl || null,
        title: itemTitle, subtitle: itemSubtitle || null, description: itemDescription || null,
        image_url: itemImageUrl || null, cta_label: itemCtaLabel || null, badge_label: itemBadgeLabel || null,
        locale: itemLocale, starts_at: itemStartsAt || null, ends_at: itemEndsAt || null,
        sort_order: itemSortOrder, is_active: itemIsActive, visibility: itemVisibility };
      const res = editingItem
        ? await fetch(`/api/admin/operations/items/${editingItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/admin/operations/slots/${selectedSlot!.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to save item'); }
      setItemDialogOpen(false);
      if (selectedSlot) fetchItems(selectedSlot);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.operations.itemActionError'));
    } finally { setSaving(false); }
  };

  // Items sub-view
  if (slotIdParam || selectedSlot) {
    if (!selectedSlot && slotIdParam) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    const slot = selectedSlot!;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={backToSlots}><ArrowLeft className="h-4 w-4 mr-1" />{t('dashboard.admin.operations.backToList')}</Button>
            <div>
              <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.operations.itemDetail', { name: slot.name })}</h1>
              <p className="text-muted-foreground">{t('dashboard.admin.operations.form.surface')}: {slot.surface} &middot; {t('dashboard.admin.operations.form.slotKey')}: {slot.slotKey} &middot; {t('dashboard.admin.operations.form.layoutType')}: {slot.layoutType}</p>
            </div>
          </div>
          <Button onClick={openItemCreate}><Plus className="h-4 w-4 mr-1" />{t('dashboard.admin.operations.addItem')}</Button>
        </div>
        {itemsLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">{t('dashboard.admin.operations.emptyItems')}</p></div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium w-12">#</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.itemColumns.title')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.itemColumns.type')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.itemColumns.target')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.itemColumns.status')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.operations.itemColumns.actions')}</th>
              </tr></thead>
              <tbody>
                {(() => {
                  const totalPages = Math.ceil(items.length / ITEMS_PAGE_SIZE);
                  const safePage = Math.min(itemsPage, Math.max(1, totalPages));
                  const startIdx = (safePage - 1) * ITEMS_PAGE_SIZE;
                  const pageItems = items.slice(startIdx, startIdx + ITEMS_PAGE_SIZE);
                  return pageItems.map((item) => {
                    const visConf = VISIBILITY_CONFIG[item.visibility] || VISIBILITY_CONFIG.draft;
                    return (<tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.sortOrder}</td>
                      <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">{item.title}{item.badgeLabel && <Badge variant="secondary" className="ml-2">{item.badgeLabel}</Badge>}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.itemType}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[150px] truncate">{item.targetUrl || item.targetEntityId || '-'}</td>
                      <td className="px-4 py-3 text-sm"><div className="flex gap-1"><Badge variant={visConf.variant}>{visConf.label}</Badge>{!item.isActive && <Badge variant="secondary">{t('dashboard.admin.operations.inactive')}</Badge>}</div></td>
                      <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openItemEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: 'item', id: item.id, label: item.title })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div></td>
                    </tr>);
                  });
                })()}
              </tbody>
            </table>
            {(() => {
              const totalPages = Math.ceil(items.length / ITEMS_PAGE_SIZE);
              if (totalPages <= 1) return null;
              return (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">{t('dashboard.admin.operations.pagination.showing', { current: itemsPage, total: totalPages, count: items.length })}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={itemsPage <= 1} onClick={() => setItemsPage((p) => Math.max(1, p - 1))}>{t('dashboard.admin.operations.pagination.previous')}</Button>
                    <Button variant="outline" size="sm" disabled={itemsPage >= totalPages} onClick={() => setItemsPage((p) => Math.min(totalPages, p + 1))}>{t('dashboard.admin.operations.pagination.next')}</Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {/* Item Dialog */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingItem ? t('dashboard.admin.operations.editItem') : t('dashboard.admin.operations.addItem')}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="itemUid">{t('dashboard.admin.operations.form.uid')}</Label><Input id="itemUid" value={itemUid} onChange={(e) => setItemUid(e.target.value)} placeholder={t('dashboard.admin.operations.form.uid')} /></div>
                <div className="space-y-2"><Label htmlFor="itemType">{t('dashboard.admin.operations.form.contentType')}</Label><Input id="itemType" value={itemType} onChange={(e) => setItemType(e.target.value)} placeholder="banner, card" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="itemTitle">{t('dashboard.admin.operations.form.title')}</Label><Input id="itemTitle" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder={t('dashboard.admin.operations.form.title')} /></div>
              <div className="space-y-2"><Label htmlFor="itemSubtitle">{t('dashboard.admin.operations.form.subtitle')}</Label><Input id="itemSubtitle" value={itemSubtitle} onChange={(e) => setItemSubtitle(e.target.value)} placeholder={t('common.optional')} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="itemTargetUrl">{t('dashboard.admin.operations.form.linkUrl')}</Label><Input id="itemTargetUrl" value={itemTargetUrl} onChange={(e) => setItemTargetUrl(e.target.value)} placeholder={t('common.optional')} /></div>
                <div className="space-y-2"><Label htmlFor="itemImageUrl">{t('dashboard.admin.operations.form.imageUrl')}</Label><Input id="itemImageUrl" value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} placeholder={t('common.optional')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="itemLocale">{t('dashboard.admin.operations.form.locale')}</Label><Input id="itemLocale" value={itemLocale} onChange={(e) => setItemLocale(e.target.value)} placeholder="zh-CN, en-US" /></div>
                <div className="space-y-2"><Label htmlFor="itemTargetEntityType">{t('dashboard.admin.operations.form.targetEntityType')}</Label><Input id="itemTargetEntityType" value={itemTargetEntityType} onChange={(e) => setItemTargetEntityType(e.target.value)} placeholder={t('common.optional')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="itemTargetEntityId">{t('dashboard.admin.operations.form.targetEntityId')}</Label><Input id="itemTargetEntityId" value={itemTargetEntityId} onChange={(e) => setItemTargetEntityId(e.target.value)} placeholder={t('common.optional')} /></div>
                <div className="space-y-2"><Label htmlFor="itemTargetEntityUid">{t('dashboard.admin.operations.form.targetEntityUid')}</Label><Input id="itemTargetEntityUid" value={itemTargetEntityUid} onChange={(e) => setItemTargetEntityUid(e.target.value)} placeholder={t('common.optional')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="itemStartsAt">{t('dashboard.admin.operations.form.startsAt')}</Label><Input id="itemStartsAt" type="datetime-local" value={itemStartsAt} onChange={(e) => setItemStartsAt(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="itemEndsAt">{t('dashboard.admin.operations.form.endsAt')}</Label><Input id="itemEndsAt" type="datetime-local" value={itemEndsAt} onChange={(e) => setItemEndsAt(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label htmlFor="itemCtaLabel">{t('dashboard.admin.operations.form.ctaLabel')}</Label><Input id="itemCtaLabel" value={itemCtaLabel} onChange={(e) => setItemCtaLabel(e.target.value)} placeholder={t('common.optional')} /></div>
                <div className="space-y-2"><Label htmlFor="itemBadgeLabel">{t('dashboard.admin.operations.form.badgeLabel')}</Label><Input id="itemBadgeLabel" value={itemBadgeLabel} onChange={(e) => setItemBadgeLabel(e.target.value)} placeholder={t('common.optional')} /></div>
                <div className="space-y-2"><Label htmlFor="itemSortOrder">{t('dashboard.admin.operations.form.sortOrder')}</Label><Input id="itemSortOrder" type="number" value={itemSortOrder} onChange={(e) => setItemSortOrder(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('dashboard.admin.operations.form.visibility')}</Label>
                  <Select value={itemVisibility} onValueChange={(v) => setItemVisibility(v as typeof itemVisibility)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('dashboard.admin.operations.visibility.draft')}</SelectItem><SelectItem value="scheduled">{t('dashboard.admin.operations.visibility.scheduled')}</SelectItem>
                      <SelectItem value="published">{t('dashboard.admin.operations.visibility.published')}</SelectItem><SelectItem value="archived">{t('dashboard.admin.operations.visibility.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6"><Label htmlFor="itemIsActive">{t('dashboard.admin.operations.active')}</Label><Switch id="itemIsActive" checked={itemIsActive} onCheckedChange={setItemIsActive} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setItemDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleItemSave} disabled={saving || !itemUid || !itemType || !itemTitle}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Slot list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.operations.title')}</h1><p className="text-muted-foreground">{t('dashboard.admin.operations.subtitle')}</p></div>
        <Button onClick={openSlotCreate}><Plus className="h-4 w-4 mr-1" />{t('dashboard.admin.operations.create')}</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchSlots} className="mt-2 text-sm text-primary hover:underline">{t('dashboard.admin.operations.retry')}</button></div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">{t('dashboard.admin.operations.emptySlots')}</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.name')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.surface')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.slotKey')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.layoutType')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.locale')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.status')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.columns.minMax')}</th><th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.operations.columns.actions')}</th>
            </tr></thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{slot.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{slot.surface}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{slot.slotKey}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{slot.layoutType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{slot.locale}</td>
                  <td className="px-4 py-3 text-sm"><Badge variant={slot.isActive ? 'default' : 'secondary'}>{slot.isActive ? t('dashboard.admin.operations.active') : t('dashboard.admin.operations.inactive')}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{slot.minItems} - {slot.maxItems}</td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => fetchRevisions(slot.surface, slot.locale)} title={t('dashboard.admin.operations.revisions.button')}><Clock className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => openSlotItems(slot)}>{t('dashboard.admin.operations.manageItems')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => openSlotEdit(slot)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: 'slot', id: slot.id, label: slot.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t('dashboard.admin.operations.showing', { count: slots.length })}</p>

      {/* Slot Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSlot ? t('dashboard.admin.operations.edit') : t('dashboard.admin.operations.create')}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="slotUid">{t('dashboard.admin.operations.form.uid')}</Label><Input id="slotUid" value={formUid} onChange={(e) => setFormUid(e.target.value)} placeholder={t('dashboard.admin.operations.form.uid')} /></div>
              <div className="space-y-2"><Label htmlFor="slotName">{t('dashboard.admin.operations.form.name')}</Label><Input id="slotName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t('dashboard.admin.operations.form.name')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="surface">{t('dashboard.admin.operations.form.surface')}</Label><Input id="surface" value={formSurface} onChange={(e) => setFormSurface(e.target.value)} placeholder="home_page" /></div>
              <div className="space-y-2"><Label htmlFor="slotKey">{t('dashboard.admin.operations.form.slotKey')}</Label><Input id="slotKey" value={formSlotKey} onChange={(e) => setFormSlotKey(e.target.value)} placeholder="hero_banner" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="slotDescription">{t('dashboard.admin.operations.form.description')}</Label><Textarea id="slotDescription" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={t('common.optional')} rows={2} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label htmlFor="layoutType">{t('dashboard.admin.operations.form.layoutType')}</Label>
                <Select value={formLayoutType} onValueChange={setFormLayoutType}><SelectTrigger id="layoutType"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="list">{t('dashboard.admin.operations.layoutTypes.list')}</SelectItem><SelectItem value="grid">{t('dashboard.admin.operations.layoutTypes.grid')}</SelectItem><SelectItem value="carousel">{t('dashboard.admin.operations.layoutTypes.carousel')}</SelectItem><SelectItem value="hero">{t('dashboard.admin.operations.layoutTypes.hero')}</SelectItem><SelectItem value="sidebar">{t('dashboard.admin.operations.layoutTypes.sidebar')}</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label htmlFor="locale">{t('dashboard.admin.operations.form.locale')}</Label><Input id="locale" value={formLocale} onChange={(e) => setFormLocale(e.target.value)} placeholder="default" /></div>
              <div className="space-y-2"><Label htmlFor="sortOrder">{t('dashboard.admin.operations.form.sortOrder')}</Label><Input id="sortOrder" type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="minItems">{t('dashboard.admin.operations.form.minItems')}</Label><Input id="minItems" type="number" value={formMinItems} onChange={(e) => setFormMinItems(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label htmlFor="maxItems">{t('dashboard.admin.operations.form.maxItems')}</Label><Input id="maxItems" type="number" value={formMaxItems} onChange={(e) => setFormMaxItems(Number(e.target.value))} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="fallbackStrategy">{t('dashboard.admin.operations.form.fallbackStrategy')}</Label>
              <Select value={formFallbackStrategy} onValueChange={setFormFallbackStrategy}><SelectTrigger id="fallbackStrategy"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">{t('dashboard.admin.operations.fallbackStrategies.none')}</SelectItem><SelectItem value="show_default">{t('dashboard.admin.operations.fallbackStrategies.showDefault')}</SelectItem><SelectItem value="hide_slot">{t('dashboard.admin.operations.fallbackStrategies.hideSlot')}</SelectItem></SelectContent></Select>
            </div>
            <div className="flex items-center justify-between"><Label htmlFor="slotIsActive">{t('dashboard.admin.operations.form.isActive')}</Label><Switch id="slotIsActive" checked={formIsActive} onCheckedChange={setFormIsActive} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSlotSave} disabled={saving || !formUid || !formSurface || !formSlotKey || !formName}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.operations.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'slot'
                ? t('dashboard.admin.operations.deleteConfirmDesc')
                : t('dashboard.admin.operations.deleteItemConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revisions Dialog */}
      <Dialog open={revisionsDialogOpen} onOpenChange={setRevisionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.operations.revisions.title')}</DialogTitle>
            <DialogDescription>
              {revisionsSurface} &middot; {revisionsLocale}
            </DialogDescription>
          </DialogHeader>
          {revisionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">{t('dashboard.admin.operations.revisions.noRevisions')}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.revisions.revisionNumber')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.revisions.status')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.revisions.publishedAt')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.revisions.publishedBy')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.revisions.createdBy')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.operations.revisions.createdAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((rev) => (
                    <tr key={rev.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-mono">#{rev.revisionNumber}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={
                          rev.status === 'published' ? 'default' :
                          rev.status === 'draft' ? 'secondary' :
                          rev.status === 'rolled_back' ? 'destructive' : 'outline'
                        }>{rev.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{rev.publishedAt ? new Date(rev.publishedAt).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{rev.publishedBy || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{rev.createdBy || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(rev.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionsDialogOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
