import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listWorkspaces } from '@/lib/services/workspaces';
import { WorkspacesPageContent } from '@/components/workspaces/workspaces-page-content';

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
    <WorkspacesPageContent
      workspaces={workspaces}
      userId={session.userId}
    />
  );
}
