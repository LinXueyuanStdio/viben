import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listWorkspaces } from '@/lib/services/workspaces';
import { WorkspaceCard } from '@/components/workspaces/workspace-card';
import { CreateWorkspaceDialog } from '@/components/workspaces/create-workspace-dialog';
import { FolderKanban } from 'lucide-react';

export const metadata = {
  title: 'Workspaces',
};

export default async function WorkspacesPage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect('/login');
  }

  const workspaces = await listWorkspaces(session.userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage your project-scoped configurations.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No workspaces yet</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Create a workspace to organize your packages and configurations.
          </p>
          <div className="mt-4">
            <CreateWorkspaceDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
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
