'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Zap, Loader2, Search, Check, Plus } from 'lucide-react';

interface PackageItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
}

interface AddPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onAdded: () => void;
  existingPackageIds: string[];
}

export function AddPackageDialog({
  open,
  onOpenChange,
  workspaceId,
  onAdded,
  existingPackageIds,
}: AddPackageDialogProps) {
  const [activeTab, setActiveTab] = useState<'mcp' | 'skill'>('mcp');
  const [mcpPackages, setMcpPackages] = useState<PackageItem[]>([]);
  const [skillPackages, setSkillPackages] = useState<PackageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const [mcpRes, skillRes] = await Promise.all([
        fetch('/api/mcp?limit=100'),
        fetch('/api/skills?limit=100'),
      ]);

      if (mcpRes.ok) {
        const data = await mcpRes.json();
        setMcpPackages(data.packages || []);
      }

      if (skillRes.ok) {
        const data = await skillRes.json();
        setSkillPackages(data.packages || []);
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPackages();
    }
  }, [open, fetchPackages]);

  async function addPackage(entityType: 'mcp' | 'skill', entityId: string) {
    setAdding(entityId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, enabled: true }),
      });

      if (!res.ok) throw new Error('Failed to add package');

      onAdded();
    } catch (error) {
      console.error('Failed to add package:', error);
    } finally {
      setAdding(null);
    }
  }

  const filteredMcp = mcpPackages.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSkills = skillPackages.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Package</DialogTitle>
          <DialogDescription>
            Select packages to add to your workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'mcp' | 'skill')}
          >
            <TabsList>
              <TabsTrigger value="mcp" className="gap-2">
                <Server className="h-4 w-4" />
                MCP Servers ({filteredMcp.length})
              </TabsTrigger>
              <TabsTrigger value="skill" className="gap-2">
                <Zap className="h-4 w-4" />
                Skills ({filteredSkills.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mcp" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PackageList
                  packages={filteredMcp}
                  entityType="mcp"
                  existingIds={existingPackageIds}
                  adding={adding}
                  onAdd={addPackage}
                />
              )}
            </TabsContent>

            <TabsContent value="skill" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PackageList
                  packages={filteredSkills}
                  entityType="skill"
                  existingIds={existingPackageIds}
                  adding={adding}
                  onAdd={addPackage}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PackageListProps {
  packages: PackageItem[];
  entityType: 'mcp' | 'skill';
  existingIds: string[];
  adding: string | null;
  onAdd: (entityType: 'mcp' | 'skill', entityId: string) => void;
}

function PackageList({
  packages,
  entityType,
  existingIds,
  adding,
  onAdd,
}: PackageListProps) {
  if (packages.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No packages found
      </div>
    );
  }

  return (
    <div className="max-h-[300px] space-y-2 overflow-y-auto">
      {packages.map((pkg) => {
        const isAdded = existingIds.includes(pkg.id);
        const isAdding = adding === pkg.id;

        return (
          <div
            key={pkg.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              {entityType === 'mcp' ? (
                <Server className="h-5 w-5 text-blue-500" />
              ) : (
                <Zap className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{pkg.name}</span>
                  <Badge variant="outline" className="text-xs">
                    v{pkg.version}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {pkg.description}
                </p>
              </div>
            </div>
            {isAdded ? (
              <Button variant="ghost" size="sm" disabled>
                <Check className="mr-1 h-4 w-4 text-green-500" />
                Added
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAdd(entityType, pkg.id)}
                disabled={isAdding}
              >
                {isAdding ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
