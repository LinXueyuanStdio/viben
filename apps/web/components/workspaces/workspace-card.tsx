'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Star } from 'lucide-react';

interface WorkspaceCardProps {
  workspace: {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    createdAt: Date;
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
  };
  isOwner: boolean;
}

export function WorkspaceCard({ workspace, isOwner }: WorkspaceCardProps) {
  const { t } = useTranslation();

  return (
    <Link href={`/workspaces/${workspace.id}`}>
      <div className="group relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-primary">
                {workspace.name}
              </h3>
            </div>
          </div>
          <div className="flex gap-1">
            {workspace.isDefault && (
              <Badge variant="secondary">
                <Star className="mr-1 h-3 w-3" />
                {t('workspace.default')}
              </Badge>
            )}
            {isOwner && (
              <Badge variant="outline">{t('workspace.owner')}</Badge>
            )}
          </div>
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {workspace.description || t('workspace.noDescription')}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={workspace.owner.avatarUrl || undefined} />
              <AvatarFallback>
                {workspace.owner.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{workspace.owner.username}</span>
          </div>
          <div className="flex items-center gap-3">
            {workspace._count && (
              <>
                <span>{workspace._count.mcpPackages} {t('workspace.mcps')}</span>
                <span>{workspace._count.skillPackages} {t('workspace.skills')}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
