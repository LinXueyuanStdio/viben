# @viben/protocol

`@viben/protocol` contains shared wire contracts, runtime guards, and message helpers used across Viben packages and apps.

It must stay platform-neutral:

- No React, Next.js, Tauri, browser UI, or app store imports.
- No feature business rules.
- No network client implementation.
- Only stable protocol types and small validation/creation helpers.

## Current Protocols

### Cloud Page Action Bridge

The action bridge protocol connects a cloud page and a local gateway through `apps/channel-server`.

```txt
cloud page <-> channel-server <-> local gateway
```

Use the package root:

```ts
import {
  createBridgeEnvelope,
  parseBridgeEnvelope,
  type ActionManifest,
  type BridgeEnvelope
} from "@viben/protocol";
```

`@viben/features` may re-export protocol types for feature UI convenience, but infrastructure packages such as `apps/channel-server` should import protocol contracts directly from `@viben/protocol`.
