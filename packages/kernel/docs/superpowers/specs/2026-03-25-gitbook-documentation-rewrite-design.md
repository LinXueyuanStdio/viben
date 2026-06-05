# Viben GitBook Documentation Rewrite — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Hybrid — Audience Entry + Feature Depth (Approach C)

## Goal

Rewrite the entire Viben documentation from scratch as a GitBook-hosted site (`docs/gitbook/`), serving three user groups (end-users, developers, plugin developers) with clear learning paths. Remove all existing scattered docs except `acp-guide.md` and `superpowers/`.

## Context

### Current State (Problems)

- **25+ docs files** scattered across `docs/guide/`, `docs/specs/`, and root-level loose files
- Duplicate content: `setup-guide.md` overlaps `guide/getting-started.md`
- `refactoring-spec.md` misplaced at root level
- `specs/` overlaps with `superpowers/specs/`
- No clear learning path for different user types
- Config documentation scattered across 4+ files
- Feature docs (session persistence, streaming, etc.) exist in multiple places with unclear canonical source

### Target State

- Single `docs/gitbook/` directory with GitBook.com-compatible structure
- `SUMMARY.md` defines sidebar navigation
- 39 content pages + 8 section READMEs + 1 landing page + 1 SUMMARY.md (49 files total), organized by task (what you want to do), not audience (who you are)
- Getting Started section provides 3 entry points per audience
- All content in English (i18n planned for later)
- `docs/acp-guide.md` and `docs/superpowers/` preserved untouched
- `docs/images/` preserved temporarily (fix links later)

## Audience Definitions

### Non-Dev End Users
- Want to chat with AI agents via Telegram/Discord
- Don't install or configure Viben themselves
- Need: how to use chat commands, manage sessions, understand permissions

### Developers
- Self-host Viben on their own machine/server
- Configure bots, agents, security, daemon mode
- Need: installation, configuration reference, troubleshooting

### Plugin/Adapter Developers
- Build new adapters (e.g., WhatsApp, LINE, Web UI)
- Contribute to Viben core
- Need: ChannelAdapter interface, AdapterFactory pattern, dev setup, test conventions

## File Structure

```
docs/
├── acp-guide.md                          # KEEP
├── images/                               # KEEP (fix links later)
│   ├── agent-working.png
│   ├── menu.png
│   ├── skills.png
│   └── tool-calls.png
├── superpowers/                           # KEEP (specs + plans)
│
├── gitbook/
│   ├── README.md                         # Landing page
│   ├── SUMMARY.md                        # GitBook navigation
│   │
│   ├── getting-started/
│   │   ├── README.md
│   │   ├── what-is-viben.md
│   │   ├── for-users.md
│   │   ├── for-developers.md
│   │   └── for-contributors.md
│   │
│   ├── platform-setup/
│   │   ├── README.md
│   │   ├── telegram.md
│   │   ├── discord.md
│   │   └── slack.md
│   │
│   ├── using-viben/
│   │   ├── README.md
│   │   ├── chat-commands.md
│   │   ├── sessions.md
│   │   ├── agents.md
│   │   ├── permissions.md
│   │   ├── voice-and-speech.md
│   │   └── files-and-media.md
│   │
│   ├── self-hosting/
│   │   ├── README.md
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   ├── daemon-mode.md
│   │   ├── security.md
│   │   ├── logging.md
│   │   └── updating.md
│   │
│   ├── features/
│   │   ├── README.md
│   │   ├── tunnel.md
│   │   ├── context-resume.md
│   │   ├── usage-and-budget.md
│   │   ├── session-persistence.md
│   │   ├── session-handoff.md
│   │   ├── doctor.md
│   │   └── assistant-mode.md
│   │
│   ├── extending/
│   │   ├── README.md
│   │   ├── plugin-system.md
│   │   ├── building-adapters.md
│   │   ├── adapter-reference.md
│   │   └── contributing.md
│   │
│   ├── api-reference/
│   │   ├── README.md
│   │   ├── cli-commands.md
│   │   ├── rest-api.md
│   │   ├── configuration-schema.md
│   │   └── environment-variables.md
│   │
│   └── troubleshooting/
│       ├── README.md
│       ├── telegram-issues.md
│       ├── discord-issues.md
│       ├── slack-issues.md
│       ├── agent-issues.md
│       └── faq.md
│
├── setup-guide.md                        # DELETE
├── slack-setup.md                        # DELETE
├── refactoring-spec.md                   # DELETE
├── guide/                                # DELETE (entire directory)
└── specs/                                # DELETE (entire directory)
```

## SUMMARY.md (GitBook Navigation)

