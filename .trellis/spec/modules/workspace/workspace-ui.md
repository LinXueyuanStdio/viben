# T17: Workspace UI

> Implement workspace management UI pages and components.

---

## Important: Platform Distinction

> **Warning**: There are TWO different "workspace" concepts in this project:
>
> ### 1. Desktop Workspaces (apps/desktop)
> - **Definition**: Local filesystem folders containing agent configurations
> - **Storage**: `~/.browsemcp/workspaces.json` + local `.claude/`, `.codex/` folders
> - **Features**: MCP servers, Skills, Chat, Kanban, file system access
> - **Persistence**: Local SQLite + filesystem
> - **See**: `modules/workspace-management.md`
>
> ### 2. Web Workspaces (apps/web)
> - **Definition**: Cloud-based collaborative spaces for organizing packages
> - **Storage**: PostgreSQL database
> - **Features**: Package organization, member management, settings
> - **NO**: Chat, Kanban, local filesystem features
>
> **Do NOT** port desktop workspace features (Chat, Kanban) to web. They are fundamentally different systems.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T17 |
| Dependencies | T14 (Workspace API), T3 (UI Shell) |
| Effort | 3 points |
| Priority | P2 |

---

## Objectives

1. Create workspace list page
2. Implement workspace detail/settings page
3. Add package management within workspace
4. Implement member management UI

---

## Deliverables

### 1. Workspaces List Page (`apps/web/app/(dashboard)/workspaces/page.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, workspaces, workspaceMembers, users } from '@/lib/db';
import { eq, or, desc } from 'drizzle-orm';
import { WorkspaceCard } from '@/components/workspaces/workspace-card';
import { CreateWorkspaceButton } from '@/components/workspaces/create-workspace-button';

