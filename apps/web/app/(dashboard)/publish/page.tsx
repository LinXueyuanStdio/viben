import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PublishWizard } from '@/components/publish/publish-wizard';

export const dynamic = 'force-dynamic';

export default async function PublishPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Publish a Package</h1>
        <p className="text-muted-foreground">
          Share your MCP server or skill with the community
        </p>
      </div>

      <PublishWizard />
    </div>
  );
}
