# Viben ACP Client Example

Minimal React/Vite ACP client for exercising the Viben Gateway WebSocket endpoint:

```text
ws://127.0.0.1:18790/ws/agent/acp
```

The UI is adapted from the OpenACP dashboard shape, but targets Viben's ACP route directly. It supports:

- `initialize`
- `session/new`
- `session/prompt`
- `session/cancel`
- `session/update` stream rendering
- `_viben/client_tool_call` responses for client-side tools
- JSON-RPC traffic inspection

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
