import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ProjectListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-4 w-1/2 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function MemberListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        <div className="h-9 w-20 rounded bg-muted animate-pulse" />
      </div>
      <div className="divide-y border rounded-lg">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-32 rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-12 rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-20 w-full rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-24 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-32 w-full rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  )
}
