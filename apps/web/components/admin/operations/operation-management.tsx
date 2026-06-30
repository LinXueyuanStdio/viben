'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
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
import { Loader2, Pencil, Trash2, ArrowLeft, Plus } from 'lucide-react';

interface OperationSlot {
  id: string;
  uid: string;
  surface: string;
  slotKey: string;
  name: string;
  description: string | null;
  layoutType: string;
  locale: string;
  minItems: number;
  maxItems: number;
  sortOrder: number;
  isActive: boolean;
  fallbackStrategy: string;
}

interface OperationItem {
  id: string;
  uid: string;
  slotId: string;
  itemType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  targetUrl: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  badgeLabel: string | null;
  locale: string;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  isActive: boolean;
  visibility: 'draft' | 'scheduled' | 'published' | 'archived';
}

const VISIBILITY_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  scheduled: { label: '已排期', variant: 'default' },
  published: { label: '已发布', variant: 'default' },
  archived: { label: '已归档', variant: 'outline' },
};

export function OperationManagement() {
  // Slot list state
  const [slots, setSlots] = useState<OperationSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slot dialog state
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<OperationSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Slot form
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

  // Items sub-view state
  const [selectedSlot, setSelectedSlot] = useState<OperationSlot | null>(null);
  const [items, setItems] = useState<OperationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OperationItem | null>(null);

  // Item form
  const [itemUid, setItemUid] = useState('');
  const [itemType, setItemType] = useState('');
  const [itemTargetUrl, setItemTargetUrl] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemSubtitle, setItemSubtitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemCtaLabel, setItemCtaLabel] = useState('');
  const [itemBadgeLabel, setItemBadgeLabel] = useState('');
  const [itemSortOrder, setItemSortOrder] = useState(0);
  const [itemIsActive, setItemIsActive] = useState(true);
  const [itemVisibility, setItemVisibility] = useState<'draft' | 'scheduled' | 'published' | 'archived'>('draft');

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/operations/slots');
      if (!res.ok) throw new Error('Failed to fetch slots');
      const data = await res.json();
      setSlots(data.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Slot CRUD
  const openSlotCreate = () => {
    setEditingSlot(null);
    setFormUid('');
    setFormSurface('');
    setFormSlotKey('');
    setFormName('');
    setFormDescription('');
    setFormLayoutType('list');
    setFormLocale('default');
    setFormMinItems(0);
    setFormMaxItems(10);
    setFormSortOrder(0);
    setFormIsActive(true);
    setFormFallbackStrategy('none');
    setSlotDialogOpen(true);
  };

  const openSlotEdit = (slot: OperationSlot) => {
    setEditingSlot(slot);
    setFormUid(slot.uid);
    setFormSurface(slot.surface);
    setFormSlotKey(slot.slotKey);
    setFormName(slot.name);
    setFormDescription(slot.description ?? '');
    setFormLayoutType(slot.layoutType);
    setFormLocale(slot.locale);
    setFormMinItems(slot.minItems);
    setFormMaxItems(slot.maxItems);
    setFormSortOrder(slot.sortOrder);
    setFormIsActive(slot.isActive);
    setFormFallbackStrategy(slot.fallbackStrategy);
    setSlotDialogOpen(true);
  };

  const handleSlotSave = async () => {
    setSaving(true);
    try {
      const body = {
        uid: formUid,
        surface: formSurface,
        slot_key: formSlotKey,
        name: formName,
        description: formDescription || null,
        layout_type: formLayoutType,
        locale: formLocale,
        min_items: formMinItems,
        max_items: formMaxItems,
        sort_order: formSortOrder,
        is_active: formIsActive,
        fallback_strategy: formFallbackStrategy,
      };

      let res: Response;
      if (editingSlot) {
        res = await fetch(`/api/admin/operations/slots/${editingSlot.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/operations/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save slot');
      }

      setSlotDialogOpen(false);
      fetchSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save slot');
    } finally {
      setSaving(false);
    }
  };

  const handleSlotDelete = async (id: string) => {
    if (!confirm('确定删除此运营位？关联的条目也会被删除。')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/operations/slots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete slot');
      fetchSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slot');
    } finally {
      setDeletingId(null);
    }
  };

  // Items management
  const fetchItems = async (slot: OperationSlot) => {
    setSelectedSlot(slot);
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/admin/operations/slots/${slot.id}/items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setItemsLoading(false);
    }
  };

  const openItemCreate = () => {
    setEditingItem(null);
    setItemUid('');
    setItemType('');
    setItemTargetUrl('');
    setItemTitle('');
    setItemSubtitle('');
    setItemDescription('');
    setItemImageUrl('');
    setItemCtaLabel('');
    setItemBadgeLabel('');
    setItemSortOrder(items.length);
    setItemIsActive(true);
    setItemVisibility('draft');
    setItemDialogOpen(true);
  };

  const openItemEdit = (item: OperationItem) => {
    setEditingItem(item);
    setItemUid(item.uid);
    setItemType(item.itemType);
    setItemTargetUrl(item.targetUrl ?? '');
    setItemTitle(item.title);
    setItemSubtitle(item.subtitle ?? '');
    setItemDescription(item.description ?? '');
    setItemImageUrl(item.imageUrl ?? '');
    setItemCtaLabel(item.ctaLabel ?? '');
    setItemBadgeLabel(item.badgeLabel ?? '');
    setItemSortOrder(item.sortOrder);
    setItemIsActive(item.isActive);
    setItemVisibility(item.visibility);
    setItemDialogOpen(true);
  };

  const handleItemSave = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      const body = {
        uid: itemUid,
        item_type: itemType,
        target_url: itemTargetUrl || null,
        title: itemTitle,
        subtitle: itemSubtitle || null,
        description: itemDescription || null,
        image_url: itemImageUrl || null,
        cta_label: itemCtaLabel || null,
        badge_label: itemBadgeLabel || null,
        sort_order: itemSortOrder,
        is_active: itemIsActive,
        visibility: itemVisibility,
      };

      let res: Response;
      if (editingItem) {
        res = await fetch(`/api/admin/operations/items/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/admin/operations/slots/${selectedSlot.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save item');
      }

      setItemDialogOpen(false);
      if (selectedSlot) fetchItems(selectedSlot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleItemDelete = async (itemId: string) => {
    if (!confirm('确定删除此条目？')) return;
    setDeletingId(itemId);
    try {
      const res = await fetch(`/api/admin/operations/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      if (selectedSlot) fetchItems(selectedSlot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  // Items sub-view
  if (selectedSlot) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSlot(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
            <div>
              <h1 className="font-serif text-2xl font-bold">
                运营位条目 — {selectedSlot.name}
              </h1>
              <p className="text-muted-foreground">
                Surface: {selectedSlot.surface} · Slot: {selectedSlot.slotKey} · 布局: {selectedSlot.layoutType}
              </p>
            </div>
          </div>
          <Button onClick={openItemCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新建条目
          </Button>
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg text-muted-foreground">暂无条目</p>
            <p className="mt-2 text-sm text-muted-foreground">点击「新建条目」添加内容</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium w-12">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">目标</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const visConf = VISIBILITY_CONFIG[item.visibility] || VISIBILITY_CONFIG.draft;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.sortOrder}</td>
                      <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">
                        {item.title}
                        {item.badgeLabel && (
                          <Badge variant="secondary" className="ml-2">{item.badgeLabel}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.itemType}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[150px] truncate">
                        {item.targetUrl || item.targetEntityId || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-1">
                          <Badge variant={visConf.variant}>{visConf.label}</Badge>
                          {!item.isActive && <Badge variant="secondary">禁用</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openItemEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleItemDelete(item.id)}
                            disabled={deletingId === item.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Item Dialog */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? '编辑条目' : '新建条目'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemUid">UID</Label>
                  <Input id="itemUid" value={itemUid} onChange={(e) => setItemUid(e.target.value)} placeholder="唯一标识" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemType">条目类型</Label>
                  <Input id="itemType" value={itemType} onChange={(e) => setItemType(e.target.value)} placeholder="如 banner, card" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemTitle">标题</Label>
                <Input id="itemTitle" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder="条目标题" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemSubtitle">副标题</Label>
                <Input id="itemSubtitle" value={itemSubtitle} onChange={(e) => setItemSubtitle(e.target.value)} placeholder="（可选）" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemDescription">描述</Label>
                <Textarea id="itemDescription" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="（可选）" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemTargetUrl">目标链接</Label>
                  <Input id="itemTargetUrl" value={itemTargetUrl} onChange={(e) => setItemTargetUrl(e.target.value)} placeholder="（可选）" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemImageUrl">图片 URL</Label>
                  <Input id="itemImageUrl" value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} placeholder="（可选）" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemCtaLabel">按钮文案</Label>
                  <Input id="itemCtaLabel" value={itemCtaLabel} onChange={(e) => setItemCtaLabel(e.target.value)} placeholder="（可选）" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemBadgeLabel">角标</Label>
                  <Input id="itemBadgeLabel" value={itemBadgeLabel} onChange={(e) => setItemBadgeLabel(e.target.value)} placeholder="（可选）" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemSortOrder">排序</Label>
                  <Input id="itemSortOrder" type="number" value={itemSortOrder} onChange={(e) => setItemSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>可见性</Label>
                  <Select value={itemVisibility} onValueChange={(v) => setItemVisibility(v as typeof itemVisibility)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="scheduled">已排期</SelectItem>
                      <SelectItem value="published">已发布</SelectItem>
                      <SelectItem value="archived">已归档</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="itemIsActive">启用</Label>
                  <Switch id="itemIsActive" checked={itemIsActive} onCheckedChange={setItemIsActive} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleItemSave} disabled={saving || !itemUid || !itemType || !itemTitle}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
              </Button>
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
        <div>
          <h1 className="font-serif text-2xl font-bold">运营位管理</h1>
          <p className="text-muted-foreground">管理首页推荐位、Banner等运营内容位</p>
        </div>
        <Button onClick={openSlotCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新建运营位
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchSlots} className="mt-2 text-sm text-primary hover:underline">
            重试
          </button>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无运营位</p>
          <p className="mt-2 text-sm text-muted-foreground">点击「新建运营位」创建第一个运营位</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Surface</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Slot Key</th>
                <th className="px-4 py-3 text-left text-sm font-medium">布局</th>
                <th className="px-4 py-3 text-left text-sm font-medium">区域</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">条目限制</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{slot.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{slot.surface}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{slot.slotKey}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{slot.layoutType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{slot.locale}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={slot.isActive ? 'default' : 'secondary'}>
                      {slot.isActive ? '启用' : '禁用'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {slot.minItems} - {slot.maxItems}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchItems(slot)}
                      >
                        管理条目
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openSlotEdit(slot)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSlotDelete(slot.id)}
                        disabled={deletingId === slot.id}
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

      <p className="text-sm text-muted-foreground">
        共 {slots.length} 个运营位
      </p>

      {/* Slot Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? '编辑运营位' : '新建运营位'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slotUid">UID</Label>
                <Input id="slotUid" value={formUid} onChange={(e) => setFormUid(e.target.value)} placeholder="唯一标识" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slotName">名称</Label>
                <Input id="slotName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="运营位名称" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surface">Surface</Label>
                <Input id="surface" value={formSurface} onChange={(e) => setFormSurface(e.target.value)} placeholder="如 home_page" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slotKey">Slot Key</Label>
                <Input id="slotKey" value={formSlotKey} onChange={(e) => setFormSlotKey(e.target.value)} placeholder="如 hero_banner" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slotDescription">描述</Label>
              <Textarea id="slotDescription" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="（可选）" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="layoutType">布局类型</Label>
                <Select value={formLayoutType} onValueChange={setFormLayoutType}>
                  <SelectTrigger id="layoutType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">列表</SelectItem>
                    <SelectItem value="grid">网格</SelectItem>
                    <SelectItem value="carousel">轮播</SelectItem>
                    <SelectItem value="hero">Hero</SelectItem>
                    <SelectItem value="sidebar">侧边栏</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">区域</Label>
                <Input id="locale" value={formLocale} onChange={(e) => setFormLocale(e.target.value)} placeholder="default" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">排序</Label>
                <Input id="sortOrder" type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minItems">最小条目</Label>
                <Input id="minItems" type="number" value={formMinItems} onChange={(e) => setFormMinItems(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxItems">最大条目</Label>
                <Input id="maxItems" type="number" value={formMaxItems} onChange={(e) => setFormMaxItems(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="slotIsActive">启用状态</Label>
              <Switch id="slotIsActive" checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSlotSave} disabled={saving || !formUid || !formSurface || !formSlotKey || !formName}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
