import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { fetchClawhubSkill, fetchClawhubSkillFile } from '@/lib/services/clawhub-registry';
import { OfficialSkillHeader } from '@/components/skills/official-skill-header';
import { OfficialSkillSidebar } from '@/components/skills/official-skill-sidebar';

interface OfficialSkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: OfficialSkillDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const skill = await fetchClawhubSkill(decodedSlug);

  if (!skill) {
    return {
      title: 'Skill Not Found',
    };
  }

  return {
    title: `${skill.name} - Skills Marketplace`,
    description: skill.description || undefined,
  };
}

export default async function OfficialSkillDetailPage({
  params,
}: OfficialSkillDetailPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const skill = await fetchClawhubSkill(decodedSlug);

  if (!skill) {
    notFound();
  }

  // Try to fetch the skill's README or main file
  let content: string | null = null;
  try {
    // Try common file paths
    content = await fetchClawhubSkillFile(decodedSlug, 'README.md');
    if (!content) {
      content = await fetchClawhubSkillFile(decodedSlug, 'index.md');
    }
  } catch {
    // Ignore file fetch errors
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <OfficialSkillHeader skill={skill} content={content} />
      </div>
      <OfficialSkillSidebar skill={skill} />
    </div>
  );
}
