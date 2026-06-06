# ACP GUI Action Flow

## WebSocket Event Order

1. Client sends `session/prompt` with the user prompt.
2. Server sends `session/update` with `sessionUpdate: "tool_call"` and a stable `toolCallId`.
3. Server sends reverse JSON-RPC request `_viben/client_tool_call` for `GUI_execute`.
4. Client shows the action confirmation/editor and replies to `_viben/client_tool_call` with the tool result.
5. Server sends `session/update` with `sessionUpdate: "tool_call_update"` and the same `toolCallId`.
6. Server streams final answer chunks through `session/update` with `sessionUpdate: "agent_message_chunk"`.
7. Server replies to the original `session/prompt` with `stopReason` and optional `usage`/`cost`.

## UI Step Order

1. User prompt is appended as a `user` message.
2. `tool_call` is queued as one `tool_use` message.
3. `_viben/client_tool_call` opens the GUI action modal; duplicate pending events are upserted by `toolUseId`.
4. `tool_call_update` is queued as a `tool_result` message with the same `toolUseId`.
5. `agent_message_chunk` bypasses the normal step queue and accumulates in `MessageList.streamingText`.
6. When `session/prompt` resolves, queued structural steps are drained first, then `streamingText` is flushed into one final `text` message.
7. The prompt result is appended as a `summary` message when it contains `stopReason`, usage, or cost data.

`@viben/chat` keeps `tool_use` and `tool_result` as separate data messages, matching `packages/chat/example`. The rendered card is still one tool card because `MessageList` pairs them by `toolUseId`.
