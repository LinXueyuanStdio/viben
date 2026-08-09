import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { fetchClawhubSkill, fetchClawhubSkillReadme } from '@/lib/services/clawhub-registry';
import { OfficialSkillHeader } from '@/components/skills/official-skill-header';
import { OfficialSkillSidebar } from '@/components/skills/official-skill-sidebar';
import { ReadmeSection } from './readme-section';
import { ReadmeSectionSkeleton } from './readme-skeleton';

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

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    title: `${skill.name} - Skills Marketplace`,
    description: skill.description || undefined,
    alternates: {
      canonical: `${APP_URL}/skill-market/official/${slug}`,
    },
    openGraph: {
      title: `${skill.name} - Skills Marketplace`,
      description: skill.description || undefined,
      url: `${APP_URL}/skill-market/official/${slug}`,
      type: "website",
    },
  };
}

export default async function OfficialSkillDetailPage({
  params,
}: OfficialSkillDetailPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  // Fetch skill data (needed for header + sidebar)
  const skill = await fetchClawhubSkill(decodedSlug);

  if (!skill) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6 min-w-0">
        <OfficialSkillHeader skill={skill} />
        <Suspense fallback={<ReadmeSectionSkeleton />}>
          <ReadmeContentWrapper slug={decodedSlug} />
        </Suspense>
      </div>
      <OfficialSkillSidebar skill={skill} />
    </div>
  );
}

/**
 * Wrapper component that fetches README content inside Suspense.
 * This enables streaming: header + sidebar render immediately,
 * while README content streams in when ready.
 */
async function ReadmeContentWrapper({ slug }: { slug: string }) {
  const content = await fetchClawhubSkillReadme(slug);
  return <ReadmeSection content={content} />;
}
