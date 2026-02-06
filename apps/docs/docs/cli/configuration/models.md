---
sidebar_position: 4
title: "Model Configuration"
description: "Configure models, aliases, and fallback chains in Viben CLI"
---

# Model Configuration

Models configuration defines how Viben selects and uses AI models. You can set up convenient aliases, configure fallback chains for reliability, and customize model parameters.

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
  best: claude-opus-4-20250514

# Fallback chain for reliability
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

# Per-model configuration
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

# Model capabilities (for intelligent selection)
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
```

## Model Aliases

Aliases provide short, memorable names for commonly used models.

### Built-in Alias Suggestions

| Alias | Model | Use Case |
|-------|-------|----------|
| `fast` | `claude-3-5-haiku-latest` | Quick responses, simple tasks |
| `quick` | `gpt-4o-mini` | Low-cost, fast operations |
| `smart` | `claude-sonnet-4-20250514` | Balanced intelligence |
| `balanced` | `gpt-4o` | General purpose |
| `best` | `claude-opus-4-20250514` | Maximum capability |
| `powerful` | `gpt-4-turbo` | Complex reasoning |
| `code` | `claude-sonnet-4-20250514` | Coding tasks |
| `chat` | `claude-3-5-haiku-latest` | Conversational |
| `reasoning` | `o1-preview` | Deep reasoning |

### Provider-Specific Aliases

| Alias | Model |
|-------|-------|
| `gpt` | `gpt-4-turbo` |
| `claude` | `claude-sonnet-4-20250514` |
| `gemini` | `gemini-1.5-pro` |

### Alias Configuration

```yaml
aliases:
  # Speed-optimized
  fast: claude-3-5-haiku-latest
  quick: gpt-4o-mini

  # Intelligence-optimized
  smart: claude-sonnet-4-20250514
  balanced: gpt-4o

  # Maximum capability
  best: claude-opus-4-20250514
  powerful: gpt-4-turbo

  # Task-specific
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  reasoning: o1-preview
```

### Alias Commands

```bash
# List all aliases
viben model aliases list

# Create an alias
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514

# Remove an alias
viben model aliases remove -n fast
```

**Output of `viben model aliases list`:**

```
Model Aliases:
  fast   → claude-3-5-haiku-latest
  smart  → claude-sonnet-4-20250514
  best   → claude-opus-4-20250514
  gpt    → gpt-4-turbo
```

## Fallback Chains

Fallback chains ensure reliability by trying alternative models when the primary is unavailable.

### How Fallbacks Work

1. Viben tries the first model in the chain
2. If unavailable (API error, rate limit, etc.), tries the next
3. Continues until a model succeeds or all fail

### Fallback Configuration

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Primary choice
  - gpt-4-turbo                    # First fallback
  - claude-3-5-haiku-latest        # Second fallback
  - gpt-4o-mini                    # Last resort
```

### Fallback Commands

```bash
# List fallback chain
viben model fallbacks list

# Add model to fallback chain
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest

# Remove from fallback chain
viben model fallbacks remove -n gpt-4-turbo

# Clear entire fallback chain
viben model fallbacks clear
```

**Output of `viben model fallbacks list`:**

```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

## Model-Specific Configuration

Configure individual models with custom parameters:

```yaml
model_config:
  # Claude Sonnet 4
  claude-sonnet-4-20250514:
    provider: anthropic-main        # Which provider to use
    max_tokens: 8192                # Maximum output tokens
    temperature: 0.7                # Response randomness (0-1)
    # Optional parameters:
    # top_p: 0.9
    # top_k: 40
    # stop_sequences: ["\n\nHuman:"]

  # Claude Opus 4
  claude-opus-4-20250514:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.5                # More deterministic

  # Claude Haiku
  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8

  # GPT-4 Turbo
  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o
  gpt-4o:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o Mini
  gpt-4o-mini:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.8

  # Azure GPT-4
  azure-gpt-4:
    provider: azure-gpt4            # Uses Azure provider
    max_tokens: 4096
    temperature: 0.7

  # Gemini 1.5 Pro
  gemini-1.5-pro:
    provider: google-gemini
    max_tokens: 8192
    temperature: 0.7

  # Local Ollama model
  llama3:
    provider: local-ollama
    max_tokens: 4096
    temperature: 0.8

  # DeepSeek
  deepseek-chat:
    provider: deepseek
    max_tokens: 4096
    temperature: 0.7

  # Groq (LLaMA)
  llama-3.1-70b-versatile:
    provider: groq
    max_tokens: 4096
    temperature: 0.7
```

## Model Capabilities

Define model capabilities for intelligent model selection:

```yaml
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000          # Max input tokens
    supports_vision: true           # Image understanding
    supports_tools: true            # Function calling
    supports_streaming: true        # Streaming responses
    cost_per_1k_input: 0.003        # USD per 1K input tokens
    cost_per_1k_output: 0.015       # USD per 1K output tokens

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

## Model Commands

### List Available Models

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

### Filter by Provider

```bash
viben model list --provider anthropic-main
```

### Check Model Status

```bash
viben model status
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

```bash
viben model set-default -n claude-sonnet-4-20250514
```

## JSON Output

All model commands support `--json`:

```bash
viben model list --json
```

**Output:**

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
        "cost_input": 0.003,
        "cost_output": 0.015
      },
      {
        "name": "gpt-4-turbo",
        "provider": "openai-main",
        "context_window": 128000,
        "cost_input": 0.01,
        "cost_output": 0.03
      }
    ]
  }
}
```

```bash
viben model aliases list --json
```

**Output:**

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

## Quick Setup Examples

### Cost-Optimized Setup

```yaml
default: gpt-4o-mini

aliases:
  default: gpt-4o-mini
  upgrade: claude-sonnet-4-20250514

fallbacks:
  - gpt-4o-mini
  - claude-3-5-haiku-latest
```

### Quality-Optimized Setup

```yaml
default: claude-opus-4-20250514

aliases:
  default: claude-opus-4-20250514
  fast: claude-sonnet-4-20250514

fallbacks:
  - claude-opus-4-20250514
  - claude-sonnet-4-20250514
  - gpt-4-turbo
```

### Multi-Provider Resilience

```yaml
default: claude-sonnet-4-20250514

fallbacks:
  - claude-sonnet-4-20250514    # Anthropic primary
  - gpt-4-turbo                  # OpenAI backup
  - gemini-1.5-pro              # Google backup
  - llama3                       # Local fallback
```

### Local-First Development

```yaml
default: llama3

aliases:
  local: llama3
  cloud: claude-sonnet-4-20250514

fallbacks:
  - llama3
  - claude-3-5-haiku-latest
```

## Troubleshooting

### Model Not Available

```bash
# Check model status
viben model status -n claude-sonnet-4-20250514

# Verify provider is connected
viben provider status -n anthropic-main
```

### Fallback Not Working

```bash
# Check fallback chain
viben model fallbacks list

# Verify all providers in chain are configured
viben provider status
```

### Alias Not Resolving

```bash
# List all aliases
viben model aliases list

# Check if alias exists
viben model aliases list --json | jq '.data.aliases.fast'
```

## Next Steps

- [Provider Configuration](/docs/cli/configuration/providers) - Configure API providers
- [Config Command](/docs/cli/configuration/config-command) - General configuration management