```markdown
# Table of contents

## Getting Started

* [Overview](getting-started/README.md)
* [What is Viben?](getting-started/what-is-viben.md)
* [For Users](getting-started/for-users.md)
* [For Developers](getting-started/for-developers.md)
* [For Contributors](getting-started/for-contributors.md)

## Platform Setup

* [Choose Your Platform](platform-setup/README.md)
* [Telegram](platform-setup/telegram.md)
* [Discord](platform-setup/discord.md)
* [Slack](platform-setup/slack.md)

## Using Viben

* [Overview](using-viben/README.md)
* [Chat Commands](using-viben/chat-commands.md)
* [Sessions](using-viben/sessions.md)
* [Agents](using-viben/agents.md)
* [Permissions](using-viben/permissions.md)
* [Voice & Speech](using-viben/voice-and-speech.md)
* [Files & Media](using-viben/files-and-media.md)

## Self-Hosting

* [Overview](self-hosting/README.md)
* [Installation](self-hosting/installation.md)
* [Configuration](self-hosting/configuration.md)
* [Daemon Mode](self-hosting/daemon-mode.md)
* [Security](self-hosting/security.md)
* [Logging](self-hosting/logging.md)
* [Updating](self-hosting/updating.md)

## Features

* [Overview](features/README.md)
* [Tunnel & Port Forwarding](features/tunnel.md)
* [Context Resume](features/context-resume.md)
* [Usage & Budget](features/usage-and-budget.md)
* [Session Persistence](features/session-persistence.md)
* [Session Handoff](features/session-handoff.md)
* [Doctor Diagnostics](features/doctor.md)
* [Assistant Mode](features/assistant-mode.md)

## Extending

* [Overview](extending/README.md)
* [Plugin System](extending/plugin-system.md)
* [Building Adapters](extending/building-adapters.md)
* [Adapter Reference](extending/adapter-reference.md)
* [Contributing](extending/contributing.md)

## API Reference

* [Overview](api-reference/README.md)
* [CLI Commands](api-reference/cli-commands.md)
* [REST API](api-reference/rest-api.md)
* [Configuration Schema](api-reference/configuration-schema.md)
* [Environment Variables](api-reference/environment-variables.md)

## Troubleshooting

* [Common Issues](troubleshooting/README.md)
* [Telegram Issues](troubleshooting/telegram-issues.md)
* [Discord Issues](troubleshooting/discord-issues.md)
* [Slack Issues](troubleshooting/slack-issues.md)
* [Agent Issues](troubleshooting/agent-issues.md)
* [FAQ](troubleshooting/faq.md)
```

## Content Strategy Per Page

### Getting Started (Tone: friendly, zero jargon)

| Page | Content | ~Words |
|------|---------|--------|
| `what-is-viben` | Product intro, ACP explained simply (analogy: "universal remote for AI agents"), flow diagram User→Chat→Viben→Agent, supported platforms & agents list, use cases | 300 |
| `for-users` | Prerequisite: just Telegram/Discord. Step-by-step: get invite from dev → send first message → understand response format. No terminal/config | 400 |
| `for-developers` | Prerequisites (Node 20+, npm). 5-step quickstart: install → `viben` → setup wizard → first session → verify. End-to-end in 5 minutes | 500 |
| `for-contributors` | Clone repo, pnpm install, build, run tests, project structure overview, link to extending/ | 400 |

### Platform Setup (Tone: step-by-step tutorial, screenshots-ready)

| Page | Content | ~Words |
|------|---------|--------|
| `telegram` | BotFather create bot → Supergroup + Topics → Bot admin → Chat ID → Config → Test first message. Each step numbered with expected output | 800 |
| `discord` | Dev Portal → Bot creation → Intents → OAuth2 URL → Server invite → Forum channel → Config → Test | 800 |
| `slack` | App creation → Socket Mode → Bot scopes → Event subscriptions → Config → Test | 800 |

### Using Viben (Tone: practical, task-oriented)

| Page | Content | ~Words |
|------|---------|--------|
| `chat-commands` | Table of all commands per platform (Telegram/Discord/Slack), examples | 600 |
| `sessions` | Session lifecycle (create → active → end), resume, cancel, concurrent sessions, auto-naming, timeout | 500 |
| `agents` | What are agents, browse registry, install/uninstall, switch per-session, agent list with descriptions | 600 |
| `permissions` | Why permissions exist, button flow, timeout (10min), dangerous mode, auto-approve | 400 |
| `voice-and-speech` | STT setup (Groq API key), TTS (EdgeTTS free), voice mode (off/next/on), send voice message flow | 500 |
| `files-and-media` | Send images/files/audio, supported formats, file viewer via tunnel, size limits | 400 |

### Self-Hosting (Tone: technical, precise)

| Page | Content | ~Words |
|------|---------|--------|
| `installation` | System requirements, npm install, verify, first run, data directories (~/.viben/) | 400 |
| `configuration` | Full config.json walkthrough per section, interactive config editor CLI (`viben config`), env var overrides, hot-reload, migration notes | 1000 |
| `daemon-mode` | start/stop/status/logs, PID file, autostart on boot, foreground vs background | 500 |
| `security` | allowedUserIds, maxConcurrentSessions, API auth (bearer token), sessionTimeout, best practices | 500 |
| `logging` | Log levels, file rotation, session logs, log directory, debugging tips | 400 |
| `updating` | npm update, version check, backward compatibility guarantee, automatic migrations | 300 |

### Features (Tone: explain + how-to)

