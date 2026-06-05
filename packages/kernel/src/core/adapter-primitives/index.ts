export { MessagingAdapter, type AdapterContext, type MessagingAdapterConfig, type SentMessage } from './messaging-adapter.js'
export { StreamAdapter, type StreamEvent } from './stream-adapter.js'
export { type IRenderer, BaseRenderer, type RenderedMessage, type RenderedPermission, type RenderedAction } from './rendering/index.js'
export { SendQueue, DraftManager, Draft, ToolCallTracker, ActivityTracker } from './primitives/index.js'
export type { SendQueueConfig, DraftConfig, TrackedToolCall, ActivityConfig, ActivityCallbacks } from './primitives/index.js'

export type { DisplayVerbosity, ToolCallMeta, ToolUpdateMeta, FormattedMessage, MessageMetadata, ViewerLinks } from './format-types.js'
export { STATUS_ICONS, KIND_ICONS } from './format-types.js'
export { progressBar, formatTokens, truncateContent, stripCodeFences, splitMessage } from './format-utils.js'
export { extractContentText, formatToolSummary, formatToolTitle, resolveToolIcon } from './message-formatter.js'

export { ToolStateMap, ThoughtBuffer } from './stream-accumulator.js'
export type { ToolEntry } from './stream-accumulator.js'
export { DisplaySpecBuilder } from './display-spec-builder.js'
export type { ToolDisplaySpec, ThoughtDisplaySpec } from './display-spec-builder.js'
export { OutputModeResolver } from './output-mode-resolver.js'
export type { OutputMode } from './format-types.js'
export { ToolCardState } from './primitives/tool-card-state.js'
export type { ToolCardSnapshot, ToolCardStateConfig } from './primitives/tool-card-state.js'

// Note: runAdapterConformanceTests is exported from the separate './testing' entry
// point to avoid pulling vitest into the main runtime bundle.
