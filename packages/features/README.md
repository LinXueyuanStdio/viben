# @viben/features

`@viben/features` is the single shared feature package for Viben. It is the place for shared business rules, reusable React feature UI, and platform adapter interfaces that must be used by both `apps/web` and `apps/desktop`.

Wire protocol contracts live in `@viben/protocol`. `@viben/features` can re-export those types when a feature UI needs them, but infrastructure code should import protocol contracts directly from `@viben/protocol`.

The package should stay high-cohesion and low-coupling:

- Keep related feature code together inside `src/<feature-name>/`.
- Do not import Next.js server APIs, Tauri APIs, desktop stores, or app-specific route modules.
- Put platform-specific behavior behind adapters.
- Share contracts and reusable feature UI, not application shells.
- Keep wire protocol and schema types in `@viben/protocol`.

## Current Demo Feature: Action Bridge

`src/action-bridge` defines shared business helpers and reusable UI for connecting a cloud-hosted page to a local desktop gateway through a cloud relay. The wire contract is owned by `@viben/protocol`.

The intended runtime topology is:

```txt
Cloud browser page
  page-sdk registers actions and opens a bridge socket
        |
        v
apps/channel-server
  authenticated relay by bridge_session_id
        ^
        |
Local desktop gateway
  agent discovers page actions and invokes them
```

The browser page and the local gateway do not talk directly. Both connect outward to a relay, which avoids browser restrictions around `localhost`, Private Network Access, CORS, and mixed-content rules.

## Concepts

- `BridgeSession`: a short-lived pairing scope shared by one or more cloud page tabs and one or more gateway clients.
- `PageInstance`: one open browser tab for a published page. A page can have multiple live instances.
- `GatewayInstance`: one local gateway connection, usually owned by a desktop app.
- `ActionManifest`: the list of actions a page instance exposes, including input/output schema and permission level.
- `Invocation`: one action call from gateway to page, with a result or error response.

## Message Flow

1. Desktop or web creates a `bridge_session_id`.
2. The cloud page connects to the channel server as `role=page`.
3. The local gateway connects to the channel server as `role=gateway`.
4. The page sends an `action_manifest`.
5. The gateway sends `invoke_action`.
6. The page runs its action-system handler and responds with `action_result` or `action_error`.

## Package Boundaries

`page-sdk` should use `@viben/protocol` for bridge wire types. Browser-page helper UI or business behavior that should be shared with apps can live in `@viben/features`.

`client-sdk` should remain an API client for cloud HTTP APIs. It should not own page runtime behavior.

`apps/channel-server` should use `@viben/protocol` for relay protocol types. It should not know about React, Tauri, or page rendering.

`apps/web` and `apps/desktop` should consume feature UI and adapters from this package once integration begins.

## Demo Usage

The Vite example under `packages/features/example` imports feature UI and business helpers through the package boundary:

```ts
import {
  ActionManifestPanel,
  createDemoManifest,
  summarizeActionManifest
} from "@viben/features";
```

The demo server under `apps/channel-server` imports wire contracts through `@viben/protocol`:

```ts
import {
  createBridgeEnvelope,
  parseBridgeEnvelope,
  type BridgeEnvelope
} from "@viben/protocol";
```

Feature UI should eventually follow this shape:

```ts
interface PageActionBridgeAdapter {
  connect(input: { bridge_session_id: string; role: "page" | "gateway" }): Promise<void>;
  publishManifest(manifest: ActionManifest): Promise<void>;
  invokeAction(input: ActionInvokePayload): Promise<void>;
}
```

The adapter is implemented separately by cloud page runtime, local gateway runtime, web UI, and desktop UI.
