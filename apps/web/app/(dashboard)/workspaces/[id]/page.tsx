import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getWorkspace } from '@/lib/services/workspaces';
import { WorkspaceHeader } from '@/components/workspaces/workspace-header';
import { WorkspaceTabs } from '@/components/workspaces/workspace-tabs';

interface WorkspaceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: WorkspaceDetailPageProps) {
  const { id } = await params;
  const workspace = await getWorkspace(id);

  if (!workspace) {
    return {
      title: 'Workspace Not Found',
    };
  }

  return {
    title: workspace.name,
  };
}

export default async function WorkspaceDetailPage({
  params,
}: WorkspaceDetailPageProps) {
  const session = await getSession();
  if (!session?.userId) {
    redirect('/login');
  }

  const { id } = await params;
  const workspace = await getWorkspace(id);

  if (!workspace) {
    notFound();
  }

  // Check if user is the owner
  const isOwner = workspace.ownerId === session.userId;

  // For now, only owners can view workspace details
  // In the future, we can add workspace members support
  if (!isOwner) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader workspace={workspace} isOwner={isOwner} />
      <WorkspaceTabs workspaceId={workspace.id} isOwner={isOwner} />
    </div>
  );
}
