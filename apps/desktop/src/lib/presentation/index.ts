// Re-export everything from @viben/presentation
export type {
  PresentationCommand,
  Point,
  Rect,
  TldrawColor,
  AnimationHandle,
  PresentationStep,
  PlayerState,
  PresentationToolName,
  ClientToolResultContent,
  ClientToolResult,
} from "@viben/presentation"
export {
  describeCommand,
  compilePresentationCommands,
  normalizePresentationToolName,
  isClientSidePresentationTool,
  registerCompletionCallback,
  consumeCompletionCallback,
  hasCompletionCallback,
  removeCompletionCallback,
} from "@viben/presentation"
