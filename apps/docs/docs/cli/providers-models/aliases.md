---
sidebar_position: 3
title: "Model Aliases"
description: "Create convenient shortcuts for model names with Viben CLI"
---

# Model Aliases

Aliases let you reference models with short, memorable names instead of full model identifiers like `claude-sonnet-4-20250514`.

## Concept

An alias is a short name that maps to a full model name:

```
fast   ->  claude-3-5-haiku-latest
smart  ->  claude-sonnet-4-20250514
best   ->  claude-opus-4-20250514
```

This means you can use `fast` anywhere you would use `claude-3-5-haiku-latest`.

## Commands

### List Aliases

View all configured aliases:

```bash
viben model alias list
```

**Output:**
```
Model Aliases:
  Alias   Model                      Built-in
  fast    claude-3-5-haiku-latest    Yes
  smart   claude-sonnet-4-20250514   Yes
  best    claude-opus-4-20250514     Yes
  gpt     gpt-4-turbo
```

For JSON output:

```bash
viben model alias list --json
```

### Create Alias

Create a new alias using `-n` for the alias name and `-m` for the target model:

```bash
viben model alias create -n <alias> -m <model>
```

**Examples:**

```bash
# Create speed-focused aliases
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n quick -m gpt-4o-mini

# Create quality-focused aliases
viben model alias create -n smart -m claude-sonnet-4-20250514

# Create purpose-specific aliases
viben model alias create -n code -m claude-sonnet-4-20250514
viben model alias create -n chat -m claude-3-5-haiku-latest

# Create provider-specific aliases
viben model alias create -n gpt -m gpt-4-turbo
viben model alias create -n claude -m claude-sonnet-4-20250514
```

### Remove Alias

```bash
viben model alias remove -n <alias>
# or
viben model alias rm -n <alias>
```

### Resolve Alias

```bash
viben model alias resolve -n fast
# Output: fast -> claude-3-5-haiku-latest
```

## Built-in Aliases

Viben comes with several pre-configured aliases:

| Alias | Target |
|-------|--------|
| `fast` | claude-3-5-haiku-latest |
| `smart` | claude-sonnet-4-20250514 |
| `opus` | claude-opus-4-20250514 |

## Configuration File

Aliases are stored in `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  code: claude-sonnet-4-20250514
```

> **Note**: Custom alias persistence is managed through the aliases system. The previous standalone alias configuration has been integrated into the models configuration.

## Using Aliases

Once configured, use aliases anywhere you specify a model:

```bash
# Set default model using alias
viben model set-default -n fast

# Use alias with model show
viben model show -n fast
```

## Updating Aliases

To update an alias to point to a different model, simply create it again:

```bash
viben model alias create -n fast -m gpt-4o-mini
```

This will overwrite the existing alias.

## Best Practices

### Use Semantic Names

Choose alias names that describe the use case, not the specific model:

```bash
# Good - semantic naming
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n best -m claude-opus-4-20250514

# Less ideal - model-specific naming
viben model alias create -n haiku -m claude-3-5-haiku-latest
```

### Keep Aliases Minimal

Too many aliases can be confusing. Stick to a small set:

```yaml
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
```

## Related

- [Model Fallbacks](./fallbacks) — ⚠️ Deprecated
- [Models Configuration](./models) — Model configuration
- [Providers Configuration](./providers) — Provider management
