import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProfilePackagesClient } from './profile-packages-client';

interface ProfilePackagesProps {
  userId: string;
}

export async function ProfilePackages({ userId }: ProfilePackagesProps) {
  const [mcps, skills] = await Promise.all([
    db.query.mcpPackages.findMany({
      where: eq(mcpPackages.authorId, userId),
      orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
      limit: 10,
    }),
    db.query.skillPackages.findMany({
      where: eq(skillPackages.authorId, userId),
      orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
      limit: 10,
    }),
  ]);

  // Map database results to client component props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ProfilePackagesClient mcps={mcps as any} skills={skills as any} />;
}
