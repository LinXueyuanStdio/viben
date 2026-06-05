# Design: Convert Legacy ACP modes/models to configOptions

**Date:** 2026-04-03
**Status:** Implemented

## Problem

Gemini CLI returns `modes` and `models` fields in its `newSession` ACP response (old protocol format):

```json
{
  "sessionId": "...",
  "modes": { "currentModeId": "code", "availableModes": [...] },
  "models": { "currentModelId": "gemini-2.5-pro", "availableModels": [...] }
}
```

Viben's session factory only reads the new `configOptions[]` format. As a result, `/model` and `/mode` commands fail with "This agent does not support switching models/modes" because `session.configOptions` remains empty.

## Root Cause

`session-factory.ts` propagates ACP state from `agentInstance.initialSessionResponse` but only handles `resp.configOptions` — ignoring the legacy `modes`/`models` fields that Gemini CLI sends.

## Fix

In `session-factory.ts`, when `configOptions` is absent, build equivalent `ConfigOption[]` objects from the legacy `modes` and `models` fields. The new format takes precedence: if an agent sends `configOptions`, it is used as-is. Only fall back to conversion when `configOptions` is missing.

```typescript
} else {
  // Convert legacy modes/models fields (old ACP format) to configOptions
  const legacyOptions: ConfigOption[] = [];
  if (resp.modes) { /* map to ConfigOption with category: 'mode' */ }
  if (resp.models) { /* map to ConfigOption with category: 'model' */ }
  if (legacyOptions.length > 0) session.setInitialConfigOptions(legacyOptions);
}
```

## Files Changed

- `src/core/sessions/session-factory.ts` — added legacy conversion logic and type imports
- `src/core/agents/agent-instance.ts` — removed stray `console.log` debug statement

## Scope

Only affects initial session creation. Resumed sessions hydrate from cached `acpState.configOptions` which was already in the new format. Live `config_option_update` events from the agent continue to override as before.
