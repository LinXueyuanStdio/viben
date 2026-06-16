import { useState, useEffect, useMemo, type ReactNode } from "react"
import { buildTimelineLanes } from "../../utils/timeline"
import type { PresentationStep } from "../../types"
import type { PlaybackConsoleScript, JsonInspectorRenderProps, BashEditorRenderProps } from "./types"
import { injectConsoleStyles, DEFAULT_FPS } from "./styles"
import { ProgressStrip } from "./progress-strip"
import { CollapsedPlaybackConsole } from "./collapsed-console"
import { PlaybackControls } from "./playback-controls"
import { TimelineTracks } from "./timeline-tracks"
import { ActiveCommandList } from "./active-command-list"
import { IconPlay, IconPause, IconChevronLeft, IconChevronRight } from "./icons"

export interface PlaybackConsoleProps {
  script: PlaybackConsoleScript
  currentMs: number
  currentStepIndex: number
  activeSteps: PresentationStep[]
  isPlaying: boolean
  isLooping: boolean
  playbackRate: number
  fps?: number
  onSeek: (ms: number) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onGoToStart: () => void
  onGoToEnd: () => void
  onToggleLoop: () => void
  onSetPlaybackRate: (rate: number) => void
  onFrameStep: (direction: 1 | -1) => void
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
  renderJsonInspector?: (props: JsonInspectorRenderProps) => ReactNode
  renderBashEditor?: (props: BashEditorRenderProps) => ReactNode
  stepsToScript?: (steps: PresentationStep[]) => string
  onEditorRun?: (text: string) => Promise<{ steps: PresentationStep[]; totalMs: number; errors: Map<number, string> } | null>
}

