import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Download, Star, Zap } from 'lucide-react';

interface SkillCardProps {
  package: {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string | null;
    category: string | null;
    skillType: string;
    favoritesCount: number;
    downloadsCount: number;
    ratingAvg: number;
    author: {
      username: string;
      avatarUrl: string | null;
    } | null;
  };
}

export function SkillCard({ package: pkg }: SkillCardProps) {
  const ratingAvg = pkg.ratingAvg || 0;

  return (
    <Link href={`/skills/${pkg.id}`}>
      <div className="group relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold group-hover:text-primary">
                {pkg.name}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">v{pkg.version}</p>
          </div>
          <Badge variant="secondary">{pkg.skillType}</Badge>
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {pkg.description || 'No description'}
        </p>

        <div className="mt-4 flex items-center justify-between">
          {pkg.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={pkg.author.avatarUrl || undefined} />
                <AvatarFallback>
                  {pkg.author.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {pkg.author.username}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {pkg.favoritesCount}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {pkg.downloadsCount}
            </span>
            {ratingAvg > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {ratingAvg.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
