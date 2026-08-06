import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProjectSettingsLoaderProps {
  projectSlug: string
  teamSlug: string
  description: string | null
  createdBy: string
}

export function ProjectSettingsLoader({
  projectSlug, teamSlug, description, createdBy,
}: ProjectSettingsLoaderProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Project Slug</label>
            <p className="text-sm font-mono mt-1">{projectSlug}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Team</label>
            <p className="text-sm mt-1">{teamSlug}</p>
          </div>
          {description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-sm mt-1">{description}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-muted-foreground">URL</label>
            <p className="text-sm font-mono mt-1">viben-web.vercel.app/{teamSlug}/{projectSlug}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
