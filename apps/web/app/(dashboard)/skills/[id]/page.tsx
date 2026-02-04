import { notFound } from 'next/navigation';
import { db, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { SkillHeader } from '@/components/skills/skill-header';
import { SkillReadme } from '@/components/skills/skill-readme';
import { SkillSidebar } from '@/components/skills/skill-sidebar';

interface SkillDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { id } = await params;

  const pkg = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
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
        <SkillHeader package={pkg} />
        <SkillReadme content={pkg.longDescription} />
      </div>
      <SkillSidebar package={pkg} />
    </div>
  );
}
