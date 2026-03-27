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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  note: string | null;
  position: number;
  addedAt: Date;
  package?: Package;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  onAdded: (item: CollectionItem) => void;
  existingIds: string[];
}

export function AddItemDialog({
  open,
  onOpenChange,
  collectionId,
  onAdded,
  existingIds,
}: AddItemDialogProps) {
  const [activeTab, setActiveTab] = useState<'mcp' | 'skill'>('mcp');
  const [search, setSearch] = useState('');
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  const TypeIcon = activeTab === 'mcp' ? Server : Sparkles;
  const typeLabel = activeTab === 'mcp' ? 'MCP servers' : 'skills';

  const fetchPackages = useCallback(async (itemType: 'mcp' | 'skill') => {
    setLoading(true);
    try {
      const endpoint = itemType === 'mcp' ? '/api/mcp' : '/api/skill';
      const params = new URLSearchParams();
      if (search) {
        params.set('q', search);
      }
      params.set('limit', '20');

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch packages');

      const data = await res.json();
      // Handle both response shapes (data.packages and data.data)
      setPackages(data.packages || data.data || []);
    } catch {
      toast.error('Failed to load packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      fetchPackages(activeTab);
    } else {
      setSearch('');
      setSelectedPackage(null);
      setNote('');
      setPackages([]);
    }
  }, [open, activeTab, fetchPackages]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (open) {
        fetchPackages(activeTab);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, open, activeTab, fetchPackages]);

  function handleTabChange(value: string) {
    setActiveTab(value as 'mcp' | 'skill');
    setSelectedPackage(null);
    setSearch('');
  }

  async function handleAdd() {
    if (!selectedPackage) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedPackage.id,
          itemType: activeTab,
          note: note || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to add item');

      const data = await res.json();

      onAdded({
        id: data.item?.id || '',
        itemId: selectedPackage.id,
        itemType: activeTab,
        note: note || null,
        position: data.item?.position || 0,
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
            Search and select packages to add to this collection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mcp" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              MCP Servers
            </TabsTrigger>
            <TabsTrigger value="skill" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Skills
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
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
          </TabsContent>
        </Tabs>

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
