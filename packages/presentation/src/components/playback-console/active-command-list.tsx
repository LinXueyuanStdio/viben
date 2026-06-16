import { useState, useRef, useEffect, useMemo, type ReactNode } from "react"
import type { PresentationStep } from "../../types"
import { describeCommand } from "../../types"
import { formatTime, commandColor } from "../../utils/timeline"
import { IconChevronDown, IconChevronRight } from "./icons"
import type { JsonInspectorRenderProps } from "./types"

export function ActiveCommandList({
  steps,
  currentMs,
  totalDurationMs,
  onSeek,
  isPlaying,
  allSteps,
  onCollapse,
  onCollapseRight,
  renderJsonInspector,
}: {
  steps: PresentationStep[]
  currentMs: number
  totalDurationMs: number
  onSeek: (ms: number) => void
  isPlaying: boolean
  allSteps?: PresentationStep[]
  onCollapse?: () => void
  onCollapseRight?: () => void
  renderJsonInspector?: (props: JsonInspectorRenderProps) => ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const prevStepIdsRef = useRef<Set<string>>(new Set())
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<"list" | "json">("list")

  // Track entering steps for transition indicators
  const currentStepIds = useMemo(() => new Set(steps.map((s) => s.id)), [steps])

  useEffect(() => {
    const prevIds = prevStepIdsRef.current
    const newEntering = new Set<string>()

    for (const id of currentStepIds) {
      if (!prevIds.has(id)) newEntering.add(id)
    }

    if (newEntering.size > 0) {
      setEnteringIds(newEntering)
      const timer = window.setTimeout(() => setEnteringIds(new Set()), 400)
      prevStepIdsRef.current = currentStepIds
      return () => window.clearTimeout(timer)
    }

    prevStepIdsRef.current = currentStepIds
  }, [currentStepIds])

  // Auto-scroll to bottom when playing and new steps appear
  useEffect(() => {
    if (isPlaying && listRef.current && steps.length > 0) {
      const el = listRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [steps.length, isPlaying])

  // Next upcoming step (for empty state)
  const nextStep = useMemo(() => {
    if (!allSteps || steps.length > 0) return null
    const upcoming = allSteps
      .filter((s) => s.startMs > currentMs && s.command.type !== "wait" && s.command.type !== "clear")
      .sort((a, b) => a.startMs - b.startMs)
    return upcoming[0] ?? null
  }, [allSteps, steps, currentMs])

  return (
    <section
      aria-label="Active commands"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        height: "100%",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        {/* Left: collapse-right button + label + count */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          {onCollapseRight && (
            <button
              className="pbc-btn pbc-btn-ghost"
              type="button"
              title="Collapse right panel (Ctrl+Shift+R)"
              aria-label="Collapse right panel"
              onClick={onCollapseRight}
              style={{
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 5,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <IconChevronRight size={10} />
            </button>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
            Active
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: steps.length > 0 ? "rgba(118,185,0,0.18)" : "rgba(255,255,255,0.06)",
              fontSize: 9,
              fontWeight: 700,
              color: steps.length > 0 ? "#76B900" : "rgba(255,255,255,0.35)",
            }}
          >
            {steps.length}
          </span>
        </div>

        {/* Right: List/JSON toggle + Collapse button */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* List/JSON toggle */}
          <div style={{ display: "flex", padding: 2, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              type="button"
              onClick={() => setMode("list")}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: "none",
                background: mode === "list" ? "rgba(255,255,255,0.14)" : "transparent",
                color: mode === "list" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 100ms ease",
              }}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setMode("json")}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: "none",
                background: mode === "json" ? "rgba(255,255,255,0.14)" : "transparent",
                color: mode === "json" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 100ms ease",
              }}
            >
              JSON
            </button>
          </div>
          {onCollapse && (
            <button
              className="pbc-btn pbc-btn-ghost"
              type="button"
              title="Collapse (Ctrl+Shift+E)"
              aria-label="Collapse console"
              onClick={onCollapse}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 26,
                padding: "0 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <IconChevronDown size={10} />
              <span>Collapse</span>
            </button>
          )}
        </div>
      </div>

      {/* Content area — fills remaining height */}
      {mode === "json" ? (
        <div
          className="pbc-panel-fade"
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {renderJsonInspector?.({ value: steps, initialMode: "tree", focusPath: steps.length > 0 ? ["0", "command"] : undefined, fillHeight: true }) ?? (
            <pre style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.5)", overflow: "auto", margin: 0 }}>
              {JSON.stringify(steps, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div
          ref={listRef}
          className="pbc-panel-fade"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            borderRadius: 8,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {steps.length === 0 ? (
            <ActiveEmptyState currentMs={currentMs} totalDurationMs={totalDurationMs} nextStep={nextStep} />
          ) : (
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {steps.map((step, idx) => (
                <ActiveCommandCard
                  key={step.id}
                  step={step}
                  currentMs={currentMs}
                  totalDurationMs={totalDurationMs}
                  isEntering={enteringIds.has(step.id)}
                  onClick={() => onSeek(step.startMs)}
                  staggerIndex={idx}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Enhanced empty state with animated clock, countdown to next step, and preview */
export function ActiveEmptyState({ currentMs, totalDurationMs, nextStep }: { currentMs: number; totalDurationMs: number; nextStep?: PresentationStep | null }) {
  const timeToNext = nextStep ? Math.max(0, nextStep.startMs - currentMs) : null
  const timeToNextSec = timeToNext !== null ? (timeToNext / 1000).toFixed(1) : null
  const progressPct = totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0

  return (
    <div
      style={{
        height: 205,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "rgba(255,255,255,0.25)",
        fontSize: 12,
        textAlign: "center",
        padding: "8px 12px",
      }}
    >
      {/* Animated clock with spinning hand */}
      <div style={{ position: "relative", width: 36, height: 36 }}>
        <svg className="pbc-empty-clock" width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="10" stroke="rgba(118,185,0,0.2)" strokeWidth={0.5} />
        </svg>
        <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="rgba(118,185,0,0.6)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", top: 0, left: 0 }}>
          <polyline className="pbc-clock-hand-anim" points="12 7 12 12 15 14" />
        </svg>
      </div>

      {/* Countdown to next step */}
      {timeToNextSec !== null ? (
        <span className="pbc-waiting-pulse" style={{ fontWeight: 600, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Next step in {timeToNextSec}s
        </span>
      ) : (
        <span className="pbc-waiting-pulse" style={{ fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
          Waiting for next step...
        </span>
      )}

      {/* Next step preview */}
      {nextStep && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: commandColor(nextStep.command.type), boxShadow: `0 0 4px ${commandColor(nextStep.command.type)}66` }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: commandColor(nextStep.command.type), textTransform: "uppercase" }}>
            {nextStep.command.type}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nextStep.description || describeCommand(nextStep.command)}
          </span>
        </div>
      )}

      {/* Mini timeline progress bar */}
      <div style={{ width: "80%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden", marginTop: 4 }}>
        <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, rgba(118,185,0,0.4), rgba(118,185,0,0.7))", borderRadius: 2, transition: "width 100ms linear" }} />
        {nextStep && totalDurationMs > 0 && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(nextStep.startMs / totalDurationMs) * 100}%`, width: 2, background: commandColor(nextStep.command.type), borderRadius: 1, opacity: 0.6 }} />
        )}
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 10, color: "rgba(255,255,255,0.2)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
        <span>{formatTime(currentMs)}</span>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>/</span>
        <span>{formatTime(totalDurationMs)}</span>
      </div>
    </div>
  )
}

export function ActiveCommandCard({
  step,
  currentMs,
  totalDurationMs,
  isEntering,
  onClick,
  staggerIndex = 0,
}: {
  step: PresentationStep
  currentMs: number
  totalDurationMs: number
  isEntering: boolean
  onClick: () => void
  staggerIndex?: number
}) {
  const color = commandColor(step.command.type)
  const elapsed = Math.max(0, currentMs - step.startMs)
  const duration = (step.endMs ?? step.startMs) - step.startMs
  const progressPct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 100
  const endMs = step.endMs ?? totalDurationMs
  const nearEnd = endMs - currentMs < 500 && endMs - currentMs > 0
  const remainingSec = Math.max(0, (endMs - currentMs) / 1000)

  return (
    <div
      className={`pbc-cmd-card ${isEntering ? "pbc-cmd-card-enter pbc-cmd-card-pulse" : ""}`}
      onClick={onClick}
      title={`Click to seek to ${formatTime(step.startMs)}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "7px 8px 7px 12px",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        borderLeft: `3px solid ${color}`,
        animationDelay: isEntering ? `${staggerIndex * 50}ms` : undefined,
      }}
    >
      {/* Progress background fill */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${progressPct}%`,
          background: `${color}0a`,
          borderRight: progressPct < 100 ? `1px solid ${color}22` : "none",
          pointerEvents: "none",
          transition: "width 100ms linear",
        }}
      />

      {/* Top row: type icon + name prominently */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        {/* Color dot icon */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {isEntering && (
            <span style={{ fontSize: 8, color: "#76B900", lineHeight: 1 }}>&#x2191;</span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: 4,
              background: `${color}18`,
              border: `1px solid ${color}33`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 2,
                background: color,
                boxShadow: `0 0 5px ${color}88`,
              }}
            />
          </span>
        </div>

        {/* Type name + timing */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {step.command.type}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {nearEnd && (
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
                {remainingSec.toFixed(1)}s
              </span>
            )}
            <span
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "SFMono-Regular, Consolas, monospace",
                whiteSpace: "nowrap",
              }}
            >
              {formatTime(step.startMs)}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: "rgba(255,255,255,0.7)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingLeft: 30,
          position: "relative",
        }}
      >
        {step.description || describeCommand(step.command)}
      </div>

      {/* Mini-timeline bar showing step progress */}
      <div
        style={{
          marginLeft: 30,
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            borderRadius: 2,
            transition: "width 100ms linear",
          }}
        />
      </div>
    </div>
  )
}
