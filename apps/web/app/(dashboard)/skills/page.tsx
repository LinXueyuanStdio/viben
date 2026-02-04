import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Skills Marketplace',
};

export default function SkillsMarketplacePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Skills Marketplace</h1>
        <p className="text-muted-foreground">
          Discover and install AI skills to enhance your workflow.
        </p>
      </div>

      {/* Placeholder for skills grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold">Example Skill {i}</h3>
                <p className="text-sm text-muted-foreground">
                  A brief description of what this skill does.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span>command</span>
              <span>850 downloads</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
