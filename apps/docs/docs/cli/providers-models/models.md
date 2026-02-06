---
sidebar_position: 2
title: "Model Management"
description: "Manage AI models, view availability, and configure model settings with Viben CLI"
---

# Model Management

Models are the AI services you interact with. Each model is associated with a provider and can have custom configuration settings.

## Commands

### List Models

List all available models from configured providers:

```bash
viben model list
```

**Output:**
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

Filter by provider:

```bash
viben model list --provider anthropic-main
```

For JSON output:

```bash
viben model list --json
```

### Check Model Status

View the availability status of configured models:

```bash
# Check all models
viben model status

# Check specific model
viben model status -n claude-sonnet-4-20250514
```

**Output:**
```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   ✓ available
  gpt-4-turbo                openai-main      ✓ available
  claude-3-5-haiku-latest    anthropic-main   ✓ available
  local-llama                local-ollama     ✗ provider offline
```

### Set Default Model

Set a model as the default for all operations:

```bash
viben model set-default -n <model>
```

**Example:**
```bash
viben model set-default -n claude-sonnet-4-20250514
```

## Configuration File

Models are configured in `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
version: 1

# Default model
default: claude-sonnet-4-20250514

# Model aliases (see aliases.md)
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514

# Fallback chain (see fallbacks.md)
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
```

## Model Configuration

Each model can have custom settings that override defaults:

```yaml
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main        # Which provider to use
    max_tokens: 8192                # Maximum output tokens
    temperature: 0.7                # Temperature (0.0-1.0)
    # Optional parameters
    # top_p: 0.9
    # top_k: 40
    # stop_sequences: ["\n\nHuman:"]

  claude-opus-4-20250514:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.5                # Lower temperature for more deterministic output

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # Azure-hosted model
  azure-gpt-4:
    provider: azure-gpt4            # Uses Azure provider
    max_tokens: 4096
    temperature: 0.7

  # Local Ollama model
  llama3:
    provider: local-ollama
    max_tokens: 4096
    temperature: 0.8
```

## Model Capabilities

You can define model capabilities for intelligent model selection:

```yaml
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.003
    cost_per_1k_output: 0.015

  claude-opus-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.015
    cost_per_1k_output: 0.075

  gpt-4-turbo:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.01
    cost_per_1k_output: 0.03

  gpt-4o-mini:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.00015
    cost_per_1k_output: 0.0006
```

## Popular Models Reference

### Anthropic Models

| Model | Context | Input Cost | Output Cost | Notes |
|-------|---------|-----------|-------------|-------|
| `claude-opus-4-20250514` | 200K | $15/1M | $75/1M | Most capable |
| `claude-sonnet-4-20250514` | 200K | $3/1M | $15/1M | Balanced |
| `claude-3-5-haiku-latest` | 200K | $0.25/1M | $1.25/1M | Fastest |

### OpenAI Models

| Model | Context | Input Cost | Output Cost | Notes |
|-------|---------|-----------|-------------|-------|
| `gpt-4-turbo` | 128K | $10/1M | $30/1M | Most capable |
| `gpt-4o` | 128K | $2.5/1M | $10/1M | Balanced |
| `gpt-4o-mini` | 128K | $0.15/1M | $0.6/1M | Fastest |
| `o1-preview` | 128K | $15/1M | $60/1M | Reasoning |

### Google Models

| Model | Context | Input Cost | Output Cost | Notes |
|-------|---------|-----------|-------------|-------|
| `gemini-1.5-pro` | 2M | $1.25/1M | $5/1M | Large context |
| `gemini-1.5-flash` | 1M | $0.075/1M | $0.3/1M | Fast |

## Using Models with Aliases

Instead of remembering full model names, use [aliases](./aliases):

```bash
# Instead of this:
viben model set-default -n claude-sonnet-4-20250514

# Use an alias:
viben model set-default -n smart
```

Common alias conventions:

| Alias | Typical Model | Use Case |
|-------|---------------|----------|
| `fast` | claude-3-5-haiku-latest | Quick responses |
| `smart` | claude-sonnet-4-20250514 | Balanced quality |
| `best` | claude-opus-4-20250514 | Maximum quality |
| `code` | claude-sonnet-4-20250514 | Coding tasks |
| `chat` | claude-3-5-haiku-latest | Casual conversation |

## JSON Output

All commands support `--json` flag:

```bash
viben model list --json
```

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "name": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "context_window": 200000,
        "status": "available"
      },
      {
        "name": "gpt-4-turbo",
        "provider": "openai-main",
        "context_window": 128000,
        "status": "available"
      }
    ]
  }
}
```

## Next Steps

- [Model Aliases](./aliases) - Create convenient shortcuts for model names
- [Model Fallbacks](./fallbacks) - Set up automatic fallback chains
- [Provider Management](./providers) - Configure providers for your models
