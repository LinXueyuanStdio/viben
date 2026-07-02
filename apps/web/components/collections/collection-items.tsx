'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Server,
  Sparkles,
  Loader2,
  GripVertical,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { AddItemDialog } from './add-item-dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Package {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
}

interface CollectionItem {
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  note: string | null;
  position: number;
  addedAt: Date;
  package?: Package;
}

interface CollectionItemsProps {
  collectionId: string;
  items: CollectionItem[];
  isOwner: boolean;
}

interface UserCollection {
  id: string;
  name: string;
  itemCount: number;
}

function SortableItem({
  item,
  isOwner,
  isSelected,
  onToggleSelect,
  onRemove,
  removingId,
}: {
  item: CollectionItem;
  isOwner: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (itemId: string) => void;
  removingId: string | null;
}) {
  const { t } = useTranslation('collections');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isOwner });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const TypeIcon = item.itemType === 'mcp' ? Server : Sparkles;
  const typeRoute = item.itemType === 'mcp' ? '/mcp-market' : '/skill-market';
  const typeLabel = item.itemType === 'mcp' ? t('mcp') : t('skill');

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 ${isDragging ? 'opacity-50 z-10' : ''}`}
    >
      <div className="flex items-center gap-3">
        {isOwner && (
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
          />
        )}

        {isOwner && (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
          <TypeIcon className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {item.package ? (
            <Link
              href={`${typeRoute}/${item.package.id}`}
              className="font-semibold hover:text-primary"
            >
              {item.package.name}
            </Link>
          ) : (
            <span className="font-semibold text-muted-foreground">
              {t('unknownPackage')}
            </span>
          )}
          <p className="text-sm text-muted-foreground line-clamp-1">
            {item.package?.description || t('packageNotFound')}
          </p>
          {item.note && (
            <p className="mt-1 text-sm italic text-muted-foreground">
              &quot;{item.note}&quot;
            </p>
          )}
        </div>

        <Badge variant="secondary">{typeLabel}</Badge>

        {item.package && (
          <span className="text-sm text-muted-foreground">
            v{item.package.version}
          </span>
        )}

        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.itemId)}
            disabled={removingId === item.itemId}
          >
            {removingId === item.itemId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-destructive" />
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function CollectionItems({
  collectionId,
  items: initialItems,
  isOwner,
}: CollectionItemsProps) {
  const { t } = useTranslation('collections');
  const [items, setItems] = useState<CollectionItem[]>(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [userCollections, setUserCollections] = useState<UserCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [movingItems, setMovingItems] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function removeItem(itemId: string) {
    setRemovingId(itemId);
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/items/${itemId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        throw new Error('Failed to remove item');
      }

      setItems((prev) => prev.filter((i) => i.itemId !== itemId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        // Remove the matching item from selected set
        const item = items.find((i) => i.itemId === itemId);
        if (item) next.delete(item.id);
        return next;
      });
      toast.success(t('itemRemoved'));
    } catch {
      toast.error(t('failedToRemoveItem'));
    } finally {
      setRemovingId(null);
    }
  }

  async function handleBatchDelete() {
    setBatchDeleting(true);
    try {
      const itemIds = items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => item.itemId);

      const res = await fetch(
        `/api/collections/${collectionId}/items`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to batch delete');
      }

      setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      setConfirmBatchDelete(false);
      toast.success(t('batchDeleteSuccess') || 'Items removed');
    } catch {
      toast.error(t('batchDeleteError') || 'Failed to remove items');
    } finally {
      setBatchDeleting(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return prev;

      const newItems = arrayMove(prev, oldIndex, newIndex);

      // Update positions locally
      const repositioned = newItems.map((item, index) => ({
        ...item,
        position: index,
      }));

      // Sync to server
      fetch(`/api/collections/${collectionId}/items/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: repositioned.map((item) => ({
            itemId: item.itemId,
            position: item.position,
          })),
        }),
      }).catch(() => {
        // Silently fail - the user already sees the optimistic result
      });

      return repositioned;
    });
  }

  function handleItemAdded(newItem: CollectionItem) {
    setItems((prev) => [...prev, newItem]);
  }

  async function fetchUserCollections() {
    setLoadingCollections(true);
    try {
      const res = await fetch('/api/collections?mine=true');
      if (!res.ok) throw new Error('Failed to fetch collections');
      const data = await res.json();
      // Filter out current collection
      const collections = (data.collections || []).filter(
        (c: UserCollection) => c.id !== collectionId
      );
      setUserCollections(collections);
    } catch {
      toast.error(t('failedToLoadCollections') || 'Failed to load collections');
    } finally {
      setLoadingCollections(false);
    }
  }

  function handleOpenMoveDialog() {
    setTargetCollectionId(null);
    setShowMoveDialog(true);
    fetchUserCollections();
  }

  async function handleMoveItems() {
    if (!targetCollectionId) return;

    setMovingItems(true);
    try {
      const itemIds = items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => item.itemId);

      const res = await fetch(
        `/api/collections/${collectionId}/items/move`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemIds,
            targetCollectionId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to move items');
      }

      setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      setShowMoveDialog(false);
      toast.success(t('moveSuccess') || 'Items moved');
    } catch {
      toast.error(t('moveError') || 'Failed to move items');
    } finally {
      setMovingItems(false);
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-4">
      {/* Header with batch toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{t('items')}</h2>
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {t('selectedCount')?.replace('{{count}}', String(selectedCount)) ||
                  `${selectedCount} selected`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmBatchDelete(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {t('batchDelete') || 'Delete'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenMoveDialog}
              >
                <ArrowRightLeft className="mr-1 h-4 w-4" />
                {t('moveTo') || 'Move'}
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOwner && items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedCount === items.length
                ? t('deselectAll') || 'Deselect All'
                : t('selectAll') || 'Select All'}
            </Button>
          )}
          {isOwner && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addItem')}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('emptyCollection')}</p>
          {isOwner && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('addFirstItem')}
            </Button>
          )}
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onRemove={removeItem}
                  removingId={removingId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddItemDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        collectionId={collectionId}
        onAdded={handleItemAdded}
        existingIds={items.map((i) => i.itemId)}
      />

      {/* Batch delete confirmation dialog */}
      <Dialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('batchDeleteConfirm') || 'Confirm Delete'}</DialogTitle>
            <DialogDescription>
              {t('batchDeleteConfirmDesc') ||
                `Are you sure you want to remove ${selectedCount} item(s)? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmBatchDelete(false)}
              disabled={batchDeleting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={batchDeleting}
            >
              {batchDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to collection dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('moveToCollection') || 'Move to Collection'}</DialogTitle>
            <DialogDescription>
              {t('moveToCollectionDesc') ||
                `Select a collection to move ${selectedCount} item(s) to.`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {loadingCollections ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : userCollections.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t('noOtherCollections') || 'No other collections available'}
              </p>
            ) : (
              userCollections.map((collection) => (
                <Card
                  key={collection.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    targetCollectionId === collection.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setTargetCollectionId(collection.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{collection.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {t('itemCount', { count: collection.itemCount })}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
              disabled={movingItems}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleMoveItems}
              disabled={!targetCollectionId || movingItems}
            >
              {movingItems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('move') || 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
