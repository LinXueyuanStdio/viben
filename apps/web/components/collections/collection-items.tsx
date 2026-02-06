'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Server,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AddItemDialog } from './add-item-dialog';

interface CollectionItem {
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  note: string | null;
  position: number;
  addedAt: Date;
  package?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    version: string;
  };
}

interface CollectionItemsProps {
  collectionId: string;
  items: CollectionItem[];
  isOwner: boolean;
}

export function CollectionItems({
  collectionId,
  items: initialItems,
  isOwner,
}: CollectionItemsProps) {
  const [items, setItems] = useState<CollectionItem[]>(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function getItemIcon(itemType: 'mcp' | 'skill') {
    return itemType === 'mcp' ? Server : Sparkles;
  }

  function getItemRoute(itemType: 'mcp' | 'skill') {
    return itemType === 'mcp' ? '/mcp' : '/skills';
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
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    } finally {
      setRemovingId(null);
    }
  }

  function handleItemAdded(newItem: CollectionItem) {
    setItems((prev) => [...prev, newItem]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Items</h2>
        {isOwner && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">This collection is empty</p>
          {isOwner && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add your first item
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const TypeIcon = getItemIcon(item.itemType);
            const typeRoute = getItemRoute(item.itemType);
            const typeLabel = item.itemType === 'mcp' ? 'MCP' : 'Skill';

            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
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
                        Unknown Package
                      </span>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {item.package?.description || 'Package not found'}
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
                      onClick={() => removeItem(item.itemId)}
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
          })}
        </div>
      )}

      <AddItemDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        collectionId={collectionId}
        onAdded={handleItemAdded}
        existingIds={items.map((i) => i.itemId)}
      />
    </div>
  );
}
