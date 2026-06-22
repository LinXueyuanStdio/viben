# Viben Channel Server Demo

`apps/channel-server` is a demo relay for Cloud Page Action Bridge sessions.

It imports bridge envelope contracts from `@viben/protocol`; it does not depend on `@viben/features` or any React UI.

It is intentionally not wired into `apps/web`, `apps/desktop`, `page-sdk`, or gateway yet. The goal is to demonstrate the pairing model:

```txt
cloud page demo client <-> channel-server <-> gateway demo client
```

Both sides connect by WebSocket with the same `bridge_session_id`.

## Run

Terminal 1:

```bash
pnpm --dir apps/channel-server dev
```

Terminal 2:

```bash
BRIDGE_SESSION_ID=demo pnpm --dir apps/channel-server demo:page
```

Terminal 3:

```bash
BRIDGE_SESSION_ID=demo pnpm --dir apps/channel-server demo:gateway
```

The page demo publishes an action manifest and responds to `invoke_action`. The gateway demo invokes the page action after it sees the manifest.

## WebSocket Endpoint

```txt
ws://127.0.0.1:17891/bridge?bridge_session_id=<id>&role=page&client_id=<id>
ws://127.0.0.1:17891/bridge?bridge_session_id=<id>&role=gateway&client_id=<id>
```

This demo keeps all session state in memory.
