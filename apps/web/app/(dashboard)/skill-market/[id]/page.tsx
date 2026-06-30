import { notFound } from 'next/navigation';
import { db, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { SkillHeader } from '@/components/skills/skill-header';
import { SkillReadme } from '@/components/skills/skill-readme';
import { SkillSidebar } from '@/components/skills/skill-sidebar';
import { CommentSection } from '@/components/social';

interface SkillDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { id } = await params;

  const [pkg, session] = await Promise.all([
    db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, id),
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
        <SkillHeader package={pkg} isAuthenticated={isAuthenticated} />
        <SkillReadme content={pkg.longDescription} />
        <CommentSection
          entityType="skill"
          entityId={pkg.id}
          currentUserId={session?.userId}
          isAuthenticated={isAuthenticated}
        />
      </div>
      <SkillSidebar package={pkg} />
    </div>
  );
}
