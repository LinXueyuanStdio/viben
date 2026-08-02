'use client';

import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Pencil } from 'lucide-react';
import Link from 'next/link';

interface ProfileHeaderProps {
  user: {
    id: string;
    username: string;
    userSlug: string;
    displayName: string;
    avatarUrl: string | null;
    email: string;
    bio: string | null;
    role: string;
    createdAt: Date | string;
  };
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const { t } = useTranslation();

  // Format date consistently to avoid hydration mismatch
  const formattedDate = (() => {
    const date = typeof user.createdAt === 'string' ? new Date(user.createdAt) : user.createdAt;
    // Use ISO format for consistent server/client rendering, then let the client format it
    return date.toISOString().split('T')[0];
  })();

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
              <Badge variant="secondary">{t('profile.header.roleAdmin')}</Badge>
            )}
            {user.role === 'developer' && (
              <Badge variant="outline">{t('profile.header.roleDeveloper')}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">@{user.username}</p>
          {user.bio && (
            <p className="mt-2 max-w-md text-sm">{user.bio}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t('profile.header.memberSince', { date: formattedDate })}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/settings">
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings/api_keys">
            <Settings className="mr-2 h-4 w-4" />
            {t('common.settings')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
