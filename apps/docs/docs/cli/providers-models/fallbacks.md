---
sidebar_position: 4
title: "Model Fallbacks"
description: "Model fallback chains — DEPRECATED"
---

# Model Fallbacks 🚫 DEPRECATED

> **Fallback chain functionality has been removed from Viben CLI.**

## Status

Model fallback chains are no longer supported. The `viben model fallback` subcommand and the `fallbacks` field in `models.yaml` have been completely removed.

## What Changed

- `viben model fallback list` — Removed
- `viben model fallback set` — Removed
- `viben model fallback add` — Removed
- `viben model fallback remove` — Removed
- `viben model fallback clear` — Removed
- `fallbacks` field in `~/.viben/models.yaml` — Removed

## Migration

Instead of fallback chains, use the following alternatives:

### 1. Provider-level configuration

Configure multiple providers and let Viben handle availability. Use `viben provider create` to add backup providers:

```bash
viben provider create -t anthropic --api-key sk-ant-xxx
viben provider create -t openai --api-key sk-xxx
viben provider create -t google --api-key sk-xxx
```

### 2. Model aliases

Use aliases with `viben model alias create` to switch models easily:

```bash
viben model alias create -n prod -m claude-sonnet-4-20250514
# If Anthropic is down, switch the alias:
viben model alias create -n prod -m gpt-4-turbo
```

### 3. Use `viben model set-default` to change defaults

```bash
viben model set-default -n gpt-4-turbo
```

## Related

- [Model Aliases](./aliases) — Model alias management
- [Models Configuration](./models) — Model configuration
- [Providers Configuration](./providers) — Provider management
