# Enhanced CLI Onboarding — Design Spec

## Overview

Improve the CLI onboarding experience with a gradient banner and a centralized post-upgrade dependency check that auto-installs missing binaries on every start.

## Changes

### 1. Welcome Banner

Replace the plain ASCII box with gradient ANSI Shadow text via `gradient-string`.

- Purple → blue → cyan gradient (`#a855f7` → `#6366f1` → `#3b82f6` → `#06b6d4`)
- Version number from package.json
- Tagline: "AI coding agents, anywhere."
- Respects `NO_COLOR` env var — falls back to plain text
- Only rendered in TTY (not piped output)

### 2. Post-Upgrade Dependency Check

Runs **blocking** on every start (after config load, before server start). Silent if everything is OK. This is the **single source of truth** for all dependency management — individual modules (tunnel, integrate) do NOT install deps themselves.

#### Auto-install (binary downloads to `~/.viben/bin/`):

| Binary | When needed | Source |
|--------|-------------|--------|
| cloudflared | `tunnel.enabled` + provider `cloudflare` | GitHub releases (cloudflare/cloudflared) |
| jq | Handoff integration installed | GitHub releases (jqlang/jq) |

Both installers follow the same pattern:
1. Check PATH first → found? return, no download
2. Check `~/.viben/bin/` → found? return
3. Download from GitHub releases → `~/.viben/bin/`
4. Platform support: macOS (x64/arm64), Linux (x64/arm64), Windows (x64)

#### Warn only (user must install manually):

| Dep | When needed | Message |
|-----|-------------|---------|
| ngrok/bore/tailscale | Tunnel provider selected | "Install it or switch to cloudflare" |
| unzip | Binary agent installs | "Some agent installations may fail" |
| uvx | Agent with uvx distribution installed | "pip install uv" |

#### Suggest:

| Check | Message |
|-------|---------|
| Integration not installed | `Run "viben integrate claude"` |

### 3. Module Responsibility Split

| Responsibility | Where |
|----------------|-------|
| Download/install binaries | `post-upgrade.ts` only |
| Find installed binary | Each module (e.g. `cloudflare.ts` → `findBinary()`) |
| Use binary | Each module |

`cloudflare.ts` no longer calls `ensureCloudflared()` — it uses `findBinary()` to locate the binary (checks `~/.viben/bin/` then PATH, fallback to bare command name).

Handoff hook scripts resolve jq via: `command -v jq || echo "$HOME/.viben/bin/jq"` — works whether jq is in PATH or auto-installed.

### 4. Startup Flow

```
Config loaded
  ↓
Post-upgrade checks (blocking, sequential):
  1. cloudflared auto-install (if tunnel cloudflare)
  2. Non-cloudflare tunnel provider CLI check (warn)
  3. Integration suggest (if not installed)
  4. jq auto-install (if handoff installed + jq missing)
  5. unzip check (warn)
  6. uvx check (warn if agent needs it)
  ↓
Start tunnel service (findBinary, no download)
  ↓
Start adapters
  ↓
Server ready
```

## New Dependencies

| Package | Purpose |
|---------|---------|
| `gradient-string` | Banner gradient colors |

## Files

| File | Action |
|------|--------|
| `src/core/setup.ts` | Replace banner with gradient ANSI Shadow |
| `src/core/post-upgrade.ts` | New — centralized dependency check |
| `src/core/install-jq.ts` | New — jq binary installer |
| `src/tunnel/providers/install-cloudflared.ts` | Existing — cloudflared binary installer |
| `src/tunnel/providers/cloudflare.ts` | Remove ensureCloudflared(), add findBinary() |
| `src/cli/integrate.ts` | Hook scripts resolve jq from ~/.viben/bin/ |
| `src/main.ts` | Call post-upgrade check (blocking) before server start |
| `package.json` | Add gradient-string |

## Backward Compatibility

- Users with deps already in PATH → post-upgrade skips download (checks PATH first)
- Users upgrading → deps auto-installed on first start
- Handoff scripts → `command -v jq` finds PATH jq OR `~/.viben/bin/jq`
- Banner change is visual only
- No config changes required
