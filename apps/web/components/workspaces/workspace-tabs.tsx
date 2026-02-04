'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspacePackages } from './workspace-packages';
import { WorkspaceSettings } from './workspace-settings';
import { Package, Settings } from 'lucide-react';

interface WorkspaceTabsProps {
  workspaceId: string;
  isOwner: boolean;
}

export function WorkspaceTabs({ workspaceId, isOwner }: WorkspaceTabsProps) {
  return (
    <Tabs defaultValue="packages" className="w-full">
      <TabsList>
        <TabsTrigger value="packages" className="gap-2">
          <Package className="h-4 w-4" />
          Packages
        </TabsTrigger>
        {isOwner && (
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="packages" className="mt-6">
        <WorkspacePackages workspaceId={workspaceId} isOwner={isOwner} />
      </TabsContent>
      {isOwner && (
        <TabsContent value="settings" className="mt-6">
          <WorkspaceSettings workspaceId={workspaceId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
