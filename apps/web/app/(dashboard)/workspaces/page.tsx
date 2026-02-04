import { FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Workspaces',
};

export default function WorkspacesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage your project-scoped configurations.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Placeholder for workspaces list */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold">Default Workspace</h3>
              <p className="text-sm text-muted-foreground">
                Your default workspace configuration.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span>3 MCPs enabled</span>
            <span>5 Skills enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