export function PlaybackConsole({
  script,
  currentMs,
  currentStepIndex,
  activeSteps,
  isPlaying,
  isLooping,
  playbackRate,
  fps = DEFAULT_FPS,
  onSeek,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onGoToStart,
  onGoToEnd,
  onToggleLoop,
  onSetPlaybackRate,
  onFrameStep,
  onStepsChange,
  renderJsonInspector,
  renderBashEditor,
  stepsToScript,
  onEditorRun,
}: PlaybackConsoleProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const lanes = useMemo(
    () => buildTimelineLanes(script.steps, script.totalDurationMs),
    [script],
  )

  useEffect(() => { injectConsoleStyles() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault()
        setCollapsed((prev) => !prev)
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault()
        setLeftCollapsed((prev) => !prev)
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault()
        setRightCollapsed((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const gridTemplateColumns = useMemo(() => {
    const left = leftCollapsed ? "36px" : "260px"
    const right = rightCollapsed ? "36px" : "320px"
    return `${left} minmax(360px, 1fr) ${right}`
  }, [leftCollapsed, rightCollapsed])

  return (
    <div
      role="region"
      aria-label="Playback console"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9998,
        borderRadius: 14,
        background: "rgba(8, 10, 22, 0.92)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        color: "#fff",
        pointerEvents: "auto",
      }}
    >
      {!collapsed && (
        <ProgressStrip
          currentMs={currentMs}
          totalDurationMs={script.totalDurationMs}
          onSeek={onSeek}
        />
      )}

      <div
        className="pbc-collapse-anim"
        style={{
          display: collapsed ? "flex" : "grid",
          gridTemplateColumns: collapsed ? undefined : gridTemplateColumns,
          transition: "max-height 280ms cubic-bezier(0.4, 0, 0.2, 1), padding 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease, gap 250ms ease",
          alignItems: collapsed ? "center" : undefined,
          gap: collapsed ? 12 : 14,
          padding: collapsed ? "8px 14px" : "8px 14px 14px",
          maxHeight: collapsed ? 50 : 360,
          overflow: collapsed ? "hidden" : "visible",
          gridTemplateRows: collapsed ? undefined : "minmax(0, 1fr)",
          opacity: 1,
        }}
      >
        {collapsed ? (
          <CollapsedPlaybackConsole
            title={script.title}
            currentMs={currentMs}
            totalDurationMs={script.totalDurationMs}
            currentStepIndex={currentStepIndex}
            totalSteps={script.steps.length}
            activeCount={activeSteps.length}
            activeSteps={activeSteps}
            allSteps={script.steps}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPause={onPause}
            onSeek={onSeek}
            onNext={onNext}
            onPrevious={onPrevious}
            onToggleCollapse={() => setCollapsed(false)}
          />
        ) : (
          <>
            {leftCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", minHeight: 120 }}>
                <button className="pbc-btn pbc-btn-primary" type="button" title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"} onClick={isPlaying ? onPause : onPlay} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(118,185,0,0.5)", background: "rgba(118,185,0,0.2)", color: "#76B900", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
                </button>
                <button className="pbc-btn pbc-btn-ghost" type="button" title="Expand left panel (Ctrl+Shift+L)" aria-label="Expand left panel" onClick={() => setLeftCollapsed(false)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <IconChevronRight size={11} />
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <PlaybackControls
                  title={script.title}
                  currentMs={currentMs}
                  totalDurationMs={script.totalDurationMs}
                  currentStepIndex={currentStepIndex}
                  totalSteps={script.steps.length}
                  activeSteps={activeSteps}
                  isPlaying={isPlaying}
                  isLooping={isLooping}
                  playbackRate={playbackRate}
                  fps={fps}
                  onSeek={onSeek}
                  onPlay={onPlay}
                  onPause={onPause}
                  onNext={onNext}
                  onPrevious={onPrevious}
                  onGoToStart={onGoToStart}
                  onGoToEnd={onGoToEnd}
                  onToggleLoop={onToggleLoop}
                  onSetPlaybackRate={onSetPlaybackRate}
                  onFrameStep={onFrameStep}
                />
                <button className="pbc-btn pbc-btn-ghost" type="button" title="Collapse left panel (Ctrl+Shift+L)" aria-label="Collapse left panel" onClick={() => setLeftCollapsed(true)} style={{ position: "absolute", top: 4, right: -6, width: 18, height: 18, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
                  <IconChevronLeft size={9} />
                </button>
              </div>
            )}

            <TimelineTracks
              lanes={lanes}
              currentMs={currentMs}
              totalDurationMs={script.totalDurationMs}
              onSeek={onSeek}
              steps={script.steps}
              onStepsChange={onStepsChange}
              fps={fps}
              renderJsonInspector={renderJsonInspector}
              renderBashEditor={renderBashEditor}
              stepsToScript={stepsToScript}
              onEditorRun={onEditorRun}
            />

            {rightCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", minHeight: 120 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: activeSteps.length > 0 ? "rgba(118,185,0,0.2)" : "rgba(255,255,255,0.08)", border: activeSteps.length > 0 ? "1px solid rgba(118,185,0,0.5)" : "1px solid rgba(255,255,255,0.15)", color: activeSteps.length > 0 ? "#76B900" : "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {activeSteps.length}
                </div>
                <button className="pbc-btn pbc-btn-ghost" type="button" title="Expand right panel (Ctrl+Shift+R)" aria-label="Expand right panel" onClick={() => setRightCollapsed(false)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <IconChevronLeft size={11} />
                </button>
              </div>
            ) : (
              <div style={{ position: "relative", height: "100%", minHeight: 0 }}>
                <ActiveCommandList
                  steps={activeSteps}
                  currentMs={currentMs}
                  totalDurationMs={script.totalDurationMs}
                  onSeek={onSeek}
                  isPlaying={isPlaying}
                  allSteps={script.steps}
                  onCollapse={() => setCollapsed(true)}
                  onCollapseRight={() => setRightCollapsed(true)}
                  renderJsonInspector={renderJsonInspector}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
