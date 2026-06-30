import { notFound } from 'next/navigation';
import { db, mcpPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { McpHeader } from '@/components/mcp/mcp-header';
import { McpReadme } from '@/components/mcp/mcp-readme';
import { McpSidebar } from '@/components/mcp/mcp-sidebar';
import { CommentSection } from '@/components/social';

interface McpDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function McpDetailPage({ params }: McpDetailPageProps) {
  const { id } = await params;

  const [pkg, session] = await Promise.all([
    db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
      with: {
        author: {
          columns: {
            id: true,
            username: true,
            userSlug: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    }),
    getSession(),
  ]);

  if (!pkg) {
    notFound();
  }

  const isAuthenticated = !!session?.userId;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <McpHeader package={pkg} isAuthenticated={isAuthenticated} />
        <McpReadme content={pkg.longDescription} />
        <CommentSection
          entityType="mcp"
          entityId={pkg.id}
          currentUserId={session?.userId}
          isAuthenticated={isAuthenticated}
        />
      </div>
      <McpSidebar package={pkg} />
    </div>
  );
}
