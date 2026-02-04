'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Star, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface WorkspaceHeaderProps {
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
  };
  isOwner: boolean;
}

export function WorkspaceHeader({ workspace, isOwner }: WorkspaceHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/workspaces" className="flex items-center hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Workspaces
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{workspace.name}</h1>
              {workspace.isDefault && (
                <Badge variant="secondary">
                  <Star className="mr-1 h-3 w-3" />
                  Default
                </Badge>
              )}
              {isOwner && <Badge variant="outline">Owner</Badge>}
            </div>
            {workspace.description && (
              <p className="mt-1 max-w-xl text-muted-foreground">
                {workspace.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarImage src={workspace.owner.avatarUrl || undefined} />
                <AvatarFallback>
                  {workspace.owner.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{workspace.owner.displayName}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>Created {new Date(workspace.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
