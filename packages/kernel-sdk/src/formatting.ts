// Format utilities for rendering agent output in adapters
export type { DisplayVerbosity, ToolCallMeta, ToolUpdateMeta, ViewerLinks } from '@viben/kernel'
export {
  STATUS_ICONS, KIND_ICONS,
  progressBar, formatTokens, truncateContent, stripCodeFences, splitMessage,
  extractContentText, formatToolSummary, formatToolTitle, resolveToolIcon,
} from '@viben/kernel'
