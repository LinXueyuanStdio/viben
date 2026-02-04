'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Server, Zap, Loader2 } from 'lucide-react';
import { AddPackageDialog } from './add-package-dialog';

interface WorkspacePackage {
  entityType: 'mcp' | 'skill';
  entityId: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  addedAt: string;
  package?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    version: string;
  };
}

interface WorkspacePackagesProps {
  workspaceId: string;
  isOwner: boolean;
}

export function WorkspacePackages({
  workspaceId,
  isOwner,
}: WorkspacePackagesProps) {
  const [packages, setPackages] = useState<WorkspacePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/packages`);
      if (!res.ok) throw new Error('Failed to fetch packages');
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  async function toggleEnabled(entityType: string, entityId: string, enabled: boolean) {
    const key = `${entityType}-${entityId}`;
    setUpdatingIds((prev) => new Set(prev).add(key));

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, enabled }),
      });

      if (!res.ok) throw new Error('Failed to update package');

      setPackages((prev) =>
        prev.map((p) =>
          p.entityType === entityType && p.entityId === entityId
            ? { ...p, enabled }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to update package:', error);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function removePackage(entityType: string, entityId: string) {
    const key = `${entityType}-${entityId}`;
    setUpdatingIds((prev) => new Set(prev).add(key));

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/packages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId }),
      });

      if (!res.ok) throw new Error('Failed to remove package');

      setPackages((prev) =>
        prev.filter(
          (p) => !(p.entityType === entityType && p.entityId === entityId)
        )
      );
    } catch (error) {
      console.error('Failed to remove package:', error);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Installed Packages</h3>
          <p className="text-sm text-muted-foreground">
            Manage MCP servers and skills in this workspace
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Package
          </Button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No packages in this workspace</p>
          {isOwner && (
            <p className="mt-2 text-sm text-muted-foreground">
              Add packages to get started
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Enabled</TableHead>
                {isOwner && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => {
                const key = `${pkg.entityType}-${pkg.entityId}`;
                const isUpdating = updatingIds.has(key);

                return (
                  <TableRow key={key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {pkg.entityType === 'mcp' ? (
                          <Server className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Zap className="h-4 w-4 text-yellow-500" />
                        )}
                        <div>
                          <span className="font-medium">
                            {pkg.package?.name || 'Unknown'}
                          </span>
                          {pkg.package?.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {pkg.package.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {pkg.entityType === 'mcp' ? 'MCP' : 'Skill'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      v{pkg.package?.version || '1.0.0'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={pkg.enabled}
                        onCheckedChange={(checked) =>
                          toggleEnabled(pkg.entityType, pkg.entityId, checked)
                        }
                        disabled={!isOwner || isUpdating}
                      />
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removePackage(pkg.entityType, pkg.entityId)
                          }
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AddPackageDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        workspaceId={workspaceId}
        onAdded={fetchPackages}
        existingPackageIds={packages.map((p) => p.entityId)}
      />
    </div>
  );
}
