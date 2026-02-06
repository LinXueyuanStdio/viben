import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfilePackages } from './profile-packages';
import { ProfileFavorites } from './profile-favorites';
import { ProfileApiKeys } from './profile-api-keys';

interface ProfileTabsProps {
  userId: string;
}

export function ProfileTabs({ userId }: ProfileTabsProps) {
  return (
    <Tabs defaultValue="packages" className="w-full">
      <TabsList>
        <TabsTrigger value="packages">My Packages</TabsTrigger>
        <TabsTrigger value="favorites">Favorites</TabsTrigger>
        <TabsTrigger value="api-keys">API Keys</TabsTrigger>
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
