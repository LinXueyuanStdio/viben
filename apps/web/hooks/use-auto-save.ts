"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface AutoSaveOptions<T> {
  /** Unique key for this draft (e.g. "page-editor:{userSlug}:{pageId}") */
  key: string
  /** The data to auto-save */
  data: T
  /** Debounce delay in ms (default: 3000) */
  debounceMs?: number
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean
}

interface AutoSaveReturn<T> {
  /** Whether the latest data has been saved */
  saved: boolean
  /** Whether a save is in progress */
  saving: boolean
  /** Force an immediate save (bypasses debounce) */
  saveNow: () => void
  /** Check if a draft exists and return its data, or null */
  restoreDraft: () => T | null
  /** Remove the draft from storage */
  clearDraft: () => void
  /** Check whether a draft exists without reading its data */
  hasDraft: () => boolean
}

const DRAFT_PREFIX = "draft:"

function storageKey(key: string): string {
  return `${DRAFT_PREFIX}${key}`
}

function timestampKey(key: string): string {
  return `${DRAFT_PREFIX}${key}:ts`
}

/**
 * Generic auto-save hook using localStorage as the persistence layer.
 *
 * - Debounces writes (default 3000ms)
 * - Tracks `saved` / `saving` state
 * - Supports `restoreDraft()` to recover data after e.g. a page refresh
 * - Handles multiple editor tabs via unique draft keys
 */
export function useAutoSave<T>({
  key,
  data,
  debounceMs = 3000,
  enabled = true,
}: AutoSaveOptions<T>): AutoSaveReturn<T> {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastSavedRef = useRef<string>("")

  useEffect(() => {
    if (!enabled) return

    clearTimeout(timerRef.current)
    setSaved(false)

    timerRef.current = setTimeout(() => {
      try {
        setSaving(true)
        const serialized = JSON.stringify(data)
        localStorage.setItem(storageKey(key), serialized)
        localStorage.setItem(timestampKey(key), Date.now().toString())
        lastSavedRef.current = serialized
        setSaving(false)
        setSaved(true)
      } catch (err) {
        console.warn("[useAutoSave] Failed to save draft:", err)
        setSaving(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timerRef.current)
    }
  }, [key, data, debounceMs, enabled])

  const saveNow = useCallback(() => {
    if (!enabled) return
    clearTimeout(timerRef.current)
    try {
      setSaving(true)
      const serialized = JSON.stringify(data)
      localStorage.setItem(storageKey(key), serialized)
      localStorage.setItem(timestampKey(key), Date.now().toString())
      lastSavedRef.current = serialized
      setSaving(false)
      setSaved(true)
    } catch (err) {
      console.warn("[useAutoSave] Failed to save draft:", err)
      setSaving(false)
    }
  }, [key, data, enabled])

  const restoreDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey(key))
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }, [key])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey(key))
    localStorage.removeItem(timestampKey(key))
  }, [key])

  const hasDraft = useCallback((): boolean => {
    return localStorage.getItem(storageKey(key)) !== null
  }, [key])

  return { saved, saving, saveNow, restoreDraft, clearDraft, hasDraft }
}
