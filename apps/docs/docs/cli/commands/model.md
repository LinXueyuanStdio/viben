---
sidebar_position: 10
title: "viben model"
description: "Manage models, aliases, and fallback chains"
---

# viben model

Manage AI models, aliases, and fallback configuration.

## Usage

```bash
viben model <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List available models |
| `show` | Show model details |
| `status` | Show model status |
| `set-default` | Set the default model |
| `alias` | Manage model aliases |
| `fallback` | Manage fallback chains |
| `config` | Manage model-specific configuration |
| `providers` | List available providers |

## Commands

### List Models

List available models:

```bash
# List all models
viben model list

# List models for a specific provider
viben model list --provider anthropic-main

# JSON output
viben model list --json
```

**Output (human-readable):**

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

### Show Model

Show detailed information about a specific model:

```bash
viben model show -n <model>
```

**Options**:

| Option | Description |
|--------|-------------|
| `-n <model>` | Model name to show details for |
| `--json` | JSON format output |

**Output (human-readable):**

```
Model: claude-sonnet-4-20250514

  Provider:         anthropic-main
  Context Window:   200K tokens
  Max Tokens:       8192
  Temperature:      0.7
  Supports Vision:  yes
  Supports Tools:   yes
  Cost (Input):     $3 / 1M tokens
  Cost (Output):    $15 / 1M tokens
```

**Examples**:

```bash
viben model show -n claude-sonnet-4-20250514
viben model show -n gpt-4-turbo --json
```

### Model Status

Check model availability:

```bash
# Check all models
viben model status

# Check specific model
viben model status -n claude-sonnet-4-20250514
```

**Output (human-readable):**

```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   ✓ available
  gpt-4-turbo                openai-main      ✓ available
  claude-3-5-haiku-latest    anthropic-main   ✓ available
  local-llama                local-ollama     ✗ provider offline
```

### Set Default Model

```bash
viben model set-default -n claude-sonnet-4-20250514
```

**Output:**

```
Set 'claude-sonnet-4-20250514' as default model
```

## Alias Management

Model aliases allow you to use short names to reference commonly used models.

### List Aliases

```bash
viben model alias list
```

**Output (human-readable):**

```
Model Aliases:
  fast   → claude-3-5-haiku-latest
  smart  → claude-sonnet-4-20250514
  best   → claude-opus-4-20250514
  gpt    → gpt-4-turbo
```

### Create Alias

```bash
# Create alias
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n smart -m claude-sonnet-4-20250514
viben model alias create -n best -m claude-opus-4-20250514
```

**Output:**

```
Created alias 'fast' → 'claude-3-5-haiku-latest'
```

### Remove Alias

```bash
viben model alias remove -n fast
```

### Resolve Alias

```bash
viben model alias resolve -n fast
```

## Fallback Chain Management

Fallback chains define the order of models to try when the primary model is unavailable.

### List Fallback Chain

```bash
viben model fallback list
```

**Output (human-readable):**

```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

### Set Fallback Chain

```bash
# Set fallback chain (supports space or comma separation)
viben model fallback set claude-sonnet-4-20250514 gpt-4-turbo claude-3-5-haiku-latest
```

### Add to Fallback Chain

```bash
viben model fallback add -n claude-sonnet-4-20250514
```

### Remove from Fallback Chain

```bash
viben model fallback remove -n gpt-4-turbo
```

### Clear Fallback Chain

```bash
viben model fallback clear
```

## Model Configuration

### View Model Configuration

```bash
viben model config show -n claude-sonnet-4-20250514
```

### Set Model Configuration

```bash
viben model config set -n claude-sonnet-4-20250514 --temperature 0.7 --max-tokens 8192
```

### Remove Model Configuration

```bash
viben model config remove -n claude-sonnet-4-20250514
```

## Model Configuration File

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

# Model aliases
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
  gpt: gpt-4-turbo
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest

# Fallback chain (tried in order)
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

# Model-specific configuration
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
