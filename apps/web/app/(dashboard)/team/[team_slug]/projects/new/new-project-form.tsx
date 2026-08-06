"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function NewProjectForm({ teamSlug }: { teamSlug: string }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-fill slug from name if slug hasn't been manually edited
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/teams/${teamSlug}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          project_slug: slug.trim(),
          description: description.trim() || undefined,
        }),
      })
      if (res.ok) {
        toast.success("Project created")
        router.push(`/team/${teamSlug}/projects`)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Failed to create project")
      }
    } catch {
      toast.error("Failed to create project")
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          placeholder="My Project"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectSlug">Project Slug</Label>
        <Input
          id="projectSlug"
          placeholder="my-project"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
        />
        <p className="text-xs text-muted-foreground">
          URL: viben-web.vercel.app/{teamSlug}/{slug || "..."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectDesc">Description (optional)</Label>
        <Textarea
          id="projectDesc"
          placeholder="A short description of the project"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={creating || !name.trim() || !slug.trim()}>
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Project
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
