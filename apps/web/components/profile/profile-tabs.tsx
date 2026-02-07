'use client';

import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfilePackages } from './profile-packages';
import { ProfileFavorites } from './profile-favorites';
import { ProfileApiKeys } from './profile-api-keys';

interface ProfileTabsProps {
  userId: string;
}

export function ProfileTabs({ userId }: ProfileTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="packages" className="w-full">
      <TabsList>
        <TabsTrigger value="packages">{t('profile.tabs.myPackages')}</TabsTrigger>
        <TabsTrigger value="favorites">{t('profile.tabs.favorites')}</TabsTrigger>
        <TabsTrigger value="api-keys">{t('profile.tabs.apiKeys')}</TabsTrigger>
      </TabsList>
      <TabsContent value="packages" className="mt-6">
        <ProfilePackages userId={userId} />
      </TabsContent>
      <TabsContent value="favorites" className="mt-6">
        <ProfileFavorites />
      </TabsContent>
      <TabsContent value="api-keys" className="mt-6">
        <ProfileApiKeys />
      </TabsContent>
    </Tabs>
  );
}
