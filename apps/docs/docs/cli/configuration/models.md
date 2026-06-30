---
sidebar_position: 4
title: "Model Configuration"
description: "Configure models, aliases, and model parameters in Viben CLI"
---

# Model Configuration

Models configuration defines how Viben selects and uses AI models. You can set up convenient aliases, customize model parameters, and manage model selection.

## Configuration File

Model configuration is stored in `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
version: 1

# Default model to use
default: claude-sonnet-4-20250514

# Model aliases for quick access
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  opus: claude-opus-4-20250514

# Per-model configuration
model_config:
  claude-sonnet-4-20250514:
    temperature: 0.7
    maxTokens: 8192
```

> **Note**: Fallback chains have been removed. Use provider-level strategies instead. See [Provider Configuration](./providers.md).

## Model Aliases

Aliases provide short, memorable names for commonly used models.

### Built-in Aliases

Viben ships with pre-configured built-in aliases:

| Alias | Model | Use Case |
|-------|-------|----------|
| `fast` | `claude-3-5-haiku-latest` | Quick responses |
| `smart` | `claude-sonnet-4-20250514` | Balanced intelligence |
| `opus` | `claude-opus-4-20250514` | Maximum capability |

### Custom Aliases

Create custom aliases for your workflow:

```yaml
aliases:
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  gpt: gpt-4-turbo
```

### Alias Commands

```bash
# List all aliases (shows built-in vs custom)
viben model alias list

# Create an alias (-n for alias name, -m for target model)
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n smart -m claude-sonnet-4-20250514

# Remove an alias
viben model alias remove -n fast
# or
viben model alias rm -n fast

# Resolve an alias to its model ID
viben model alias resolve -n fast
```

## Model Categories & Surfaces

Models are organized by category and surface:

| Category | Surfaces | Description |
|----------|----------|-------------|
| `llm` | `chat` | Text generation (CLI, agent) |
| `media` | `image`, `video`, `music`, `speech`, `sfx` | Media generation |

### Filter Models

```bash
# List LLM models only (default)
viben model list --category llm

# List media models
viben model list --category media

# Filter by surface
viben model list --surface image
viben model list --surface chat
```

## Model-Specific Configuration

Configure individual models with custom parameters:

```yaml
model_config:
  claude-sonnet-4-20250514:
    temperature: 0.7
    maxTokens: 8192
    topP: 0.9

  gpt-4-turbo:
    temperature: 0.7
    maxTokens: 4096
```

### Config Commands

```bash
# View model config
viben model config show -n claude-sonnet-4-20250514

# Set model config
viben model config set -n claude-sonnet-4-20250514 \
  --temperature 0.7 \
  --max-tokens 8192 \
  --top-p 0.9

# Remove model config
viben model config remove -n claude-sonnet-4-20250514
```

## Creating Custom Models

```bash
viben model create -n my-custom-model \
  --provider openai-main \
  --display-name "My Custom GPT-4" \
  --category llm \
  --surface chat \
  --context-window 128000 \
  --max-output-tokens 4096 \
  --capability vision \
  --capability tools
```

## Model Commands Reference

### List Available Models

```bash
viben model list
viben model list --provider anthropic-main
viben model list --json
```

### Show Model Details

```bash
viben model show -n claude-sonnet-4-20250514
viben model show -n fast  # Resolves alias
```

### Check Model Status

```bash
viben model status
```

### Set Default Model

```bash
# Global default
viben model set-default -n claude-sonnet-4-20250514

# Per-surface default
viben model set-default -n dall-e-3 --surface image
```

### List Providers

```bash
viben model providers
```

## JSON Output

All model commands support `--json`:

```bash
viben model list --json
```

## Quick Setup Examples

### Development Setup

```yaml
default: claude-sonnet-4-20250514

aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
```

### Media Generation Setup

```bash
viben model set-default -n sora-2 --surface video
viben model set-default -n elevenlabs-tts --surface speech
```

## Troubleshooting

### Model Not Available

```bash
viben model status
viben provider status -n anthropic-main
```

### Alias Not Resolving

```bash
viben model alias list
viben model alias resolve -n fast
```

## Next Steps

- [Provider Configuration](./providers.md) - Configure API providers
- [Model Commands](../commands/model.md) - CLI command reference
