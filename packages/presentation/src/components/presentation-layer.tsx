/**
 * @deprecated Use PresentationPlayer instead.
 * This file is kept as a stub for backward compatibility with apps/desktop.
 */
import type { PresentationStep, PlayerState } from "../types"

export interface PresentationLayerProps {
  presentationActive: boolean
  steps: PresentationStep[]
  currentStep: number
  playerState: PlayerState
  detailsOpen: boolean
  streamDone: boolean
  sessionId: string
  zIndex?: number
  stopPresentation: () => void
  playerPlay: () => void
  playerPause: () => void
  playerNext: () => void
  playerPrev: () => void
  playerGoTo: (index: number) => void
  playerGoToStart: () => void
  playerGoToEnd: () => void
  togglePresentationDetails: () => void
  completePresentationStep: (stepId: string, screenshot: string) => void
  getSteps: () => PresentationStep[]
  hasCompletedTool: (toolUseId: string) => boolean
  postToolCompletion: (toolUseId: string, content: any[], isError: boolean) => void
  log: (...args: any[]) => void
  logFlush: () => void
}

/**
 * @deprecated Use PresentationPlayer instead.
 * This component is a no-op stub. The desktop app should migrate to PresentationPlayer.
 */
export function PresentationLayer(_props: PresentationLayerProps) {
  // Deprecated: migrate to PresentationPlayer
  return null
}
