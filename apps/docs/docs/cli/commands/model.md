---
sidebar_position: 10
title: "viben model"
description: "Manage models, aliases, and model configuration"
---

# viben model

Manage AI models, aliases, and model configuration.

## Usage

```bash
viben model <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List available models (supports `--provider`, `--category`, `--surface` filters) |
| `show` | Show model details |
| `status` | Show model availability statistics |
| `set-default` | Set the default model (supports `--surface` for per-surface defaults) |
| `create` | Create a custom model entry |
| `alias` | Manage model aliases (list, create, remove, resolve) |
| `config` | Manage model-specific configuration (show, set, remove) |
| `providers` | List providers with available models |

## Commands

### List Models

List available models:

```bash
# List all models
viben model list

# List models for a specific provider
viben model list --provider anthropic-main

# Filter by category (llm or media)
viben model list --category media

# Filter by surface
viben model list --surface image

# JSON output
viben model list --json
```

**Output (human-readable):**

```
Available Models:
  ID        Name          Provider         Category  Surface  Caps      Context  Default
  claude-4  Claude Opus 4  anthropic-main   llm       chat     vision    200K     Yes
```

**Output (JSON):**

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "id": "claude-opus-4-20250514",
        "name": "Claude Opus 4",
        "provider": "anthropic-main",
        "category": "llm",
        "surface": "chat",
        "contextLength": 200000
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
| `-n <model>` | Model ID or alias to show details for |
| `--json` | JSON format output |

**Output (human-readable):**

```
Model: claude-sonnet-4-20250514
  Name:           Claude Sonnet 4
  Provider:       anthropic-main
  Context Length: 200K
  Max Output:     8K
  Input Price:    $3.00/1M
  Output Price:   $15.00/1M
  Is Default:     Yes
```

### Model Status

Check model availability statistics:

```bash
viben model status
```

**Output:**

```
Model Status
  Known Models:     45
  Providers:        anthropic-main, openai-main, google-main
  Configured Aliases: 4
  Default Model:    claude-sonnet-4-20250514

Models by Provider:
  anthropic-main: 12 models
  openai-main: 8 models
  google-main: 5 models
```

### Set Default Model

```bash
# Set global default
viben model set-default -n claude-sonnet-4-20250514

# Set default for a specific surface
viben model set-default -n dall-e-3 --surface image
```

### Create Model

Create a custom model entry:

```bash
viben model create -n my-custom-model \
  --provider openai-main \
  --display-name "My Custom GPT-4" \
  --category llm \
  --surface chat \
  --context-window 128000 \
  --max-output-tokens 4096 \
  --capability vision \
  --capability tools \
  --description "Custom GPT-4 instance" \
  -d  # set as default
```

**Options**:

| Option | Description |
|--------|-------------|
| `-n, --name <model>` | Model ID (required) |
| `--provider <provider>` | Provider ID or type (required) |
| `--display-name <name>` | Human-readable display name |
| `--category <category>` | Model category: `llm` or `media` |
| `--surface <surface>` | Model surface: `chat`, `image`, `video`, `music`, `speech`, `sfx` |
| `--capability <capability>` | Capability tag (repeatable): `vision`, `tools`, `streaming`, etc. |
| `--description <description>` | Model description |
| `--context-window <tokens>` | Maximum context window size |
| `--max-output-tokens <tokens>` | Maximum output tokens |
| `-d, --default` | Set as default model |

## Alias Management

Model aliases allow you to use short names to reference commonly used models.

### List Aliases

```bash
viben model alias list
```

### Create Alias

```bash
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n smart -m claude-sonnet-4-20250514
```

### Remove Alias

```bash
viben model alias remove -n fast
# or
viben model alias rm -n fast
```

### Resolve Alias

```bash
viben model alias resolve -n fast
```

## Model Configuration

### View Configuration

```bash
viben model config show -n claude-sonnet-4-20250514
```

### Set Configuration

```bash
viben model config set -n claude-sonnet-4-20250514 \
  --temperature 0.7 \
  --max-tokens 8192 \
  --top-p 0.9 \
  --frequency-penalty 0.1 \
  --presence-penalty 0.1
```

### Remove Configuration

```bash
viben model config remove -n claude-sonnet-4-20250514
# or
viben model config rm -n claude-sonnet-4-20250514
```

## Configuration File

Model configuration is stored in `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

# Model aliases (built-in + custom)
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  opus: claude-opus-4-20250514

# Model-specific configuration
model_config:
  claude-sonnet-4-20250514:
    temperature: 0.7
    maxTokens: 8192
```

> **Note**: Fallback chain support has been removed. Use provider-level fallback strategies instead.

## Model Categories & Surfaces

| Category | Surfaces | Description |
|----------|----------|-------------|
| `llm` | `chat` | Text generation (CLI, chat, agent) |
| `media` | `image` | Image generation |
| `media` | `video` | Video generation |
| `media` | `music` | Music generation |
| `media` | `speech` | Text-to-speech |
| `media` | `sfx` | Sound effects generation |

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

## Related Commands

- [viben provider](./provider) — Provider management
- [viben agent](./agent) — Agent management
- [viben config](./config) — Configuration management
- [Models Configuration](../configuration/models.md)
