import type React from "react"
import type { RefObject, ReactNode } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../../types"
import type { TimelineLane } from "../../utils/timeline"

export interface PlaybackConsoleScript {
  id: string
  title: string
  description: string
  icon: string
  steps: PresentationStep[]
  totalDurationMs: number
  useBackground: boolean
}

export interface JsonInspectorRenderProps {
  value: unknown
  height?: number
  initialMode?: "tree" | "text" | "table"
  focusPath?: string[]
  compact?: boolean
  fillHeight?: boolean
}

export interface BashEditorRenderProps {
  value: string
  onChange: (value: string) => void
  activeLines: number[]
  errorLines: Map<number, string>
  onLineClick: (lineNumber: number) => void
  steps: PresentationStep[]
  onRun: () => void
  style?: React.CSSProperties
}

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
}

export interface IsolatedPlaybackConsoleProps {
  script: PlaybackConsoleScript
  playerRef: RefObject<PlayerRef | null>
  fps?: number
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
  renderJsonInspector?: (props: JsonInspectorRenderProps) => ReactNode
  renderBashEditor?: (props: BashEditorRenderProps) => ReactNode
}
