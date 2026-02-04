'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Server, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Package {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
}

interface CollectionItem {
  entityId: string;
  note: string | null;
  addedAt: Date;
  package?: Package;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  entityType: 'mcp' | 'skill';
  onAdded: (item: CollectionItem) => void;
  existingIds: string[];
}

export function AddItemDialog({
  open,
  onOpenChange,
  collectionId,
  entityType,
  onAdded,
  existingIds,
}: AddItemDialogProps) {
  const [search, setSearch] = useState('');
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  const TypeIcon = entityType === 'mcp' ? Server : Sparkles;
  const typeLabel = entityType === 'mcp' ? 'MCP servers' : 'skills';

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = entityType === 'mcp' ? '/api/mcp' : '/api/skills';
      const params = new URLSearchParams();
      if (search) {
        params.set('q', search);
      }
      params.set('limit', '20');

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch packages');

      const data = await res.json();
      setPackages(data.packages || []);
    } catch {
      toast.error('Failed to load packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, search]);

  useEffect(() => {
    if (open) {
      fetchPackages();
    } else {
      setSearch('');
      setSelectedPackage(null);
      setNote('');
    }
  }, [open, fetchPackages]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (open) {
        fetchPackages();
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, open, fetchPackages]);

  async function handleAdd() {
    if (!selectedPackage) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: selectedPackage.id,
          note: note || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to add item');

      onAdded({
        entityId: selectedPackage.id,
        note: note || null,
        addedAt: new Date(),
        package: selectedPackage,
      });

      toast.success('Item added to collection');
      onOpenChange(false);
    } catch {
      toast.error('Failed to add item');
    } finally {
      setAdding(false);
    }
  }

  const availablePackages = packages.filter(
    (pkg) => !existingIds.includes(pkg.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item to Collection</DialogTitle>
          <DialogDescription>
            Search and select {typeLabel} to add to this collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${typeLabel}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[300px] rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availablePackages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p>No available {typeLabel} found</p>
                {search && (
                  <p className="text-sm">Try adjusting your search</p>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {availablePackages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedPackage?.id === pkg.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedPackage(pkg)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                        <TypeIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pkg.name}</span>
                          <span className="text-xs text-muted-foreground">
                            v{pkg.version}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {pkg.description}
                        </p>
                      </div>
                      {selectedPackage?.id === pkg.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedPackage && (
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Why are you adding this to the collection?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedPackage || adding}>
            {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
