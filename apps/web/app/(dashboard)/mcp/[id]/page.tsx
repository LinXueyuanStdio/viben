import { notFound } from 'next/navigation';
import { db, mcpPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { McpHeader } from '@/components/mcp/mcp-header';
import { McpReadme } from '@/components/mcp/mcp-readme';
import { McpSidebar } from '@/components/mcp/mcp-sidebar';

interface McpDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function McpDetailPage({ params }: McpDetailPageProps) {
  const { id } = await params;

  const pkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!pkg) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <McpHeader package={pkg} />
        <McpReadme content={pkg.longDescription} />
      </div>
      <McpSidebar package={pkg} />
    </div>
  );
}
