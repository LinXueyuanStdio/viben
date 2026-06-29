import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PublishWizard } from '@/components/publish/publish-wizard';
import { T } from '@/components/content/i18n-text';

export const dynamic = 'force-dynamic';

export default async function PublishPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          <T tKey="publish.pageTitle" fallback="发布包" />
        </h1>
        <p className="text-muted-foreground">
          <T tKey="publish.pageSubtitle" fallback="与社区分享您的 MCP 服务器或技能" />
        </p>
      </div>

      <PublishWizard />
    </div>
  );
}
