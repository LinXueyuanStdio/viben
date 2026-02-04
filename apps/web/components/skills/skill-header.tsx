import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Download, Star, Zap } from 'lucide-react';
import Link from 'next/link';

interface SkillHeaderProps {
  package: {
    id: string;
    name: string;
    version: string;
    description: string;
    skillType: string;
    category: string | null;
    tags: string[] | null;
    triggerPatterns: string[] | null;
    favoritesCount: number;
    downloadsCount: number;
    ratingAvg: number;
    ratingCount: number;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
}

export function SkillHeader({ package: pkg }: SkillHeaderProps) {
  const ratingAvg = pkg.ratingAvg || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">{pkg.name}</h1>
            <Badge variant="secondary">v{pkg.version}</Badge>
            <Badge>{pkg.skillType}</Badge>
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            {pkg.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {pkg.author && (
          <Link
            href={`/users/${pkg.author.username}`}
            className="flex items-center gap-2 hover:underline"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={pkg.author.avatarUrl || undefined} />
              <AvatarFallback>
                {pkg.author.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">
              by <span className="font-medium">{pkg.author.displayName}</span>
            </span>
          </Link>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            {pkg.favoritesCount} favorites
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            {pkg.downloadsCount} downloads
          </span>
          {pkg.ratingCount > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {ratingAvg.toFixed(1)} ({pkg.ratingCount})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Install
        </Button>
      </div>

      {pkg.triggerPatterns && pkg.triggerPatterns.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Triggers</p>
          <div className="flex flex-wrap gap-2">
            {pkg.triggerPatterns.map((pattern) => (
              <code
                key={pattern}
                className="rounded bg-muted px-2 py-1 text-xs"
              >
                {pattern}
              </code>
            ))}
          </div>
        </div>
      )}

      {pkg.tags && pkg.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pkg.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
