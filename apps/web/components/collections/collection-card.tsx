import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Layers, Lock, Heart, Server, Sparkles } from 'lucide-react';

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    entityType: 'mcp' | 'skill';
    favoritesCount: number;
    owner: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
  isOwner?: boolean;
}

export function CollectionCard({ collection, isOwner }: CollectionCardProps) {
  const TypeIcon = collection.entityType === 'mcp' ? Server : Sparkles;
  const typeLabel = collection.entityType === 'mcp' ? 'MCP' : 'Skills';

  return (
    <Link href={`/collections/${collection.id}`}>
      <div className="group flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Layers className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold group-hover:text-primary">
                  {collection.name}
                </h3>
                {!collection.isPublic && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TypeIcon className="h-3 w-3" />
                <span>{typeLabel} Collection</span>
              </div>
            </div>
          </div>
          {isOwner && <Badge variant="outline">Owner</Badge>}
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {collection.description || 'No description'}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={collection.owner.avatarUrl || undefined} />
              <AvatarFallback>
                {collection.owner.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{collection.owner.username}</span>
          </div>

          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {collection.favoritesCount}
          </div>
        </div>
      </div>
    </Link>
  );
}
