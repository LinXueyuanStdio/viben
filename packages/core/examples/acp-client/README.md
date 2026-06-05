# Viben ACP Client Example

Minimal React/Vite ACP client for exercising the Viben Gateway WebSocket endpoint:

```text
ws://127.0.0.1:18790/ws/agent/acp
```

The UI is adapted from the OpenACP dashboard shape, but targets Viben's ACP route directly. It supports:

- `initialize`
- `session/new`
- `session/load`
- `session/list`
- `session/prompt`
- `session/cancel`
- `unstable_closeSession`
- `session/update` stream rendering
- `_viben/client_tool_call` responses for client-side tools
- client-side tool call history with echoed input/result payloads
- `GUI_execute` simulation with editable actions
- backend selection through `agent_config.executor_type`, including `OPENCLAW`
- request-level `mcpServers` and inline `agent_config.mcp_servers`
- JSON-RPC traffic inspection

## ACP Backends

The backend selector writes `agent_config.executor_type` into `session/new` and
`session/load`. Useful values:

- `CLAUDE_CODE` -> official Claude ACP package or `claude-agent-acp`
- `OPENCLAW` -> `openclaw acp`
- `OPENCODE` -> `opencode acp`
- `CODEX` -> `npx @zed-industries/codex-acp`
- `GEMINI` -> `npx @google/gemini-cli --acp`

Use the Executor Config JSON field to override the backend command if needed:

```json
{
  "command": "/absolute/path/to/custom-acp-backend",
  "args": [],
  "init_timeout_ms": 120000
}
```

The Request MCP Servers JSON field is sent as ACP `mcpServers`. The inline agent
config also includes `mcp_servers: ["gui_action"]` so backend agents can call the
GUI action bridge exposed by Viben.

## GUI_execute Actions

The example client handles both `GUI_execute` and
`mcp__gui_action__GUI_execute`. Use the action editor to expose custom actions
to backend agents.

Supported built-in action names inside `GUI_execute`:

- `list_actions`
- `get_action_detail`
- any action name configured in the editor, such as `app.open_settings`

Example `GUI_execute` input:

```json
{
  "action": "app.open_settings",
  "payload": {
    "section": "models"
  }
}
```

`list_actions` returns the configured action summaries. `get_action_detail`
expects `payload.action` or `payload.name` and returns the configured schema.

## Run

Start the gateway:

```bash
pnpm gateway:restart
```

Start the example:

```bash
pnpm --filter @viben/core-acp-client-example dev
```

Open:

```text
http://127.0.0.1:5178/
```

## Headless Smoke Test

```bash
node /root/viben/mocks/fake-acp-client/index.mjs \
  --url ws://127.0.0.1:18790/ws/agent/acp \
  --log /root/viben/mocks/fake-acp-client/test-acp-client.log
```

When another gateway is already running on `18790`, start a temporary gateway on
another port and point both the UI and smoke test at that URL:

```bash
PATH=/root/viben/mocks/bin:$PATH VIBEN_MOCKS_NO_DELAY=1 VIBEN_TELEMETRY=false \
  node /root/viben/packages/core/dist/cli/bin.js gateway serve \
  --host 127.0.0.1 --port 18791

node /root/viben/mocks/fake-acp-client/index.mjs \
  --url ws://127.0.0.1:18791/ws/agent/acp \
  --log /root/viben/mocks/fake-acp-client/test-acp-client.log
```
