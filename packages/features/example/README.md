# @viben/features Example

This Vite app demonstrates how `packages/features` should be used: shared business helpers and reusable feature UI live in one package, while each app provides its own runtime adapter.

The example imports from `@viben/features`. Vite and TypeScript alias that package path to the local source so the demo can run before the package is built.

## What It Shows

- `createDemoManifest()` creates a shared action manifest.
- `summarizeActionManifest()` derives business state from the manifest.
- `ActionManifestPanel` renders shared React UI without depending on web, desktop, Tauri, or Next.js.
- `createBridgeEnvelope()` is re-exported from `@viben/protocol` for feature demo convenience.

## Run

```bash
pnpm --dir packages/features/example dev
```

Open the printed local URL. Click an action, then click `Invoke action` to simulate:

```txt
gateway -> invoke_action -> page -> action_result -> gateway
```

## Intended Integration Pattern

Apps should not import each other's pages. Instead:

```txt
apps/web adapter       apps/desktop adapter
        \                    /
         \                  /
          packages/features
            business helpers
            reusable feature UI
          packages/protocol
            action-bridge wire contracts
```

The adapter boundary keeps `packages/features` high-cohesion and low-coupling.
