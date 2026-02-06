---
sidebar_position: 10
title: "viben model"
description: "Manage models, aliases, and fallback chains"
---

# viben model

Manage AI models, aliases, and fallback configurations.

## Usage

```bash
viben model <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List available models |
| `status` | Show model status |
| `set-default` | Set the default model |
| `aliases` | Manage model aliases |
| `fallbacks` | Manage fallback chain |

## Commands

### List Models

List available models:

```bash
# List all models
viben model list

# List models for specific provider
viben model list --provider anthropic-main

# JSON output
viben model list --json
```

**Output (Human-readable):**

```
Available Models:
  Provider: anthropic-main
    claude-opus-4-20250514        200K context   $15/$75
    claude-sonnet-4-20250514*     200K context   $3/$15
    claude-3-5-haiku-latest       200K context   $0.25/$1.25

  Provider: openai-main
    gpt-4-turbo                   128K context   $10/$30
    gpt-4o                        128K context   $2.5/$10
    gpt-4o-mini                   128K context   $0.15/$0.6

* = default model
```

**Output (JSON):**

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "name": "claude-opus-4-20250514",
        "provider": "anthropic-main",
        "context_window": 200000,
        "cost_input": 0.015,
        "cost_output": 0.075
      },
      {
        "name": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "context_window": 200000,
        "cost_input": 0.003,
        "cost_output": 0.015
      }
    ]
  }
}
```

### Model Status

Check model availability:

```bash
# Check all models
viben model status

# Check specific model
viben model status -n claude-sonnet-4-20250514
```

**Output (Human-readable):**

```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   available
  gpt-4-turbo                openai-main      available
  claude-3-5-haiku-latest    anthropic-main   available
  local-llama                local-ollama     provider offline
```

**Output (JSON):**

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "name": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "status": "available"
      },
      {
        "name": "local-llama",
        "provider": "local-ollama",
        "status": "unavailable",
        "reason": "provider offline"
      }
    ]
  }
}
```

### Set Default Model

Set the default model:

```bash
viben model set-default -n claude-sonnet-4-20250514
```

**Output:**

```
Set 'claude-sonnet-4-20250514' as default model
```

## Alias Management

Model aliases allow you to use short names for commonly used models.

### List Aliases

```bash
viben model aliases list
```

**Output (Human-readable):**

```
Model Aliases:
  fast   -> claude-3-5-haiku-latest
  smart  -> claude-sonnet-4-20250514
  best   -> claude-opus-4-20250514
  gpt    -> gpt-4-turbo
```

**Output (JSON):**

```json
{
  "success": true,
  "data": {
    "aliases": {
      "fast": "claude-3-5-haiku-latest",
      "smart": "claude-sonnet-4-20250514",
      "best": "claude-opus-4-20250514",
      "gpt": "gpt-4-turbo"
    }
  }
}
```

### Create Alias

```bash
# Create alias
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514
```

**Output:**

```
Created alias 'fast' -> 'claude-3-5-haiku-latest'
```

### Remove Alias

```bash
viben model aliases remove -n fast
```

**Output:**

```
Removed alias 'fast'
```

## Fallback Management

Fallback chains define the order of models to try when the primary model is unavailable.

### List Fallbacks

```bash
viben model fallbacks list
```

**Output (Human-readable):**

```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

**Output (JSON):**

```json
{
  "success": true,
  "data": {
    "fallbacks": [
      {
        "position": 1,
        "model": "claude-sonnet-4-20250514",
        "provider": "anthropic-main"
      },
      {
        "position": 2,
        "model": "gpt-4-turbo",
        "provider": "openai-main"
      },
      {
        "position": 3,
        "model": "claude-3-5-haiku-latest",
        "provider": "anthropic-main"
      }
    ]
  }
}
```

### Add to Fallback Chain

```bash
# Add model to fallback chain
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest
```

**Output:**

```
Added 'claude-sonnet-4-20250514' to fallback chain (position 1)
```

### Remove from Fallback Chain

```bash
viben model fallbacks remove -n gpt-4-turbo
```

**Output:**

```
Removed 'gpt-4-turbo' from fallback chain
```

### Clear Fallback Chain

```bash
viben model fallbacks clear
```

**Output:**

```
Cleared fallback chain
```

## Model Configuration File

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
  gpt: gpt-4-turbo
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest

fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8
```

## Model Capabilities

```yaml
# Model capabilities (for intelligent selection)
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.003
    cost_per_1k_output: 0.015

  gpt-4-turbo:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.01
    cost_per_1k_output: 0.03
```

## Error Handling

### Model Not Found

```json
{
  "success": false,
  "error": {
    "code": "MODEL_NOT_FOUND",
    "message": "Model 'unknown-model' not found"
  }
}
```

### Alias Already Exists

```json
{
  "success": false,
  "error": {
    "code": "ALIAS_EXISTS",
    "message": "Alias 'fast' already exists (points to 'claude-3-5-haiku-latest')"
  }
}
```

### Provider Unavailable

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "Provider 'local-ollama' is not available for model 'llama3'"
  }
}
```

## Related Commands

- [viben provider](./provider) - Provider management
- [viben agent](./agent) - Agent management
- [viben config](./config) - Configuration management
