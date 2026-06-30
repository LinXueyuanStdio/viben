"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface CollectionInfo {
  slug: string
  name: string
  page_count: number
}

export interface CollectionSelectorValue {
  slug: string
  name: string
}

interface CollectionSelectorProps {
  value: CollectionSelectorValue | null
  onChange: (collection: CollectionSelectorValue | null) => void
}

export function CollectionSelector({ value, onChange }: CollectionSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  // Fetch user's collections when popover opens
  const fetchCollections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pages/collections?mine=true")
      if (res.ok) {
        const data = await res.json()
        setCollections(data.collections ?? [])
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchCollections()
      setShowCreate(false)
      setNewName("")
    }
  }, [open, fetchCollections])

  const handleSelect = (col: CollectionInfo) => {
    onChange({ slug: col.slug, name: col.name })
    setOpen(false)
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/pages/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const data = await res.json()
        onChange({ slug: data.collection.slug, name: data.collection.name })
        setOpen(false)
      }
    } catch {
      // silently ignore
    } finally {
      setCreating(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value ? (
            <span className="flex items-center gap-2">
              <span>{value.name}</span>
            </span>
          ) : (
            t("pageEditor.collectionPlaceholder")
          )}
          <span className="flex items-center gap-1">
            {value && (
              <X
                className="size-3.5 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {showCreate ? (
          <div className="p-3 space-y-3">
            <p className="text-sm font-medium">{t("pageEditor.newCollection")}</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("pageEditor.collectionName")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
                if (e.key === "Escape") {
                  setShowCreate(false)
                  setNewName("")
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreate(false)
                  setNewName("")
                }}
              >
                {t("community.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {t("pageEditor.createCollection")}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="max-h-[200px] overflow-auto p-1">
              {loading ? (
                <p className="py-4 text-center text-[13px] text-muted-foreground">
                  {t("community.loading")}
                </p>
              ) : collections.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-muted-foreground">
                  {t("pageEditor.noCollections")}
                </p>
              ) : (
                collections.map((col) => (
                  <button
                    key={col.slug}
                    onClick={() => handleSelect(col)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-sm hover:bg-surface-secondary",
                      value?.slug === col.slug && "bg-primary/10"
                    )}
                  >
                    <span>{col.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[12px] text-muted-foreground">
                        {col.page_count} {t("community.pages")}
                      </span>
                      {value?.slug === col.slug && (
                        <Check className="size-4 text-primary" />
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border p-1">
              <button
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-sm hover:bg-surface-secondary text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" />
                {t("pageEditor.newCollection")}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
