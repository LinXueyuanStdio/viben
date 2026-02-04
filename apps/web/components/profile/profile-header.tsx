import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import Link from 'next/link';

interface ProfileHeaderProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    email: string;
    bio: string | null;
    role: string;
    createdAt: Date;
  };
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.avatarUrl || undefined} />
          <AvatarFallback className="text-2xl">
            {user.displayName[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{user.displayName}</h1>
            {user.role === 'admin' && (
              <Badge variant="secondary">Admin</Badge>
            )}
            {user.role === 'developer' && (
              <Badge variant="outline">Developer</Badge>
            )}
          </div>
          <p className="text-muted-foreground">@{user.username}</p>
          {user.bio && (
            <p className="mt-2 max-w-md text-sm">{user.bio}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Member since {user.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>
      <Button variant="outline" asChild>
        <Link href="/profile/settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </Button>
    </div>
  );
}
