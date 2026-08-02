"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil, Search, X, Check } from "lucide-react"
import { SectionHead } from "@/components/content/section-head"
import { Cover } from "@/components/content/cover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ProfileContentItemData } from "./profile-content-item"
import Link from "next/link"

// ===== Types =====

interface PinnedItem {
  id: string
  entity_type: "page" | "mcp" | "skill"
  entity_id: string
  position: number
  data: ProfileContentItemData & { pageUid?: string }
}

interface PinnablePage {
  id: string; uid: string; title: string; description: string | null
  coverUrl: string | null; likeCount: number; viewCount: number; visibility: string
}
interface PinnableMcp {
  id: string; name: string; slug: string; description: string | null
  version: string; transport: string; downloadsCount: number; bookmarksCount: number
}
interface PinnableSkill {
  id: string; name: string; slug: string; description: string | null
  version: string; skillType: string; downloadsCount: number; bookmarksCount: number
}

interface ProfilePinnedSectionProps {
  pinnedItems: PinnedItem[]
  isOwnProfile: boolean
}

// ===== SortableCard =====

function SortableCard({ item, onRemove }: { item: PinnedItem; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const href = item.entity_type === "page" && (item.data as any).pageUid
    ? `/${encodeURIComponent((item.data as any).pageUid)}`
    : item.entity_type === "mcp"
      ? `/mcp-market/${item.entity_id}`
      : `/skill-market/${item.entity_id}`

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-[12px] border border-border bg-card overflow-hidden">
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="absolute top-2 left-2 z-10 size-7 flex items-center justify-center rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="size-4 text-muted-foreground" />
      </button>

      <Link href={href} className="block">
        <Cover coverUrl={item.data.coverUrl} fallbackTitle={item.data.title} aspectRatio="16/9" />
        <div className="p-2.5 space-y-1">
          <h3 className="font-['Lexend'] text-[14px] font-bold leading-snug line-clamp-2">{item.data.title}</h3>
          {item.data.description && (
            <p className="text-[12px] text-muted-foreground truncate">{item.data.description}</p>
          )}
          <div className="flex items-center gap-1.5">
            {item.data.badges?.map((b, i) => (
              <span key={i} className="inline-flex items-center rounded-md border border-border px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">{b}</span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  )
}

// ===== EditPinnedDialog =====

function EditPinnedDialog({
  open, onClose, currentPins, onSave,
}: {
  open: boolean; onClose: () => void
  currentPins: { entity_type: string; entity_id: string }[]
  onSave: (pins: { entity_type: "page" | "mcp" | "skill"; entity_id: string; position: number }[]) => Promise<void>
}) {
  const router = useRouter()
  const [typeFilters, setTypeFilters] = useState<string[]>(["page", "mcp", "skill"])
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Map<string, { entity_type: "page" | "mcp" | "skill"; entity_id: string; label: string }>>(new Map())
  const [pages, setPages] = useState<PinnablePage[]>([])
  const [mcps, setMcps] = useState<PinnableMcp[]>([])
  const [skills, setSkills] = useState<PinnableSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const remaining = 6 - selected.size

  // Load pinnable items
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const types = typeFilters.join(",")
    const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""
    fetch(`/api/profile/pinnable-items?types=${types}${q}`)
      .then((r) => r.json())
      .then((data) => {
        setPages(data.pages || [])
        setMcps(data.mcps || [])
        setSkills(data.skills || [])
      })
      .catch(() => toast.error("加载可置顶项失败"))
      .finally(() => setLoading(false))
  }, [open, typeFilters, searchQuery])

  // Initialize selection from current pins
  useEffect(() => {
    if (!open) return
    const map = new Map<string, { entity_type: "page" | "mcp" | "skill"; entity_id: string; label: string }>()
    // We don't have labels here, they'll be filled from loaded data
    setSelected(map)
  }, [open])

  const toggleType = (t: string) => {
    setTypeFilters((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  const toggleItem = (entity_type: "page" | "mcp" | "skill", entity_id: string, label: string) => {
    setSelected((prev) => {
      const next = new Map(prev)
      const key = `${entity_type}:${entity_id}`
      if (next.has(key)) {
        next.delete(key)
      } else if (next.size < 6) {
        next.set(key, { entity_type, entity_id, label })
      }
      return next
    })
  }

  const isSelected = (entity_type: string, entity_id: string) => selected.has(`${entity_type}:${entity_id}`)

  const handleSearch = () => {
    // Trigger re-fetch via useEffect (searchQuery is a dependency)
  }

  const handleSave = async () => {
    setSaving(true)
    const pins = Array.from(selected.values()).map((s, i) => ({
      entity_type: s.entity_type,
      entity_id: s.entity_id,
      position: i,
    }))
    try {
      await onSave(pins)
      toast.success("置顶项已保存")
      onClose()
      router.refresh()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold">编辑置顶项</h2>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-surface-secondary">
            <X className="size-4" />
          </button>
        </div>

        {/* Subtitle */}
        <p className="px-5 pt-3 text-[13px] text-muted-foreground">
          Select up to six public pages, MCP, skills you&apos;d like to show to anyone.
        </p>

        {/* Search + Filters */}
        <div className="px-5 py-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <Search className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {(["page", "mcp", "skill"] as const).map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  typeFilters.includes(t)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {typeFilters.includes(t) && <Check className="size-3" />}
                {t === "page" ? "页面" : t === "mcp" ? "MCP" : "技能"}
              </button>
            ))}
          </div>
        </div>

        {/* Remaining */}
        <div className="px-5 pb-2">
          <span className={cn("text-xs font-semibold", remaining === 0 ? "text-destructive" : "text-muted-foreground")}>
            {remaining} remaining
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {typeFilters.includes("page") && pages.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-muted-foreground pt-1 pb-1">Pages</div>
                  {pages.map((p) => (
                    <label
                      key={`page:${p.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        isSelected("page", p.id) ? "bg-primary/5" : "hover:bg-surface-secondary"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected("page", p.id)}
                        onChange={() => toggleItem("page", p.id, p.title)}
                        disabled={!isSelected("page", p.id) && selected.size >= 6}
                        className="size-4 rounded border-border"
                      />
                      <span className="flex-1 text-sm font-medium truncate">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.likeCount} likes</span>
                    </label>
                  ))}
                </>
              )}
              {typeFilters.includes("mcp") && mcps.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-muted-foreground pt-1 pb-1">MCP</div>
                  {mcps.map((m) => (
                    <label
                      key={`mcp:${m.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        isSelected("mcp", m.id) ? "bg-primary/5" : "hover:bg-surface-secondary"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected("mcp", m.id)}
                        onChange={() => toggleItem("mcp", m.id, m.name)}
                        disabled={!isSelected("mcp", m.id) && selected.size >= 6}
                        className="size-4 rounded border-border"
                      />
                      <span className="flex-1 text-sm font-medium truncate">{m.name}</span>
                      <span className="text-xs text-muted-foreground">{m.downloadsCount} downloads</span>
                    </label>
                  ))}
                </>
              )}
              {typeFilters.includes("skill") && skills.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-muted-foreground pt-1 pb-1">Skills</div>
                  {skills.map((s) => (
                    <label
                      key={`skill:${s.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        isSelected("skill", s.id) ? "bg-primary/5" : "hover:bg-surface-secondary"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected("skill", s.id)}
                        onChange={() => toggleItem("skill", s.id, s.name)}
                        disabled={!isSelected("skill", s.id) && selected.size >= 6}
                        className="size-4 rounded border-border"
                      />
                      <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.downloadsCount} downloads</span>
                    </label>
                  ))}
                </>
              )}
              {pages.length === 0 && mcps.length === 0 && skills.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No items found</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存置顶项"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ===== Main Component =====

export function ProfilePinnedSection({ pinnedItems, isOwnProfile }: ProfilePinnedSectionProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [items, setItems] = useState(pinnedItems)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newItems = arrayMove(items, oldIndex, newIndex).map((item, i) => ({ ...item, position: i }))
    setItems(newItems)

    // Persist new order
    fetch("/api/profile/pins", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pins: newItems.map((item) => ({
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          position: item.position,
        })),
      }),
    }).catch(() => toast.error("排序保存失败"))
  }

  const handleSavePins = async (pins: { entity_type: "page" | "mcp" | "skill"; entity_id: string; position: number }[]) => {
    const res = await fetch("/api/profile/pins", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pins }),
    })
    if (!res.ok) throw new Error("Save failed")
    router.refresh()
  }

  if (!isOwnProfile && pinnedItems.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <SectionHead title="置顶" />
        {isOwnProfile && (
          <button
            onClick={() => setDialogOpen(true)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            自定义你的置顶
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border bg-card/50">
          <p className="text-sm text-muted-foreground mb-3">
            Pin up to six items — pages, MCPs, or skills — to feature them on your profile.
          </p>
          {isOwnProfile && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Pencil className="size-3.5" />
              自定义你的置顶
            </Button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {items.map((item) => (
                <SortableCard key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <EditPinnedDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        currentPins={pinnedItems.map((i) => ({ entity_type: i.entity_type, entity_id: i.entity_id }))}
        onSave={handleSavePins}
      />
    </section>
  )
}