export default async function WorkspacesPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Get workspaces user owns or is member of
  const memberOf = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, session.userId));

  const memberIds = memberOf.map((m) => m.workspaceId);

  const userWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      description: workspaces.description,
      isPersonal: workspaces.isPersonal,
      createdAt: workspaces.createdAt,
      ownerId: workspaces.ownerId,
      owner: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(workspaces)
    .leftJoin(users, eq(workspaces.ownerId, users.id))
    .where(
      or(
        eq(workspaces.ownerId, session.userId),
        memberIds.length > 0
          ? eq(workspaces.id, memberIds[0])
          : undefined
      )
    )
    .orderBy(desc(workspaces.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your project workspaces and configurations
          </p>
        </div>
        <CreateWorkspaceButton />
      </div>

      {userWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-lg text-muted-foreground">No workspaces yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a workspace to organize your packages
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isOwner={workspace.ownerId === session.userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2. Workspace Card (`apps/web/components/workspaces/workspace-card.tsx`)

```tsx
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Folder, User, Lock } from 'lucide-react';

interface WorkspaceCardProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPersonal: boolean;
    createdAt: Date;
    owner: {
      id: string;
      username: string;
      avatarUrl: string | null;
    } | null;
  };
  isOwner: boolean;
}

export function WorkspaceCard({ workspace, isOwner }: WorkspaceCardProps) {
  return (
    <Link href={`/workspaces/${workspace.id}`}>
      <div className="group flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Folder className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-primary">
                {workspace.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                @{workspace.slug}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {workspace.isPersonal && (
              <Badge variant="secondary">
                <User className="mr-1 h-3 w-3" />
                Personal
              </Badge>
            )}
            {isOwner && !workspace.isPersonal && (
              <Badge variant="outline">Owner</Badge>
            )}
          </div>
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {workspace.description || 'No description'}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          {workspace.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={workspace.owner.avatarUrl || undefined} />
                <AvatarFallback>
                  {workspace.owner.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{workspace.owner.username}</span>
            </div>
          )}
          <span>
            Created {workspace.createdAt.toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

### 3. Create Workspace Dialog (`apps/web/components/workspaces/create-workspace-button.tsx`)

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
});

type CreateValues = z.infer<typeof createSchema>;

export function CreateWorkspaceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
  });

  async function onSubmit(data: CreateValues) {
    setIsLoading(true);

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create workspace');
      }

      const { workspace } = await response.json();
      toast.success('Workspace created');
      setOpen(false);
      form.reset();
      router.push(`/workspaces/${workspace.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace to organize your packages and configurations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Project"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="my-project"
                {...form.register('slug')}
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this workspace for?"
                {...form.register('description')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Workspace Detail Page (`apps/web/app/(dashboard)/workspaces/[id]/page.tsx`)

```tsx
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, workspaces } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { WorkspaceHeader } from '@/components/workspaces/workspace-header';
import { WorkspaceTabs } from '@/components/workspaces/workspace-tabs';

interface WorkspaceDetailPageProps {
  params: { id: string };
}

export default async function WorkspaceDetailPage({
  params,
}: WorkspaceDetailPageProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, params.id),
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!workspace) {
    notFound();
  }

  const isOwner = workspace.ownerId === session.userId;

  return (
    <div className="space-y-6">
      <WorkspaceHeader workspace={workspace} isOwner={isOwner} />
      <WorkspaceTabs workspaceId={workspace.id} isOwner={isOwner} />
    </div>
  );
}
```

### 5. Workspace Tabs (`apps/web/components/workspaces/workspace-tabs.tsx`)

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspacePackages } from './workspace-packages';
import { WorkspaceMembers } from './workspace-members';
import { WorkspaceSettings } from './workspace-settings';

interface WorkspaceTabsProps {
  workspaceId: string;
  isOwner: boolean;
}

export function WorkspaceTabs({ workspaceId, isOwner }: WorkspaceTabsProps) {
  return (
    <Tabs defaultValue="packages" className="w-full">
      <TabsList>
        <TabsTrigger value="packages">Packages</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        {isOwner && <TabsTrigger value="settings">Settings</TabsTrigger>}
      </TabsList>
      <TabsContent value="packages" className="mt-6">
        <WorkspacePackages workspaceId={workspaceId} isOwner={isOwner} />
      </TabsContent>
      <TabsContent value="members" className="mt-6">
        <WorkspaceMembers workspaceId={workspaceId} isOwner={isOwner} />
      </TabsContent>
      {isOwner && (
        <TabsContent value="settings" className="mt-6">
          <WorkspaceSettings workspaceId={workspaceId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
```

### 6. Workspace Packages (`apps/web/components/workspaces/workspace-packages.tsx`)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Settings, Server, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddPackageDialog } from './add-package-dialog';

interface WorkspacePackage {
  packageId: string;
  packageType: 'mcp' | 'skill';
  config: Record<string, any>;
  enabled: boolean;
  package?: {
    id: string;
    name: string;
    version: string;
    description: string;
  };
}

interface WorkspacePackagesProps {
  workspaceId: string;
  isOwner: boolean;
}

export function WorkspacePackages({
  workspaceId,
  isOwner,
}: WorkspacePackagesProps) {
  const [packages, setPackages] = useState<{
    mcp: any[];
    skills: any[];
    configs: WorkspacePackage[];
  }>({ mcp: [], skills: [], configs: [] });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, [workspaceId]);

  async function fetchPackages() {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/packages`);
      const data = await res.json();
      setPackages(data);
    } catch (error) {
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(packageId: string, enabled: boolean) {
    try {
      await fetch(`/api/workspaces/${workspaceId}/packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setPackages((prev) => ({
        ...prev,
        configs: prev.configs.map((c) =>
          c.packageId === packageId ? { ...c, enabled } : c
        ),
      }));
    } catch (error) {
      toast.error('Failed to update package');
    }
  }

  async function removePackage(packageId: string) {
    try {
      await fetch(`/api/workspaces/${workspaceId}/packages/${packageId}`, {
        method: 'DELETE',
      });
      setPackages((prev) => ({
        ...prev,
        configs: prev.configs.filter((c) => c.packageId !== packageId),
      }));
      toast.success('Package removed');
    } catch (error) {
      toast.error('Failed to remove package');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const allPackages = [
    ...packages.mcp.map((p) => ({ ...p, type: 'mcp' as const })),
    ...packages.skills.map((p) => ({ ...p, type: 'skill' as const })),
  ];

  const configMap = new Map(packages.configs.map((c) => [c.packageId, c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Installed Packages</h3>
          <p className="text-sm text-muted-foreground">
            Manage packages in this workspace
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Package
          </Button>
        )}
      </div>

      {allPackages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No packages in this workspace</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Enabled</TableHead>
              {isOwner && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allPackages.map((pkg) => {
              const config = configMap.get(pkg.id);
              return (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {pkg.type === 'mcp' ? (
                        <Server className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Zap className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="font-medium">{pkg.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {pkg.type === 'mcp' ? 'MCP' : 'Skill'}
                    </Badge>
                  </TableCell>
                  <TableCell>v{pkg.version}</TableCell>
                  <TableCell>
                    <Switch
                      checked={config?.enabled ?? true}
                      onCheckedChange={(checked) =>
                        toggleEnabled(pkg.id, checked)
                      }
                      disabled={!isOwner}
                    />
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePackage(pkg.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AddPackageDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        workspaceId={workspaceId}
        onAdded={fetchPackages}
      />
    </div>
  );
}
```

### 7. Workspace Members (`apps/web/components/workspaces/workspace-members.tsx`)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Trash2, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { InviteMemberDialog } from './invite-member-dialog';

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface WorkspaceMembersProps {
  workspaceId: string;
  isOwner: boolean;
}

export function WorkspaceMembers({
  workspaceId,
  isOwner,
}: WorkspaceMembersProps) {
  const [owner, setOwner] = useState<Member['user'] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      const data = await res.json();
      setOwner(data.owner);
      setMembers(data.members);
    } catch (error) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(userId: string) {
    try {
      await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
      });
      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
      toast.success('Member removed');
    } catch (error) {
      toast.error('Failed to remove member');
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
          <h3 className="text-lg font-semibold">Members</h3>
          <p className="text-sm text-muted-foreground">
            People with access to this workspace
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {isOwner && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Owner row */}
          {owner && (
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={owner.avatarUrl || undefined} />
                    <AvatarFallback>
                      {owner.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{owner.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{owner.username}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge>
                  <Crown className="mr-1 h-3 w-3" />
                  Owner
                </Badge>
              </TableCell>
              <TableCell>-</TableCell>
              {isOwner && <TableCell></TableCell>}
            </TableRow>
          )}

          {/* Member rows */}
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user.avatarUrl || undefined} />
                    <AvatarFallback>
                      {member.user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.user.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{member.user.username}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(member.joinedAt).toLocaleDateString()}
              </TableCell>
              {isOwner && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMember(member.user.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <InviteMemberDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        workspaceId={workspaceId}
        onInvited={fetchMembers}
      />
    </div>
  );
}
```

---

## Required shadcn/ui Components

```bash
pnpm dlx shadcn@latest add switch
```

---

## Acceptance Criteria

- [ ] List user's workspaces (owned + member)
- [ ] Workspace cards show key info
- [ ] Create workspace dialog works
- [ ] Workspace detail page loads
- [ ] Packages tab shows installed packages
- [ ] Toggle package enabled/disabled
- [ ] Add/remove packages (owner)
- [ ] Members tab shows owner and members
- [ ] Invite member dialog works
- [ ] Remove member works (owner)
- [ ] Settings tab for owner only
- [ ] Update workspace settings works
- [ ] Delete workspace works (owner)

---

## Notes

- Personal workspace created with user account
- Owner has full control
- Members can view packages
- Only owner can modify settings
- Package configs are per-workspace