| Page | Content | ~Words |
|------|---------|--------|
| `tunnel` | What/why tunnel, providers (Cloudflare/ngrok/bore/Tailscale), config, file viewer, per-user tunnels | 600 |
| `context-resume` | Resume with history, context providers (Entire.io checkpoints, git commits), checkpoint reading, adaptive modes (full/balanced/compact) | 500 |
| `usage-and-budget` | Token tracking, monthly budget, warning threshold, usage.json, CLI check | 400 |
| `session-persistence` | Sessions survive restarts, sessions.json, TTL cleanup, platform metadata | 400 |
| `session-handoff` | Transfer terminal ↔ chat, `viben integrate`, adopt flow | 400 |
| `doctor` | `viben doctor` command, what it checks, interpreting results, auto-fix | 300 |
| `assistant-mode` | What is assistant mode, how to spawn, autonomous operation | 300 |

### Extending (Tone: developer reference)

| Page | Content | ~Words |
|------|---------|--------|
| `plugin-system` | How plugins work, directory structure, install/uninstall CLI, package.json requirements | 500 |
| `building-adapters` | ChannelAdapter interface walkthrough, AdapterFactory, minimal example, event handling | 800 |
| `adapter-reference` | All methods/events with signatures, lifecycle diagram, type definitions | 600 |
| `contributing` | Dev setup, test conventions, PR process, code style | 500 |

### API Reference (Tone: dry reference, copy-paste friendly)

| Page | Content | ~Words |
|------|---------|--------|
| `cli-commands` | Every command + subcommand + flags, organized alphabetically, with examples. Includes: start, stop, status, logs, config, reset, onboard, agents (install/uninstall/info/run/refresh), install, uninstall, plugins, integrate, adopt, tunnel (add/list/stop), doctor, api, update, --version, --help | 800 |
| `rest-api` | Every endpoint: method, path, auth, request/response body, curl examples | 1000 |
| `configuration-schema` | Full JSON schema, every field with type, default, description | 800 |
| `environment-variables` | Table: var name, config equivalent, default, description | 300 |

### Troubleshooting (Tone: problem → solution)

| Page | Content | ~Words |
|------|---------|--------|
| `telegram-issues` | Common errors: bot not responding, topics not created, permission denied, rate limits | 500 |
| `discord-issues` | Intents missing, slash commands not showing, thread creation fails | 500 |
| `slack-issues` | Socket mode fails, scopes missing, rate limiting | 500 |
| `agent-issues` | Agent not found, crashes on start, dependency missing, timeout | 500 |
| `faq` | General Q&A: supported OS, multiple bots, data privacy, costs | 500 |

### Landing Page

| Page | Content | ~Words |
|------|---------|--------|
| `README.md` (root) | Product tagline, key value props (multi-agent, multi-platform, self-hosted), quick links to Getting Started for each audience (Users / Developers / Contributors), badge links (npm, license, GitHub), hero screenshot | 200 |

**Total estimated: ~20,200 words across 49 files (39 content pages + 8 section READMEs + 1 landing page + 1 SUMMARY.md).**

## Cleanup Plan

### Files to Delete

```
docs/setup-guide.md
docs/slack-setup.md
docs/refactoring-spec.md
docs/guide/                       (entire directory)
docs/specs/                       (entire directory)
```

### README.md Link Updates

```
docs/guide/getting-started.md    → docs/gitbook/getting-started/for-developers.md
docs/guide/agents.md             → docs/gitbook/using-viben/agents.md
docs/guide/usage.md              → docs/gitbook/using-viben/chat-commands.md
docs/guide/configuration.md      → docs/gitbook/self-hosting/configuration.md
docs/guide/plugins.md            → docs/gitbook/extending/plugin-system.md
docs/guide/development.md        → docs/gitbook/extending/contributing.md
docs/guide/telegram-setup.md     → docs/gitbook/platform-setup/telegram.md
docs/guide/discord-setup.md      → docs/gitbook/platform-setup/discord.md
docs/guide/tunnel.md             → docs/gitbook/features/tunnel.md
docs/guide/resume-context.md     → docs/gitbook/features/context-resume.md
```

Images in README (`docs/images/*`) keep existing paths — no move.

## Execution Order

1. Checkout branch `docs/gitbook-rewrite`
2. Create `docs/gitbook/` directory structure
3. Write `SUMMARY.md` and `README.md` (landing page)
4. Write all content files section by section (getting-started → platform-setup → using-viben → self-hosting → features → extending → api-reference → troubleshooting)
5. Delete old docs (guide/, specs/, loose files)
6. Update README.md links
7. Commit all changes

## Future Extensibility

Structure designed to accommodate planned features:

- **New adapters** (WhatsApp, LINE, Web UI): Add page in `platform-setup/`, troubleshooting entry, mention in relevant sections
- **New features** (voice improvements, context providers, budget enhancements): Add page in `features/`
- **i18n**: GitBook supports multi-language via `LANGS.md` — add `vi/` directory later
- **API changes**: Update `api-reference/` pages
- **New agent types**: Update `using-viben/agents.md`
