---
sidebar_position: 4
title: "Model Fallbacks"
description: "Configure automatic fallback chains when primary models are unavailable"
---

# Model Fallbacks

Fallback chains define the order of models to try when the primary model is unavailable. This ensures your workflows continue even if a provider experiences downtime.

## Concept

A fallback chain is an ordered list of models:

```
1. claude-sonnet-4-20250514    (primary)
2. gpt-4-turbo                 (first fallback)
3. claude-3-5-haiku-latest     (second fallback)
4. gpt-4o-mini                 (last resort)
```

When you request a model, Viben tries each in order until one succeeds.

## Commands

### List Fallback Chain

View the current fallback chain:

```bash
viben model fallbacks list
```

**Output:**
```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

For JSON output:

```bash
viben model fallbacks list --json
```

### Add to Fallback Chain

Add a model to the end of the fallback chain:

```bash
viben model fallbacks create -n <model>
```

**Examples:**

```bash
# Build a fallback chain step by step
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest
viben model fallbacks create -n gpt-4o-mini
```

### Remove from Fallback Chain

Remove a model from the fallback chain:

```bash
viben model fallbacks remove -n <model>
```

**Example:**
```bash
viben model fallbacks remove -n gpt-4o-mini
```

### Clear Fallback Chain

Remove all models from the fallback chain:

```bash
viben model fallbacks clear
```

## Configuration File

Fallbacks are stored in `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

fallbacks:
  - claude-sonnet-4-20250514      # Primary choice
  - gpt-4-turbo                    # First fallback
  - claude-3-5-haiku-latest        # Second fallback
  - gpt-4o-mini                    # Last resort
```

## Fallback Strategies

### Cross-Provider Fallbacks

Ensure resilience by including models from different providers:

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Anthropic (primary)
  - gpt-4-turbo                    # OpenAI (fallback)
  - gemini-1.5-pro                 # Google (second fallback)
```

This protects against provider-specific outages.

### Local Fallback

Include a local model as the last resort:

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Cloud (primary)
  - gpt-4-turbo                    # Cloud (fallback)
  - llama3                         # Local Ollama (last resort)
```

This ensures operation even without internet connectivity.

### Cost-Optimized Fallbacks

Arrange by cost, starting with cheaper models:

```yaml
fallbacks:
  - gpt-4o-mini                    # Cheapest
  - claude-3-5-haiku-latest        # Inexpensive
  - gpt-4o                         # Moderate
  - claude-sonnet-4-20250514      # Higher quality
  - claude-opus-4-20250514        # Highest quality (last resort)
```

### Quality-Optimized Fallbacks

Arrange by quality, starting with the best:

```yaml
fallbacks:
  - claude-opus-4-20250514        # Best quality
  - claude-sonnet-4-20250514      # High quality
  - gpt-4-turbo                    # Good quality
  - claude-3-5-haiku-latest        # Faster but lower quality
  - gpt-4o-mini                    # Fast but basic
```

## How Fallbacks Work

When a request is made:

1. Viben tries the first model in the chain
2. If it fails (timeout, rate limit, provider error), it moves to the next
3. This continues until a model succeeds or the chain is exhausted
4. If all models fail, an error is returned

```
Request
   |
   v
claude-sonnet-4-20250514 --> FAIL (rate limited)
   |
   v
gpt-4-turbo --> FAIL (timeout)
   |
   v
claude-3-5-haiku-latest --> SUCCESS
   |
   v
Response
```

## Combining with Aliases

Fallbacks can use aliases instead of full model names:

```yaml
aliases:
  smart: claude-sonnet-4-20250514
  gpt: gpt-4-turbo
  fast: claude-3-5-haiku-latest

fallbacks:
  - smart  # Resolves to claude-sonnet-4-20250514
  - gpt    # Resolves to gpt-4-turbo
  - fast   # Resolves to claude-3-5-haiku-latest
```

This makes configuration more readable and easier to maintain.

## Best Practices

### Mix Providers

Include at least two different providers in your fallback chain:

```yaml
# Good - multiple providers
fallbacks:
  - claude-sonnet-4-20250514      # Anthropic
  - gpt-4-turbo                    # OpenAI
  - gemini-1.5-pro                 # Google

# Less robust - single provider
fallbacks:
  - claude-opus-4-20250514
  - claude-sonnet-4-20250514
  - claude-3-5-haiku-latest
```

### Include a Fast Option

Always include a fast/cheap model as a last resort:

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Quality first
  - gpt-4-turbo                    # Backup
  - gpt-4o-mini                    # Fast fallback
```

### Keep Chain Reasonable

A chain of 3-5 models is usually sufficient:

```yaml
# Good - focused chain
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

# May be excessive - too many fallbacks
fallbacks:
  - model1
  - model2
  - model3
  - model4
  - model5
  - model6
  - model7
```

### Test Your Chain

Periodically test that all models in your fallback chain are configured correctly:

```bash
viben model status
```

## Recommended Fallback Chains

### General Purpose

```yaml
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest
```

### High Availability

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Anthropic
  - gpt-4o                         # OpenAI
  - gemini-1.5-pro                 # Google
  - llama3                         # Local (no internet needed)
```

### Cost-Conscious

```yaml
fallbacks:
  - gpt-4o-mini
  - claude-3-5-haiku-latest
  - gpt-4o
  - claude-sonnet-4-20250514
```

### Development Environment

```yaml
fallbacks:
  - llama3                         # Local first (free, fast)
  - claude-3-5-haiku-latest        # Cloud fallback (cheap)
  - gpt-4o-mini                    # Alternative (cheap)
```

## JSON Output

```bash
viben model fallbacks list --json
```

```json
{
  "success": true,
  "data": {
    "fallbacks": [
      {
        "order": 1,
        "model": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "status": "available"
      },
      {
        "order": 2,
        "model": "gpt-4-turbo",
        "provider": "openai-main",
        "status": "available"
      },
      {
        "order": 3,
        "model": "claude-3-5-haiku-latest",
        "provider": "anthropic-main",
        "status": "available"
      }
    ]
  }
}
```

## Related

- [Model Aliases](./aliases) - Create convenient shortcuts for model names
- [Model Management](./models) - Configure model settings
- [Provider Management](./providers) - Configure providers for your models
