"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

export default function CreateTeamPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    // 自动生成 slug：转小写，替换空格为连字符，移除非字母数字
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
    setSlug(generated)
    setSlugError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (generated.length > 0) {
      debounceRef.current = setTimeout(async () => {
        setSlugChecking(true)
        try {
          const res = await fetch(`/api/teams/check-slug?slug=${encodeURIComponent(generated)}`)
          const data = await res.json()
          if (!data.available) {
            setSlugError(data.message)
          }
        } catch {
          // ignore network errors
        } finally {
          setSlugChecking(false)
        }
      }, 500)
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!name || !slug || !!slugError || !acceptedTerms) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/team/${data.team_slug}/invite`)
      } else {
        const data = await res.json()
        setSlugError(data.error || "Failed to create team")
      }
    } catch {
      setSlugError("Network error")
    } finally {
      setSubmitting(false)
    }
  }, [name, slug, slugError, acceptedTerms, router])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://viben-web.vercel.app"

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Tell us about your team</h2>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Set up your team</h1>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Team name</label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="my-awesome-team"
            autoFocus
          />
          {slugChecking && (
            <p className="text-sm text-muted-foreground">Checking availability...</p>
          )}
          {slugError && (
            <p className="text-sm text-destructive">{slugError}</p>
          )}
        </div>

        {slug && !slugError && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>This will be the name of your account on Viben.</p>
            <p>
              Your URL will be:{" "}
              <span className="text-foreground font-medium">
                {appUrl}/{slug}
              </span>
              .
            </p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
            I hereby accept the{" "}
            <a href="/terms" className="text-primary underline" target="_blank">
              Terms of Service
            </a>
            . For more information about Viben&apos;s privacy practices, see the{" "}
            <a href="/privacy" className="text-primary underline" target="_blank">
              Viben Privacy Statement
            </a>
            .
          </label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!name || !slug || !!slugError || !acceptedTerms || submitting}
          className="w-full"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Next
        </Button>
      </div>
    </div>
  )
}
