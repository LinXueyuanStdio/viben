---
sidebar_position: 4
title: Profile UI
description: User profile pages and API key management
---

# Profile UI

> Implement user profile pages and API key management features.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T10 |
| Dependencies | T4 (User API), T3 (UI Shell) |
| Effort | 3 points |
| Priority | P1 |

---

## Objectives

1. Create user profile page
2. Implement profile settings form
3. Add API key management
4. Display user's packages and favorites

---

## Deliverables

### 1. Profile Page (`apps/web/app/(dashboard)/profile/page.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTabs } from '@/components/profile/profile-tabs';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <ProfileHeader user={user} />
      <ProfileTabs userId={user.id} />
    </div>
  );
}
```

### 2. Profile Header (`apps/web/components/profile/profile-header.tsx`)

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Github } from 'lucide-react';
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
```

### 3. Profile Tabs (`apps/web/components/profile/profile-tabs.tsx`)

```tsx
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
        <ProfileFavorites userId={userId} />
      </TabsContent>
      <TabsContent value="api-keys" className="mt-6">
        <ProfileApiKeys />
      </TabsContent>
    </Tabs>
  );
}
```

### 4. Profile Packages (`apps/web/components/profile/profile-packages.tsx`)

```tsx
import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { McpCard } from '@/components/mcp/mcp-card';
import { SkillCard } from '@/components/skills/skill-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface ProfilePackagesProps {
  userId: string;
}

export async function ProfilePackages({ userId }: ProfilePackagesProps) {
  const [mcps, skills] = await Promise.all([
    db.query.mcpPackages.findMany({
      where: eq(mcpPackages.authorId, userId),
      orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
      limit: 10,
    }),
    db.query.skillPackages.findMany({
      where: eq(skillPackages.authorId, userId),
      orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
      limit: 10,
    }),
  ]);

  const hasPackages = mcps.length > 0 || skills.length > 0;

  if (!hasPackages) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">
          You haven't published any packages yet
        </p>
        <Button className="mt-4" asChild>
          <Link href="/publish">
            <Plus className="mr-2 h-4 w-4" />
            Publish a Package
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {mcps.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">MCP Packages</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mcps.map((pkg) => (
              <McpCard key={pkg.id} package={pkg as any} />
            ))}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Skills</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((pkg) => (
              <SkillCard key={pkg.id} package={pkg as any} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5. API Keys Component (`apps/web/components/profile/profile-api-keys.tsx`)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Copy, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ProfileApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch('/api/users/me/api-keys');
      const data = await res.json();
      setKeys(data.keys);
    } catch (error) {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/users/me/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, scopes: ['read', 'write'] }),
      });

      const data = await res.json();
      setNewKeyValue(data.key);
      setKeys((prev) => [data.apiKey, ...prev]);
      setNewKeyName('');
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(keyId: string) {
    try {
      await fetch(`/api/users/me/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  }

  function copyKey() {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      toast.success('API key copied to clipboard');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setNewKeyValue(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newKeyValue ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              <DialogDescription>
                {newKeyValue
                  ? 'Copy this key now. You won\'t be able to see it again.'
                  : 'Give your API key a descriptive name.'}
              </DialogDescription>
            </DialogHeader>

            {newKeyValue ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input value={newKeyValue} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={copyKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="My API Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {newKeyValue ? (
                <Button onClick={() => setShowDialog(false)}>Done</Button>
              ) : (
                <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Key
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No API keys yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-sm">
                  {key.prefix}...
                </TableCell>
                <TableCell>
                  {key.scopes.join(', ')}
                </TableCell>
                <TableCell>
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : 'Never'}
                </TableCell>
                <TableCell>
                  {new Date(key.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

### 6. Profile Settings Page (`apps/web/app/(dashboard)/profile/settings/page.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProfileSettingsForm } from '@/components/profile/profile-settings-form';

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and profile information
        </p>
      </div>
      <ProfileSettingsForm user={user} />
    </div>
  );
}
```

### 7. Profile Settings Form (`apps/web/components/profile/profile-settings-form.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  bio: z.string().max(500).optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

interface ProfileSettingsFormProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    bio: string | null;
    email: string;
  };
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user.displayName,
      bio: user.bio || '',
    },
  });

  async function onSubmit(data: ProfileValues) {
    setIsLoading(true);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast.success('Profile updated');
      router.refresh();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" value={user.username} disabled />
        <p className="text-xs text-muted-foreground">
          Username cannot be changed
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={user.email} disabled />
        <p className="text-xs text-muted-foreground">
          Email is managed through your OAuth provider
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          {...form.register('displayName')}
        />
        {form.formState.errors.displayName && (
          <p className="text-sm text-destructive">
            {form.formState.errors.displayName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="Tell us about yourself..."
          {...form.register('bio')}
        />
        {form.formState.errors.bio && (
          <p className="text-sm text-destructive">
            {form.formState.errors.bio.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}
```

---

## Required shadcn/ui Components

```bash
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add table
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add textarea
```

---

## Acceptance Criteria

- [ ] Profile page shows user info
- [ ] My Packages tab shows user's MCP and Skills
- [ ] Favorites tab shows favorited packages
- [ ] API Keys tab lists existing keys
- [ ] Create API key dialog works
- [ ] API key shown only once after creation
- [ ] Delete API key works
- [ ] Settings page loads user data
- [ ] Profile update saves changes
- [ ] Proper loading states

---

## Notes

- Profile settings are limited (username/email from OAuth)
- API keys are hashed, only prefix shown
- Full key shown only once at creation
- Server components for data fetching
- Client components for forms and interactions
