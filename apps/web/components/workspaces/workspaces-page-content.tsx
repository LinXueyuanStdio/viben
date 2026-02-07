'use client';

import { useTranslation } from 'react-i18next';
import { WorkspaceCard } from './workspace-card';
import { CreateWorkspaceDialog } from './create-workspace-dialog';
import { FolderKanban } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  ownerId: string;
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  _count?: {
    mcpPackages: number;
    skillPackages: number;
  };
}

interface WorkspacesPageContentProps {
  workspaces: Workspace[];
  userId: string;
}

export function WorkspacesPageContent({ workspaces, userId }: WorkspacesPageContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('workspace.workspaces')}</h1>
          <p className="text-muted-foreground">
            {t('workspace.workspacesDescription')}
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t('workspace.noWorkspaces')}</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('workspace.noWorkspacesDesc')}
          </p>
          <div className="mt-4">
            <CreateWorkspaceDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isOwner={workspace.ownerId === userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
