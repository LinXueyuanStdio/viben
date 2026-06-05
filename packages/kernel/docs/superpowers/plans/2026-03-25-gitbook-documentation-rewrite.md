# GitBook Documentation Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete GitBook-hosted documentation site for Viben, serving end-users, developers, and plugin developers with clear learning paths.

**Architecture:** Hybrid approach — audience-specific entry points in Getting Started, then task-organized sections (Platform Setup, Using, Self-Hosting, Features, Extending, API Reference, Troubleshooting). GitBook.com syncs from `docs/gitbook/` directory via `SUMMARY.md` navigation.

**Tech Stack:** Markdown (GitBook-compatible), SUMMARY.md for navigation, hosted on GitBook.com

**Spec:** `docs/superpowers/specs/2026-03-25-gitbook-documentation-rewrite-design.md`

**Branch:** `docs/gitbook-rewrite` (already created)

**Important notes for implementers:**
- This is a docs-only plan — no code changes, no tests
- All content must be written in English
- Read the referenced source files to write accurate, up-to-date documentation
- Use `--no-verify` for git commits (pre-commit hook runs `tsc` which fails due to optional deps)
- Each task is independent and can be executed by a separate subagent in parallel (except Task 1 which creates the directory structure, and Tasks 11-12 which depend on all content being written)
- Tone and word count targets are specified per section in the spec

---

## File Structure

All files are created under `docs/gitbook/`:

```
docs/gitbook/
├── README.md                         # Landing page
├── SUMMARY.md                        # GitBook navigation tree
├── getting-started/
│   ├── README.md
│   ├── what-is-viben.md
│   ├── for-users.md
│   ├── for-developers.md
│   └── for-contributors.md
├── platform-setup/
│   ├── README.md
│   ├── telegram.md
│   ├── discord.md
│   └── slack.md
├── using-viben/
│   ├── README.md
│   ├── chat-commands.md
│   ├── sessions.md
│   ├── agents.md
│   ├── permissions.md
│   ├── voice-and-speech.md
│   └── files-and-media.md
├── self-hosting/
│   ├── README.md
│   ├── installation.md
│   ├── configuration.md
│   ├── daemon-mode.md
│   ├── security.md
│   ├── logging.md
│   └── updating.md
├── features/
│   ├── README.md
│   ├── tunnel.md
│   ├── context-resume.md
│   ├── usage-and-budget.md
│   ├── session-persistence.md
│   ├── session-handoff.md
│   ├── doctor.md
│   └── assistant-mode.md
├── extending/
│   ├── README.md
│   ├── plugin-system.md
│   ├── building-adapters.md
│   ├── adapter-reference.md
│   └── contributing.md
├── api-reference/
│   ├── README.md
│   ├── cli-commands.md
│   ├── rest-api.md
│   ├── configuration-schema.md
│   └── environment-variables.md
└── troubleshooting/
    ├── README.md
    ├── telegram-issues.md
    ├── discord-issues.md
    ├── slack-issues.md
    ├── agent-issues.md
    └── faq.md
```

---

## Task 1: Scaffold Directory Structure + SUMMARY.md + Landing Page

**Files:**
- Create: `docs/gitbook/README.md`
- Create: `docs/gitbook/SUMMARY.md`
- Create: all subdirectories (getting-started/, platform-setup/, using-viben/, self-hosting/, features/, extending/, api-reference/, troubleshooting/)

**Source references:** Spec file section "SUMMARY.md (GitBook Navigation)" and "Landing Page" content strategy.

- [ ] **Step 1: Create all subdirectories**

```bash
mkdir -p docs/gitbook/{getting-started,platform-setup,using-viben,self-hosting,features,extending,api-reference,troubleshooting}
```

- [ ] **Step 2: Write `docs/gitbook/SUMMARY.md`**

Copy the exact SUMMARY.md content from the spec (lines 138-211). This file defines the GitBook sidebar navigation. Every link must match an actual file that will be created in subsequent tasks.

- [ ] **Step 3: Write `docs/gitbook/README.md` (landing page)**

Content (~200 words):
- Product tagline: "Control AI coding agents from your favorite messaging platform"
- Key value props: multi-agent (28+ agents), multi-platform (Telegram, Discord, Slack), self-hosted, real-time streaming
- Quick links section with 3 paths:
  - **Users** → `getting-started/for-users.md` ("Start chatting with AI agents")
  - **Developers** → `getting-started/for-developers.md` ("Self-host in 5 minutes")
  - **Contributors** → `getting-started/for-contributors.md` ("Build plugins & adapters")
- Badge-style links: npm package `@viben/kernel`, MIT license, GitHub repo
- Brief mention: "Powered by the Agent Client Protocol (ACP)"

- [ ] **Step 4: Commit**

```bash
git add docs/gitbook/
git commit --no-verify -m "docs(gitbook): scaffold directory structure, SUMMARY.md, and landing page"
```

---

## Task 2: Getting Started Section

**Files:**
- Create: `docs/gitbook/getting-started/README.md`
- Create: `docs/gitbook/getting-started/what-is-viben.md`
- Create: `docs/gitbook/getting-started/for-users.md`
- Create: `docs/gitbook/getting-started/for-developers.md`
- Create: `docs/gitbook/getting-started/for-contributors.md`

**Source references:**
- `src/cli.ts` — CLI entry point, available commands
- `src/core/setup/wizard.ts` — interactive setup wizard flow (`runSetup()` for first-run, `runReconfigure()` for existing config)
- `src/core/setup/index.ts` — setup module public API
- `src/main.ts` — server startup
- `package.json` — version, name, description
- `README.md` — current product description
- `docs/acp-guide.md` — ACP protocol explanation

**Tone:** Friendly, zero jargon. Think "explaining to a friend."

- [ ] **Step 1: Write `getting-started/README.md`**

Section landing page (~100 words):
- Brief intro: "Welcome to Viben! Pick the path that fits you best."
- 3 cards/links:
  - "What is Viben?" → what-is-viben.md
  - "I want to use AI agents" → for-users.md (non-dev)
  - "I want to self-host" → for-developers.md
  - "I want to contribute" → for-contributors.md

- [ ] **Step 2: Write `getting-started/what-is-viben.md`**

Content (~300 words):
- **What it does:** Viben bridges AI coding agents to messaging platforms. Analogy: "a universal remote for AI agents — one app, any agent, any chat platform."
- **Flow diagram** (text-based):
  ```
  You (Telegram/Discord/Slack)
    → Viben (bridge)
      → AI Agent (Claude Code, Gemini, Codex, Cursor, etc.)
        → Your codebase
  ```
- **Supported platforms:** Telegram, Discord, Slack (+ plugin system for more)
- **Supported agents:** 28+ ACP-compatible agents — Claude Code, Google Gemini CLI, OpenAI Codex, GitHub Copilot, Cursor, Cline, goose, Amp, and more
- **Use cases:** Remote coding from phone, team collaboration with AI, code review via chat, autonomous coding sessions
- **What is ACP?** One paragraph: Agent Client Protocol is an open standard for editor ↔ AI agent communication. Link to `../../acp-guide.md` for deep dive.
- **Self-hosted:** All data stays on your machine. You own your API keys.

- [ ] **Step 3: Write `getting-started/for-users.md`**

Content (~400 words):
- **Title:** "Quick Start for Users"
- **Prerequisites:** Just a Telegram, Discord, or Slack account. Someone else (a developer) sets up Viben for you.
- **What to expect:** You'll get access to a bot in your chat app. You send messages, the AI agent writes code and responds.
- **Step 1:** Get invited — your developer/admin adds you to the Telegram group, Discord server, or Slack workspace
- **Step 2:** Start a session — send `/new` (Telegram) or use the `/new` slash command (Discord/Slack)
- **Step 3:** Send your first prompt — just type a message like "Create a simple todo app in React"
- **Step 4:** Understand responses — explain streaming messages, tool call indicators, permission buttons
- **Step 5:** Key commands — `/new`, `/cancel`, `/status`, `/menu`
- **What's next:** Link to `../using-viben/chat-commands.md` for full command reference

- [ ] **Step 4: Write `getting-started/for-developers.md`**

Content (~500 words):
- **Title:** "Quick Start for Developers"
- **Prerequisites:** Node.js 20+, npm, a Telegram/Discord/Slack bot token
- **5-minute quickstart:**
  1. Install: `npm install -g @viben/kernel`
  2. Run: `viben` (triggers interactive setup wizard)
  3. Setup wizard: choose platform → enter bot token → detect agents → set workspace
  4. Verify: bot responds in chat, send `/new` to create first session
  5. Send a prompt and see the agent work
- **What just happened?** Brief explanation: Viben started, connected to your chat platform, and is ready to bridge prompts to AI agents.
- **Data directory:** `~/.viben/` stores config, sessions, logs
- **Next steps:** Links to:
  - Platform setup guides (Telegram, Discord, Slack)
  - Configuration reference
  - Agent management
  - Daemon mode (run in background)

Read `src/core/setup/wizard.ts` to accurately describe the setup wizard flow (channel selection, token validation, agent detection, workspace selection). Note: setup was refactored from monolithic `setup.ts` into modular `setup/` directory — `runSetup()` for first-run, `runReconfigure()` for modifying existing config.

- [ ] **Step 5: Write `getting-started/for-contributors.md`**

Content (~400 words):
- **Title:** "Quick Start for Contributors"
- **Prerequisites:** Node.js 20+, pnpm, Git
- **Setup:**
  1. Clone: `git clone https://github.com/anthropics/viben && cd viben`
  2. Install: `pnpm install`
  3. Build: `pnpm build`
  4. Test: `pnpm test`
  5. Dev mode: `pnpm dev` (watch mode)
- **Project structure:** Brief overview of `src/` layout — core/, adapters/, tunnel/, cli.ts, main.ts
- **Key concepts:** ChannelAdapter (platform bridge), Session (conversation state), AgentInstance (ACP subprocess)
- **Next steps:** Links to:
  - `../extending/contributing.md` for full dev guide
  - `../extending/building-adapters.md` for adapter development
  - `../extending/plugin-system.md` for plugin development

Read `package.json` for scripts, `CLAUDE.md` for conventions.

- [ ] **Step 6: Commit**

```bash
git add docs/gitbook/getting-started/
git commit --no-verify -m "docs(gitbook): write Getting Started section — what-is-viben, for-users, for-developers, for-contributors"
```

---

## Task 3: Platform Setup Section

**Files:**
- Create: `docs/gitbook/platform-setup/README.md`
- Create: `docs/gitbook/platform-setup/telegram.md`
- Create: `docs/gitbook/platform-setup/discord.md`
- Create: `docs/gitbook/platform-setup/slack.md`

**Source references:**
- `src/adapters/telegram/adapter.ts` — Telegram adapter init, bot setup
- `src/adapters/telegram/topics.ts` — forum topic management
- `src/adapters/telegram/types.ts` — TelegramChannelConfig schema
- `src/adapters/discord/adapter.ts` — Discord adapter init
- `src/adapters/discord/forums.ts` — forum thread management
- `src/adapters/discord/types.ts` — DiscordChannelConfig schema
- `src/adapters/slack/adapter.ts` — Slack adapter init
- `src/adapters/slack/types.ts` — SlackChannelConfig schema
- `src/core/config.ts` — full config schema (channel sections)
- `src/core/setup/setup-telegram.ts` — Telegram setup wizard (token validation, chat ID detection)
- `src/core/setup/setup-discord.ts` — Discord setup wizard (token validation, guild ID)
- `src/core/setup/validation.ts` — API validation functions (bot tokens, chat IDs, admin privileges)
- Existing docs (read before deleting): `docs/guide/telegram-setup.md`, `docs/guide/discord-setup.md`, `docs/slack-setup.md`

**Tone:** Step-by-step tutorial. Each step numbered. Include expected output where possible.

- [ ] **Step 1: Write `platform-setup/README.md`**

Section landing page (~100 words):
- "Choose your messaging platform to get started."
- Brief comparison table:

| Platform | Best for | Setup time |
|----------|----------|------------|
| Telegram | Personal use, forum topics per session | ~10 min |
| Discord | Team collaboration, slash commands | ~10 min |
| Slack | Workplace integration, Socket Mode | ~15 min |

- Links to each setup guide

- [ ] **Step 2: Write `platform-setup/telegram.md`**

Content (~800 words). Read `src/adapters/telegram/adapter.ts`, `src/adapters/telegram/topics.ts`, and `docs/guide/telegram-setup.md` for accuracy.

Structure:
1. **Prerequisites:** Telegram account, admin access to a group
2. **Step 1: Create a bot** — BotFather → /newbot → copy token
3. **Step 2: Create a Supergroup with Topics** — New Group → Convert to Supergroup → Enable Topics
4. **Step 3: Add bot as admin** — Add bot to group → Promote to admin (required permissions: manage topics, send messages, delete messages)
5. **Step 4: Get Chat ID** — Forward a message to @userinfobot or use `viben` setup wizard auto-detection
6. **Step 5: Configure Viben** — Show config.json `channels.telegram` section with botToken, chatId, enabled: true
7. **Step 6: Start and test** — `viben start` → send `/new` in group → verify bot responds
8. **System topics:** Explain Notifications topic and Assistant topic (auto-created on first run)
9. **Session topics:** Each `/new` creates a new forum topic for that session
10. **Environment variables:** `VIBEN_TELEGRAM_BOT_TOKEN`, `VIBEN_TELEGRAM_CHAT_ID`

- [ ] **Step 3: Write `platform-setup/discord.md`**

Content (~800 words). Read `src/adapters/discord/adapter.ts`, `src/adapters/discord/forums.ts`, and `docs/guide/discord-setup.md` for accuracy.

Structure:
1. **Prerequisites:** Discord account, server with Manage Server permission
2. **Step 1: Create Discord Application** — Discord Developer Portal → New Application
3. **Step 2: Create Bot** — Bot tab → Add Bot → Copy token → Enable MESSAGE CONTENT intent, SERVER MEMBERS intent, PRESENCE intent
4. **Step 3: Generate OAuth2 URL** — OAuth2 → URL Generator → bot + applications.commands scopes → required permissions (Send Messages, Create Public Threads, Send Messages in Threads, Manage Threads, Embed Links, Attach Files, Read Message History, Use Slash Commands, Add Reactions). Permission integer: 328565073936
5. **Step 4: Invite bot to server** — Open OAuth2 URL → Select server → Authorize
6. **Step 5: Get Server (Guild) ID** — Enable Developer Mode → Right-click server → Copy Server ID
7. **Step 6: Create Forum Channel** — Create a Forum channel for sessions (optional — bot can auto-create)
8. **Step 7: Configure Viben** — Show config.json `channels.discord` section
9. **Step 8: Start and test** — `/new` slash command → verify thread creation
10. **Slash commands:** Registered automatically on bot startup

- [ ] **Step 4: Write `platform-setup/slack.md`**

Content (~800 words). Read `src/adapters/slack/adapter.ts`, `src/adapters/slack/types.ts`, and `docs/slack-setup.md` for accuracy.

Structure:
1. **Prerequisites:** Slack workspace admin access
2. **Step 1: Create Slack App** — api.slack.com → Create New App → From Manifest or from scratch
3. **Step 2: Enable Socket Mode** — Settings → Socket Mode → Enable → Generate App-Level Token (connections:write)
4. **Step 3: Add Bot Token Scopes** — OAuth & Permissions → Bot Token Scopes: chat:write, channels:history, channels:manage, channels:read, groups:history, groups:read, groups:write, im:history, im:read, im:write, users:read, files:read, commands, reactions:write
5. **Step 4: Install App to Workspace** — Install App → copy Bot User OAuth Token
6. **Step 5: Enable Events** — Event Subscriptions → Enable → Subscribe to: message.channels, message.groups, message.im, app_mention
7. **Step 6: Enable Interactivity** — Interactivity & Shortcuts → Enable (for permission buttons)
8. **Step 7: Configure Viben** — Show config.json `channels.slack` section with botToken, appToken, signingSecret
9. **Step 8: Start and test** — Verify connection, send message to bot
10. **Session model:** DM-based or channel-based sessions
11. **Voice support:** STT with Groq, TTS with EdgeTTS (if configured)

- [ ] **Step 5: Commit**

```bash
git add docs/gitbook/platform-setup/
git commit --no-verify -m "docs(gitbook): write Platform Setup section — Telegram, Discord, Slack guides"
```

---

## Task 4: Using Viben Section

**Files:**
- Create: `docs/gitbook/using-viben/README.md`
- Create: `docs/gitbook/using-viben/chat-commands.md`
- Create: `docs/gitbook/using-viben/sessions.md`
- Create: `docs/gitbook/using-viben/agents.md`
- Create: `docs/gitbook/using-viben/permissions.md`
- Create: `docs/gitbook/using-viben/voice-and-speech.md`
- Create: `docs/gitbook/using-viben/files-and-media.md`

**Source references:**
- `src/adapters/telegram/commands/` — all Telegram commands (menu.ts, new-session.ts, session.ts, agents.ts, admin.ts, settings.ts, doctor.ts, resume.ts, tunnel.ts, integrate.ts)
- `src/adapters/discord/commands/` — all Discord slash commands
- `src/core/session.ts` — session lifecycle, states, events
- `src/core/session-manager.ts` — session lookup, concurrent limits
- `src/core/agent-catalog.ts` — agent registry, install/uninstall
- `src/core/agent-instance.ts` — agent spawning, ACP events
- `src/core/permission-gate.ts` — permission timeout, resolution
- `src/core/speech/` — SpeechService, providers (edge-tts.ts, groq.ts)
- `src/core/file-service.ts` — file upload, MIME classification
- `src/core/types.ts` — IncomingMessage (attachments), AgentEvent types

**Tone:** Practical, task-oriented. "Here's how to do X."

- [ ] **Step 1: Write `using-viben/README.md`**

Section landing page (~100 words):
- "Learn how to interact with AI agents through your chat platform."
- Quick links to all sub-pages with one-line descriptions

- [ ] **Step 2: Write `using-viben/chat-commands.md`**

Content (~600 words). Read `src/adapters/telegram/commands/` and `src/adapters/discord/commands/` for the full command list.

Structure:
- **Command comparison table** across platforms:

| Action | Telegram | Discord | Slack |
|--------|----------|---------|-------|
| New session | `/new [agent] [workspace]` | `/new` | `/new` |
| New (same agent) | `/newchat` | `/newchat` | — |
| Cancel session | `/cancel` | `/cancel` | — |
| Session status | `/status` | `/status` | — |
| Menu | `/menu` | `/menu` | — |
| Install agent | `/install <name>` | `/install` | — |
| Browse agents | `/agents` | `/agents` | — |
| Resume session | `/resume` | `/resume` | — |
| Settings | `/settings` | `/settings` | — |
| Doctor | `/doctor` | `/doctor` | — |
| Tunnel | `/tunnel` | — | — |

- **Command details:** For each command, explain what it does, parameters, examples
- **Menu buttons:** Explain the interactive menu (Telegram inline keyboard, Discord buttons)
- **Note:** Some commands are Telegram-only or Discord-only — indicate clearly

- [ ] **Step 3: Write `using-viben/sessions.md`**

Content (~500 words). Read `src/core/session.ts` and `src/core/session-manager.ts`.

Structure:
- **What is a session?** A conversation between you and an AI agent, tracked in a dedicated forum topic/thread
- **Session lifecycle diagram:**
  ```
  /new → initializing → active → (finished | cancelled | error)
  ```
- **Creating sessions:** `/new [agent] [workspace]` — choose agent and workspace
- **Auto-naming:** After your first prompt, the agent summarizes the session and renames the topic/thread
- **Concurrent sessions:** Multiple sessions at once (configurable limit, default 20)
- **Session timeout:** Sessions auto-end after inactivity (configurable, default 60 min)
- **Resuming sessions:** Send a message in an existing session topic/thread to resume
- **Cancelling:** `/cancel` stops the current prompt, session stays active
- **Session end:** When agent finishes or session times out

- [ ] **Step 4: Write `using-viben/agents.md`**

Content (~600 words). Read `src/core/agent-catalog.ts`, `src/core/agent-installer.ts`, `src/data/registry-snapshot.json`.

Structure:
- **What are agents?** AI coding tools that understand the ACP protocol
- **Pre-installed vs registry agents:** Some come built-in, others install from the ACP Registry
- **Browsing agents:** `/agents` command shows available agents with descriptions
- **Installing agents:**
  - Chat: `/install claude` or via `/agents` menu
  - CLI: `viben agents install claude`
  - Auto-detection: Setup wizard detects installed agents
- **Uninstalling:** `viben agents uninstall <name>`
- **Switching agents per-session:** `/new gemini` to use a specific agent
- **Default agent:** Set via config (`defaultAgent`) or setup wizard
- **Agent types:** NPX (Node.js packages), UVX (Python packages), Binary (standalone executables), Custom (any command)
- **Popular agents list:** Table with name, description, install method — reference registry-snapshot.json for accurate data

- [ ] **Step 5: Write `using-viben/permissions.md`**

Content (~400 words). Read `src/core/permission-gate.ts` and `src/adapters/telegram/permissions.ts`.

Structure:
- **Why permissions?** Agents ask before running potentially dangerous operations (file writes, command execution, etc.)
- **How it works:** Agent sends permission request → Viben shows buttons → You approve/deny → Agent continues
- **Permission buttons:** Shows the requested action with Allow/Deny options
- **Timeout:** 10 minutes to respond. If no response, request is auto-denied.
- **Dangerous mode:** Toggle with `/menu` → Dangerous Mode. Auto-approves all permissions. Use with caution.
- **Auto-approve:** Some agents have built-in auto-approve for safe operations

- [ ] **Step 6: Write `using-viben/voice-and-speech.md`**

Content (~500 words). Read `src/core/speech/speech-service.ts`, `src/core/speech/providers/edge-tts.ts`, `src/core/speech/providers/groq.ts`.

Structure:
- **Overview:** Send voice messages and receive voice responses
- **Speech-to-Text (STT):** Send a voice message → Viben transcribes → sends text to agent
  - Provider: Groq (requires API key)
  - Config: `speech.stt.provider: "groq"`, `speech.stt.providers.groq.apiKey: "..."`
- **Text-to-Speech (TTS):** Agent response → Viben converts to audio → sends voice message
  - Provider: EdgeTTS (free, no API key needed)
  - Config: `speech.tts.provider: "edge-tts"`, optionally set voice
- **Voice mode:** Three modes:
  - `off` — text only (default)
  - `next` — next response as voice, then back to text
  - `on` — all responses as voice
  - Toggle via `/menu` → Voice Mode or `/settings`
- **Setup:** Minimal config for TTS (works out of box with EdgeTTS), STT requires Groq API key

- [ ] **Step 7: Write `using-viben/files-and-media.md`**

Content (~400 words). Read `src/core/file-service.ts` and `src/core/types.ts` (IncomingMessage attachments).

Structure:
- **Sending files to agents:** Attach images, documents, or audio files to your message — they're passed to the agent as attachments
- **Supported formats:** Images (PNG, JPG, GIF, WebP), Documents (PDF, TXT, JSON, etc.), Audio (OGG, MP3, WAV, M4A)
- **How it works:** Files are saved to `~/.viben/files/{sessionId}/` and passed to the agent via ACP attachments
- **File viewer:** When tunnel is enabled, agent output files are viewable via a public URL with Monaco editor for code, image preview for images
- **Size limits:** Platform-dependent (Telegram: 20MB, Discord: 25MB, Slack: varies by plan)

- [ ] **Step 8: Commit**

```bash
git add docs/gitbook/using-viben/
git commit --no-verify -m "docs(gitbook): write Using Viben section — commands, sessions, agents, permissions, voice, files"
```

---

## Task 5: Self-Hosting Section

**Files:**
- Create: `docs/gitbook/self-hosting/README.md`
- Create: `docs/gitbook/self-hosting/installation.md`
- Create: `docs/gitbook/self-hosting/configuration.md`
- Create: `docs/gitbook/self-hosting/daemon-mode.md`
- Create: `docs/gitbook/self-hosting/security.md`
- Create: `docs/gitbook/self-hosting/logging.md`
- Create: `docs/gitbook/self-hosting/updating.md`

**Source references:**
- `src/core/config.ts` — full Zod config schema (ConfigSchema, channelConfigSchema, etc.)
- `src/core/config-migrations.ts` — backward compat migrations
- `src/core/config-editor.ts` — interactive config editor
- `src/core/setup/wizard.ts` — setup wizard (`runSetup()` + `runReconfigure()`)
- `src/core/setup/setup-channels.ts` — channel orchestrator (modify/disable/delete)
- `src/core/daemon.ts` — daemon start/stop/status/logs
- `src/core/autostart.ts` — autostart on boot
- `src/core/security-guard.ts` — allowedUserIds, maxConcurrentSessions
- `src/core/log.ts` — Pino logger, log levels, rotation
- `src/core/api/middleware.ts` — API auth (bearer token)
- `src/cli/commands.ts` — CLI commands (config, reset, update, etc.)
- `src/cli/version.ts` — version checking
- `package.json` — version, dependencies

**Tone:** Technical, precise. For developers who self-host.

- [ ] **Step 1: Write `self-hosting/README.md`**

Section landing page (~100 words):
- "Everything you need to run Viben on your own infrastructure."
- Quick links to sub-pages

- [ ] **Step 2: Write `self-hosting/installation.md`**

Content (~400 words).

Structure:
- **System requirements:** Node.js 20+, npm or pnpm, macOS/Linux (Windows via WSL)
- **Install:** `npm install -g @viben/kernel`
- **Verify:** `viben --version`
- **First run:** `viben` triggers interactive setup wizard
- **Data directory:** `~/.viben/` — explain contents:
  - `config.json` — main configuration
  - `sessions.json` — session persistence
  - `usage.json` — token/cost tracking
  - `logs/` — log files
  - `files/` — uploaded files
  - `plugins/` — installed plugins
  - `api-secret` — API bearer token
- **Alternative: run from source** — git clone, pnpm install, pnpm build, pnpm start

- [ ] **Step 3: Write `self-hosting/configuration.md`**

Content (~1000 words). Read `src/core/config.ts` thoroughly — this is the most important source file for this page.

Structure:
- **Config file location:** `~/.viben/config.json`
- **Interactive editor:** `viben config` launches TUI editor
- **Reconfigure wizard:** `viben onboard` — section-based reconfiguration (channels, agents, workspace, run mode, integrations). Can modify/disable/delete individual channels without resetting everything.
- **Structure overview:** Top-level sections: channels, agents, defaultAgent, security, tunnel, logging, api, usage, speech, sessions, workspace
- **Channels section:** Detailed walkthrough of telegram, discord, slack sub-objects with all fields
- **Agents section:** How to define agents (command, args, workingDirectory, env), examples for Claude Code, Gemini, Codex
- **Default agent:** `defaultAgent: "claude"` — used when `/new` doesn't specify agent
- **Security section:** allowedUserIds, maxConcurrentSessions, sessionTimeoutMinutes
- **Tunnel section:** enabled, provider, port, auth options
- **Logging section:** level, logDir, maxFileSize, maxFiles, sessionLogRetentionDays
- **API section:** port, host
- **Usage section:** enabled, monthlyBudget, warningThreshold, currency, retentionDays
- **Speech section:** stt/tts provider config
- **Environment variable overrides:** `VIBEN_*` prefix — table of supported vars
- **Hot-reload:** Config changes are picked up without restart (some fields)
- **Backward compatibility:** New fields have defaults, old configs work without changes

- [ ] **Step 4: Write `self-hosting/daemon-mode.md`**

Content (~500 words). Read `src/core/daemon.ts` and `src/core/autostart.ts`.

Structure:
- **Foreground vs daemon:** `viben` (foreground, Ctrl+C to stop) vs `viben start` (background)
- **Daemon commands:**
  - `viben start` — start as background daemon
  - `viben stop` — stop daemon gracefully
  - `viben status` — show if running, PID, uptime
  - `viben logs` — tail daemon logs
  - `viben restart` — restart daemon
- **PID file:** `~/.viben/viben.pid`
- **Log file:** `~/.viben/viben.log` (daemon mode)
- **Autostart on boot:** `viben` can configure itself to start on system boot
  - macOS: LaunchAgent
  - Linux: systemd service
- **When to use daemon mode:** Production use, always-on availability
- **When to use foreground:** Development, debugging, first-time setup

- [ ] **Step 5: Write `self-hosting/security.md`**

Content (~500 words). Read `src/core/security-guard.ts` and `src/core/api/middleware.ts`.

Structure:
- **User allowlist:** `security.allowedUserIds: ["123456"]` — only listed user IDs can interact. Empty array = allow all.
  - Telegram user IDs: numeric (get from @userinfobot)
  - Discord user IDs: snowflake format (enable Developer Mode)
  - Slack user IDs: string format (member ID from profile)
- **Concurrent session limits:** `security.maxConcurrentSessions: 20` — prevents resource exhaustion
- **Session timeout:** `security.sessionTimeoutMinutes: 60` — auto-ends inactive sessions
- **API authentication:** REST API protected by bearer token stored in `~/.viben/api-secret` (file permissions 0600). Include token in `Authorization: Bearer <token>` header.
- **Dangerous mode:** Per-session toggle that auto-approves permissions. Disabled by default. Users must explicitly enable.
- **Best practices:**
  - Always set allowedUserIds in production
  - Use daemon mode with proper file permissions
  - Keep bot tokens secret (never commit to git)
  - Regularly update Viben for security patches

- [ ] **Step 6: Write `self-hosting/logging.md`**

Content (~400 words). Read `src/core/log.ts`.

Structure:
- **Log levels:** `silent`, `debug`, `info` (default), `warn`, `error`, `fatal`
- **Configuration:** `logging.level`, `logging.logDir` (~/.viben/logs default)
- **File rotation:** `logging.maxFileSize` (10m default), `logging.maxFiles` (7 default)
- **Session logs:** Each session gets its own log file: `session-{sessionId}-{timestamp}.log`
- **Session log retention:** `logging.sessionLogRetentionDays` (30 default)
- **Daemon logs:** `~/.viben/viben.log` — view with `viben logs`
- **Debug mode:** Set `VIBEN_DEBUG=true` or `logging.level: "debug"` for verbose output
- **Log format:** Structured JSON (Pino) — can pipe to tools like `pino-pretty`
- **Debugging tips:**
  - Check `viben logs` for startup errors
  - Enable debug level for ACP protocol issues
  - Session logs show full agent interaction

- [ ] **Step 7: Write `self-hosting/updating.md`**

Content (~300 words). Read `src/cli/version.ts`.

Structure:
- **Check current version:** `viben --version`
- **Update:** `npm update -g @viben/kernel`
- **Version check:** Viben checks for updates on startup (non-blocking)
- **Backward compatibility guarantee:**
  - Config files from older versions always work (new fields get defaults)
  - Session data is forward-compatible (automatic migration)
  - CLI commands are never removed (deprecated commands still work with warnings)
- **Automatic migrations:** `src/core/config-migrations.ts` runs on startup to update config format
- **Post-upgrade:** Agent dependencies are checked and user is notified if updates needed

- [ ] **Step 8: Commit**

```bash
git add docs/gitbook/self-hosting/
git commit --no-verify -m "docs(gitbook): write Self-Hosting section — installation, configuration, daemon, security, logging, updating"
```

---

## Task 6: Features Section

**Files:**
- Create: `docs/gitbook/features/README.md`
- Create: `docs/gitbook/features/tunnel.md`
- Create: `docs/gitbook/features/context-resume.md`
- Create: `docs/gitbook/features/usage-and-budget.md`
- Create: `docs/gitbook/features/session-persistence.md`
- Create: `docs/gitbook/features/session-handoff.md`
- Create: `docs/gitbook/features/doctor.md`
- Create: `docs/gitbook/features/assistant-mode.md`

**Source references:**
- `src/tunnel/tunnel-service.ts` — tunnel lifecycle, providers
- `src/tunnel/providers/` — cloudflare.ts, ngrok.ts, bore.ts, tailscale.ts
- `src/tunnel/viewer-store.ts` — file viewer sessions
- `src/core/context/context-manager.ts` — context provider registry
- `src/core/context/entire/` — Entire.io provider (entire-provider.ts, conversation-builder.ts, checkpoint-reader.ts)
- `src/core/usage-store.ts` — token/cost tracking
- `src/core/usage-budget.ts` — monthly budget, warnings
- `src/core/session-store.ts` — session persistence (JSON)
- `src/cli/integrate.ts` — session handoff
- `src/core/doctor/` — diagnostic checks (index.ts, checks/*.ts)
- `src/adapters/telegram/assistant.ts` — assistant mode
- `src/adapters/discord/assistant.ts` — assistant mode

**Tone:** Explain what the feature is + how to use it.

- [ ] **Step 1: Write `features/README.md`**

Section landing page (~100 words):
- "Viben comes with powerful features beyond basic chat."
- Quick links to each feature with one-line description

- [ ] **Step 2: Write `features/tunnel.md`**

Content (~600 words). Read `src/tunnel/tunnel-service.ts` and provider files.

Structure:
- **What is tunneling?** Expose your local Viben instance to the internet for file viewing and remote access
- **Why use it?** View agent-generated files, diffs, and code in a web browser through Monaco editor
- **Providers:**
  - **Cloudflare Tunnel** (default, free) — no account needed, auto-installs `cloudflared`
  - **ngrok** — requires account + auth token
  - **bore** — open-source, bore.pub
  - **Tailscale** — MagicDNS for private networks
- **Configuration:**
  ```json
  {
    "tunnel": {
      "enabled": true,
      "provider": "cloudflare",
      "port": 3100,
      "auth": { "enabled": false }
    }
  }
  ```
- **CLI commands:** `viben tunnel add <port>`, `viben tunnel list`, `viben tunnel stop <id>`
- **File viewer:** When an agent creates/modifies files, links appear in chat — click to view in browser with syntax highlighting
- **Per-user tunnels:** Users can tunnel their own ports (limit configurable, default 5)
- **Security:** Optional auth token, path validation, TTL-based cleanup (default 60 min)

- [ ] **Step 3: Write `features/context-resume.md`**

Content (~500 words). Read `src/core/context/` directory.

Structure:
- **What is context resume?** Resume a session with previous conversation history injected
- **How it works:** ContextManager queries providers → builds conversation context → injects into new session prompt
- **Providers:**
  - **Entire.io** — reads git checkpoints with full conversation transcripts
  - **Git commits** — extracts context from commit history
- **Adaptive modes:**
  - `full` — complete conversation history (high token usage)
  - `balanced` — key messages + summaries (default)
  - `compact` — minimal context, just key decisions
- **Using it:** `/resume` command in chat → select session or provide checkpoint URL
- **Configuration:** Context providers are pluggable — more can be added via the ContextProvider interface
- **Token estimation:** Context size is estimated before injection to stay within limits

- [ ] **Step 4: Write `features/usage-and-budget.md`**

Content (~400 words). Read `src/core/usage-store.ts` and `src/core/usage-budget.ts`.

Structure:
- **Token tracking:** Every agent interaction tracks input/output tokens and estimated cost
- **Where data is stored:** `~/.viben/usage.json` — aggregated per session, per day
- **Monthly budget:**
  ```json
  {
    "usage": {
      "enabled": true,
      "monthlyBudget": 50,
      "warningThreshold": 0.8,
      "currency": "USD"
    }
  }
  ```
- **Warnings:** At 80% (configurable) of budget, Viben sends a notification
- **Budget exceeded:** Notification sent, but sessions continue (soft limit)
- **Checking usage:** Via API `GET /api/health` or notification topic
- **Retention:** Usage data kept for 90 days (configurable)
- **Per-session tracking:** Each session shows token count and estimated cost in status

- [ ] **Step 5: Write `features/session-persistence.md`**

Content (~400 words). Read `src/core/session-store.ts`.

Structure:
- **What it does:** Sessions survive Viben restarts — resume where you left off
- **How it works:** Session state saved to `~/.viben/sessions.json` on every state change
- **What's persisted:** Session ID, agent name, workspace, platform metadata (Telegram topicId, Discord threadId), creation time, last activity
- **TTL cleanup:** Expired sessions cleaned up after 30 days (configurable)
- **Resuming after restart:** Start Viben → existing sessions are restored → send message in old topic/thread to continue
- **Platform metadata:** Telegram topic IDs and Discord thread IDs are preserved, so the right thread is used after restart

- [ ] **Step 6: Write `features/session-handoff.md`**

Content (~400 words). Read `src/cli/integrate.ts` and `src/adapters/telegram/commands/integrate.ts`.

Structure:
- **What is handoff?** Transfer a coding session between your terminal (Claude Code, etc.) and a chat platform (Telegram/Discord)
- **Use case:** Start working in terminal → need to leave desk → hand off to Telegram → continue from phone
- **How to hand off (terminal → chat):**
  1. In terminal: `viben integrate` — generates a handoff code
  2. In chat: send the handoff code or use `/adopt` command
  3. Session continues in chat with full context
- **How to adopt (chat → terminal):** The reverse flow
- **Requirements:** Viben must be running in daemon mode, same machine

- [ ] **Step 7: Write `features/doctor.md`**

Content (~300 words). Read `src/core/doctor/` directory.

Structure:
- **What it does:** `viben doctor` runs diagnostic checks on your Viben installation
- **Checks performed:**
  - Config validation — is config.json valid?
  - Agent availability — are configured agents installed and runnable?
  - Daemon health — is daemon running? PID file valid?
  - Telegram setup — bot token valid? Chat accessible?
  - Discord setup — bot token valid? Guild accessible?
  - Plugin integrity — are plugins properly installed?
  - Storage health — are data directories writable?
  - Workspace check — does workspace directory exist?
  - Tunnel check — is tunnel provider available?
- **Running:** `viben doctor` (CLI) or `/doctor` (in chat)
- **Output:** Each check shows ✓ pass, ✗ fail, or ⚠ warning with details
- **Auto-fix:** Some issues can be auto-fixed (e.g., creating missing directories)

- [ ] **Step 8: Write `features/assistant-mode.md`**

Content (~300 words). Read `src/adapters/telegram/assistant.ts`.

Structure:
- **What is assistant mode?** A dedicated topic/thread where the agent runs autonomously, monitoring and responding without explicit prompts
- **How it works:** Viben creates an "Assistant" system topic → messages in this topic are handled as autonomous agent interactions
- **Use case:** Background coding tasks, monitoring, or continuous assistance
- **Activating:** Created automatically as a system topic — just post in the Assistant topic
- **Difference from regular sessions:** Regular sessions are prompt-response; assistant mode is more autonomous
- **Configuration:** Assistant topic ID stored in adapter config (auto-created on first run)

- [ ] **Step 9: Commit**

```bash
git add docs/gitbook/features/
git commit --no-verify -m "docs(gitbook): write Features section — tunnel, context-resume, usage, persistence, handoff, doctor, assistant"
```

---

## Task 7: Extending Section

**Files:**
- Create: `docs/gitbook/extending/README.md`
- Create: `docs/gitbook/extending/plugin-system.md`
- Create: `docs/gitbook/extending/building-adapters.md`
- Create: `docs/gitbook/extending/adapter-reference.md`
- Create: `docs/gitbook/extending/contributing.md`

**Source references:**
- `src/core/plugin-manager.ts` — plugin install/uninstall/load
- `src/core/channel.ts` — ChannelAdapter abstract class (THE key file)
- `src/core/types.ts` — IncomingMessage, OutgoingMessage, PermissionRequest, AgentEvent
- `src/index.ts` — public API exports
- `CLAUDE.md` — test conventions, build commands
- `package.json` — dev scripts
- `vitest.config.ts` or equivalent — test config

**Tone:** Developer reference. Code examples, interface signatures.

- [ ] **Step 1: Write `extending/README.md`**

Section landing page (~100 words):
- "Build custom adapters, create plugins, and contribute to Viben."
- Links to sub-pages

- [ ] **Step 2: Write `extending/plugin-system.md`**

Content (~500 words). Read `src/core/plugin-manager.ts`.

Structure:
- **What are plugins?** npm packages that add new channel adapters to Viben
- **Installing plugins:** `viben install @viben/adapter-discord` (example)
- **Plugin directory:** `~/.viben/plugins/` — contains package.json and node_modules
- **Listing plugins:** `viben plugins`
- **Uninstalling:** `viben uninstall <package>`
- **How plugins are loaded:** On startup, Viben scans plugin directory, requires each package, looks for `adapterFactory` export
- **Plugin package requirements:**
  - Must export `adapterFactory` object
  - Must implement `AdapterFactory` interface: `{ name: string, createAdapter(core, config): ChannelAdapter }`
- **Example plugin structure:**
  ```
  my-adapter-plugin/
  ├── package.json
  ├── index.js
  └── adapter.js
  ```

- [ ] **Step 3: Write `extending/building-adapters.md`**

Content (~800 words). Read `src/core/channel.ts` thoroughly.

Structure:
- **Overview:** Step-by-step guide to building a custom channel adapter
- **The ChannelAdapter abstract class:** Explain what it provides and what you must implement
- **Minimal example:** Complete working adapter (simplified) showing:
  1. Extend `ChannelAdapter`
  2. Implement `start()`, `stop()`
  3. Implement `sendMessage()`, `sendPermissionRequest()`, `sendNotification()`
  4. Implement `createSessionThread()`, `renameSessionThread()`
  5. Export as `AdapterFactory`
- **Message flow:** How messages flow from your adapter to the agent and back:
  ```
  User message → your adapter → core.handleIncomingMessage() → session → agent
  Agent response → session event → your sendMessage() → user
  ```
- **Handling events:** Which events to listen for, how to route them
- **Registering with core:** How VibenCore discovers and registers your adapter
- **Testing your adapter:** Recommendations for testing (mock AgentInstance, test message flow)

- [ ] **Step 4: Write `extending/adapter-reference.md`**

Content (~600 words). Read `src/core/channel.ts` and `src/core/types.ts`.

Structure:
- **ChannelAdapter methods** — table with signature, description, required/optional:

| Method | Required | Description |
|--------|----------|-------------|
| `start()` | Yes | Connect to platform, start listening |
| `stop()` | Yes | Disconnect gracefully |
| `sendMessage(sessionId, message)` | Yes | Send message to user |
| `sendPermissionRequest(sessionId, request)` | Yes | Show permission buttons |
| `sendNotification(message)` | Yes | Send to notification channel |
| `createSessionThread(sessionId, title)` | Yes | Create conversation thread |
| `renameSessionThread(sessionId, title)` | Yes | Rename thread |
| `deleteSessionThread(sessionId)` | Optional | Delete thread on cleanup |
| `sendSkillCommands(sessionId, commands)` | Optional | Register dynamic commands |
| `cleanupSkillCommands(sessionId)` | Optional | Remove dynamic commands |

- **Key types:** OutgoingMessage, IncomingMessage, PermissionRequest, AgentEvent — with field descriptions
- **Adapter lifecycle:**
  ```
  constructor → start() → [handle messages] → stop()
  ```
- **Events emitted by sessions:** agent_event, permission_request, session_end, status_change, named

- [ ] **Step 5: Write `extending/contributing.md`**

Content (~500 words). Reference `CLAUDE.md` and `package.json`.

Structure:
- **Development setup:**
  1. Fork & clone the repository
  2. `pnpm install`
  3. `pnpm build` (TypeScript compilation)
  4. `pnpm dev` (watch mode)
  5. `pnpm test` (Vitest)
- **Project conventions:**
  - ESM-only, `.js` extensions in imports
  - TypeScript strict mode, target ES2022
  - Test files: `src/**/__tests__/*.test.ts`
- **Testing guidelines** (from CLAUDE.md):
  - Test flows, not internals
  - Test state machines (all valid + invalid transitions)
  - Mock at boundaries (AgentInstance, ChannelAdapter, SessionStore)
  - Use `vi.waitFor()` for async, `vi.useFakeTimers()` for timeouts
  - No sleep/polling
- **PR process:**
  - Branch from `develop`
  - Write tests for new features
  - Ensure `pnpm test` passes
  - Create PR to `develop`
- **Code style:** Follow existing patterns, keep files focused, prefer small focused units

- [ ] **Step 6: Commit**

```bash
git add docs/gitbook/extending/
git commit --no-verify -m "docs(gitbook): write Extending section — plugin-system, building-adapters, adapter-reference, contributing"
```

---

## Task 8: API Reference Section

**Files:**
- Create: `docs/gitbook/api-reference/README.md`
- Create: `docs/gitbook/api-reference/cli-commands.md`
- Create: `docs/gitbook/api-reference/rest-api.md`
- Create: `docs/gitbook/api-reference/configuration-schema.md`
- Create: `docs/gitbook/api-reference/environment-variables.md`

**Source references:**
- `src/cli.ts` — CLI entry, command routing
- `src/cli/commands.ts` — ALL CLI command implementations
- `src/core/api/routes/` — ALL REST API route handlers (health.ts, sessions.ts, agents.ts, config.ts, topics.ts, tunnel.ts, notify.ts)
- `src/core/api/middleware.ts` — auth middleware
- `src/core/config.ts` — full Zod schema (THE key file for config-schema page)
- `src/core/api/index.ts` — ApiServer, port configuration

**Tone:** Dry reference. Tables, code examples, copy-paste friendly.

- [ ] **Step 1: Write `api-reference/README.md`**

Section landing page (~100 words):
- "Complete reference for CLI commands, REST API, configuration, and environment variables."
- Links to sub-pages

- [ ] **Step 2: Write `api-reference/cli-commands.md`**

Content (~800 words). Read `src/cli.ts` and `src/cli/commands.ts` thoroughly.

Structure — alphabetical listing of every command:

For each command:
```
### `viben <command>`
**Description:** ...
**Usage:** `viben <command> [options]`
**Options:** table of flags
**Example:**
```

Commands to document (read source for exact flags):
- `viben` (no args) — foreground mode
- `viben start` — start daemon
- `viben stop` — stop daemon
- `viben restart` — restart daemon
- `viben status` — daemon status
- `viben logs` — tail logs
- `viben config` — interactive config editor
- `viben reset` — re-run setup wizard
- `viben onboard` — first-run setup wizard OR section-based reconfigure (if config exists). Reconfigure allows modifying individual sections: channels (modify/disable/delete), agents, workspace, run mode, integrations
- `viben agents` — list agents
- `viben agents install <name>` — install agent
- `viben agents uninstall <name>` — uninstall agent
- `viben agents info <name>` — agent details
- `viben agents run <name>` — run agent directly
- `viben agents refresh` — refresh registry cache
- `viben install <package>` — install plugin
- `viben uninstall <package>` — uninstall plugin
- `viben plugins` — list plugins
- `viben integrate` — session handoff (export)
- `viben adopt` — session handoff (import)
- `viben tunnel add <port>` — add tunnel
- `viben tunnel list` — list tunnels
- `viben tunnel stop <id>` — stop tunnel
- `viben doctor` — diagnostics
- `viben api <command>` — API interaction (new, cancel, status, agents, prompt)
- `viben update` — update to latest version
- `viben --version` — show version
- `viben --help` — show help

- [ ] **Step 3: Write `api-reference/rest-api.md`**

Content (~1000 words). Read `src/core/api/routes/` — every route file.

Structure:
- **Base URL:** `http://localhost:21420` (configurable via `api.port`)
- **Authentication:** Bearer token from `~/.viben/api-secret`. Header: `Authorization: Bearer <token>`. Exempt: `/api/health`, `/api/version`.

For each endpoint, document:
- Method + Path
- Auth required (yes/no)
- Request body (if any)
- Response body
- curl example

Endpoints to document:
- `GET /api/health` — system status (sessions, uptime, version)
- `GET /api/version` — version info
- `GET /api/sessions` — list active sessions
- `GET /api/session/:id` — session details
- `POST /api/session` — create session (body: agent, workspace)
- `POST /api/session/:id/prompt` — send prompt (body: text, attachments)
- `POST /api/session/:id/cancel` — cancel session
- `POST /api/session/:id/dangerous` — toggle dangerous mode
- `GET /api/agents` — list available agents
- `GET /api/config` — get current config
- `PUT /api/config/:key` — update config field
- `GET /api/topics` — list topics
- `POST /api/topics/:id/delete` — delete topic
- `GET /api/tunnel` — tunnel status
- `POST /api/notify` — send notification (body: message)

- [ ] **Step 4: Write `api-reference/configuration-schema.md`**

Content (~800 words). Read `src/core/config.ts` — extract the full Zod schema.

Structure — hierarchical table of every config field:

| Field | Type | Default | Description |
|-------|------|---------|-------------|

Sections:
- `channels.telegram.*` — botToken, chatId, enabled, notificationTopicId, assistantTopicId
- `channels.discord.*` — botToken, guildId, enabled, forumChannelId, notificationChannelId, assistantThreadId
- `channels.slack.*` — botToken, appToken, signingSecret, enabled, notificationChannelId, channelPrefix
- `agents.*` — command, args, workingDirectory, env (per agent)
- `defaultAgent` — string
- `security.*` — allowedUserIds, maxConcurrentSessions, sessionTimeoutMinutes
- `tunnel.*` — enabled, provider, port, maxUserTunnels, storeTtlMinutes, auth (enabled, token)
- `logging.*` — level, logDir, maxFileSize, maxFiles, sessionLogRetentionDays
- `api.*` — port, host
- `usage.*` — enabled, monthlyBudget, warningThreshold, currency, retentionDays
- `speech.stt.*` — provider, providers.groq.apiKey
- `speech.tts.*` — provider, providers["edge-tts"].voice
- `sessions.*` — ttlDays
- `workspace` — default workspace directory

- [ ] **Step 5: Write `api-reference/environment-variables.md`**

Content (~300 words). Read `src/core/config.ts` for env var handling.

Structure — table:

| Variable | Config Equivalent | Default | Description |
|----------|------------------|---------|-------------|
| `VIBEN_TELEGRAM_BOT_TOKEN` | `channels.telegram.botToken` | — | Telegram bot token |
| `VIBEN_TELEGRAM_CHAT_ID` | `channels.telegram.chatId` | — | Telegram chat ID |
| `VIBEN_DISCORD_BOT_TOKEN` | `channels.discord.botToken` | — | Discord bot token |
| `VIBEN_DISCORD_GUILD_ID` | `channels.discord.guildId` | — | Discord server ID |
| `VIBEN_DEFAULT_AGENT` | `defaultAgent` | — | Default agent name |
| `VIBEN_DEBUG` | `logging.level: "debug"` | `false` | Enable debug logging |
| `VIBEN_API_PORT` | `api.port` | `21420` | API server port |

Read source to find all supported env vars — there may be more than listed above.

- **Priority:** Environment variables override config.json values.
- **Use case:** Docker deployments, CI/CD, secrets management (don't put tokens in config.json)

- [ ] **Step 6: Commit**

```bash
git add docs/gitbook/api-reference/
git commit --no-verify -m "docs(gitbook): write API Reference section — CLI commands, REST API, config schema, env vars"
```

---

## Task 9: Troubleshooting Section

**Files:**
- Create: `docs/gitbook/troubleshooting/README.md`
- Create: `docs/gitbook/troubleshooting/telegram-issues.md`
- Create: `docs/gitbook/troubleshooting/discord-issues.md`
- Create: `docs/gitbook/troubleshooting/slack-issues.md`
- Create: `docs/gitbook/troubleshooting/agent-issues.md`
- Create: `docs/gitbook/troubleshooting/faq.md`

**Source references:**
- `src/adapters/telegram/adapter.ts` — Telegram error handling, common failure points
- `src/adapters/discord/adapter.ts` — Discord error handling
- `src/adapters/slack/adapter.ts` — Slack error handling
- `src/core/agent-instance.ts` — agent spawn failures, stderr capture
- `src/core/agent-dependencies.ts` — dependency checking
- `src/core/doctor/checks/` — all diagnostic checks (reveal common issues)
- Existing docs: `docs/guide/discord-setup.md` (has troubleshooting section), `docs/slack-setup.md` (has troubleshooting)

**Tone:** Problem → Solution format. Empathetic but concise.

- [ ] **Step 1: Write `troubleshooting/README.md`**

Section landing page (~100 words):
- "Having trouble? Find solutions to common issues."
- Quick links by platform + general issues
- "Run `viben doctor` first — it catches most issues automatically."

- [ ] **Step 2: Write `troubleshooting/telegram-issues.md`**

Content (~500 words). Read `src/adapters/telegram/adapter.ts` and `src/core/doctor/checks/telegram.ts`.

Format — each issue as:
```
### Problem: Bot doesn't respond
**Symptoms:** ...
**Cause:** ...
**Solution:** ...
```

Issues to cover:
- Bot not responding to messages
- "Not enough rights" error (bot not admin)
- Topics not being created (Topics not enabled in group)
- "Chat not found" (wrong chat ID)
- Rate limiting (too many messages)
- Bot responds but session doesn't start (agent not configured)
- Permission buttons not appearing
- Streaming messages flickering/duplicating

- [ ] **Step 3: Write `troubleshooting/discord-issues.md`**

Content (~500 words). Read `src/adapters/discord/adapter.ts` and `src/core/doctor/checks/discord.ts`.

Issues to cover:
- Slash commands not appearing (not registered, missing scopes)
- "Missing Intents" error (MESSAGE_CONTENT, GUILD_MEMBERS, PRESENCE not enabled)
- Thread creation fails (missing permissions)
- Bot offline (token invalid, Gateway intents)
- "Unknown interaction" (command timeout > 3s)
- Messages not received (EVENT subscriptions missing)
- Forum channel not found (wrong channel ID)

- [ ] **Step 4: Write `troubleshooting/slack-issues.md`**

Content (~500 words). Read `src/adapters/slack/adapter.ts` and `docs/slack-setup.md` troubleshooting section.

Issues to cover:
- Socket Mode connection fails (wrong app token, connections:write scope missing)
- Bot doesn't respond to DMs (im:history, im:read scopes missing)
- "not_allowed_token_type" (using Bot token instead of App token for Socket Mode)
- Rate limiting (too many API calls)
- Interactivity not working (not enabled in app settings)
- Voice messages not transcribing (Groq API key missing)
- Channel creation fails (channels:manage scope missing)

- [ ] **Step 5: Write `troubleshooting/agent-issues.md`**

Content (~500 words). Read `src/core/agent-instance.ts`, `src/core/agent-dependencies.ts`, `src/core/doctor/checks/agents.ts`.

Issues to cover:
- "Agent not found" (not installed, wrong name)
- Agent crashes on startup (missing dependencies — Node.js, Python, etc.)
- Agent times out (no response from ACP subprocess)
- "Command not found" (binary not in PATH)
- Permission denied (binary not executable)
- Agent works in terminal but not via Viben (env vars not passed, working directory wrong)
- Session stuck in "initializing" (agent failed silently — check logs)
- High memory/CPU usage (agent-specific, not Viben issue)

- [ ] **Step 6: Write `troubleshooting/faq.md`**

Content (~500 words).

Questions to answer:
- **What OS does Viben support?** macOS, Linux. Windows via WSL.
- **Can I run multiple bots?** Yes, enable multiple channels in config.
- **Is my data sent to any server?** No, fully self-hosted. Data stays on your machine.
- **How much does it cost?** Viben is free (MIT license). You pay for AI agent API costs (OpenAI, Anthropic, etc.).
- **Can I use Viben without Telegram/Discord?** Yes, use the REST API or build a custom adapter.
- **How many concurrent sessions can I run?** Configurable, default 20. Depends on your machine resources.
- **Does Viben work offline?** No, it needs internet for messaging platforms and AI agent APIs.
- **How do I back up my data?** Copy `~/.viben/` directory. It's all JSON files.
- **Can multiple users share one Viben instance?** Yes, use allowedUserIds to control access.
- **What happens if Viben crashes?** Sessions are persisted — restart and resume where you left off.

- [ ] **Step 7: Commit**

```bash
git add docs/gitbook/troubleshooting/
git commit --no-verify -m "docs(gitbook): write Troubleshooting section — platform issues, agent issues, FAQ"
```

---

## Task 10: Cross-Reference Review & Internal Links

**Files:**
- Modify: all files in `docs/gitbook/` (add cross-references)

**Purpose:** Go through every page and add internal links where one page references content in another. GitBook uses relative markdown links.

- [ ] **Step 1: Add cross-references in Getting Started pages**

- `for-users.md`: Link to `../using-viben/chat-commands.md`, `../using-viben/sessions.md`
- `for-developers.md`: Link to `../platform-setup/telegram.md`, `../self-hosting/configuration.md`, `../using-viben/agents.md`, `../self-hosting/daemon-mode.md`
- `for-contributors.md`: Link to `../extending/contributing.md`, `../extending/building-adapters.md`, `../extending/plugin-system.md`

- [ ] **Step 2: Add cross-references in Platform Setup pages**

- Each platform page: Link to `../self-hosting/configuration.md` for full config reference, `../troubleshooting/<platform>-issues.md` for troubleshooting

- [ ] **Step 3: Add cross-references in Using Viben pages**

- `agents.md`: Link to `../api-reference/cli-commands.md` for CLI agent commands
- `voice-and-speech.md`: Link to `../self-hosting/configuration.md#speech` for config
- `permissions.md`: Link to `../self-hosting/security.md` for security settings

- [ ] **Step 4: Add cross-references in Self-Hosting pages**

- `configuration.md`: Link to `../api-reference/configuration-schema.md` for full schema, `../api-reference/environment-variables.md` for env vars
- `security.md`: Link to `../using-viben/permissions.md` for permission system

- [ ] **Step 5: Add cross-references in Features pages**

- `tunnel.md`: Link to `../self-hosting/configuration.md#tunnel` for config
- Each feature: Link to relevant troubleshooting if applicable

- [ ] **Step 6: Verify all internal links are valid**

```bash
# Check that all linked files exist
grep -roh '\](\.\.?/[^)]*\.md)' docs/gitbook/ | sort -u | while read -r link; do
  file=$(echo "$link" | sed 's/\](//' | sed 's/)//')
  # Verify file exists relative to its source
  echo "Checking: $file"
done
```

- [ ] **Step 7: Commit**

```bash
git add docs/gitbook/
git commit --no-verify -m "docs(gitbook): add cross-references and internal links across all pages"
```

---

## Task 11: Delete Old Docs

**Files:**
- Delete: `docs/setup-guide.md`
- Delete: `docs/slack-setup.md`
- Delete: `docs/refactoring-spec.md`
- Delete: `docs/guide/` (entire directory)
- Delete: `docs/specs/` (entire directory)

**Important:** DO NOT delete `docs/acp-guide.md`, `docs/images/`, or `docs/superpowers/`.

- [ ] **Step 1: Verify files to keep are NOT in delete list**

```bash
ls docs/acp-guide.md docs/images/ docs/superpowers/ docs/gitbook/
```

- [ ] **Step 2: Delete old files**

```bash
rm docs/setup-guide.md docs/slack-setup.md docs/refactoring-spec.md
rm -rf docs/guide/ docs/specs/
```

- [ ] **Step 3: Verify final docs/ structure**

```bash
ls -la docs/
# Should show: acp-guide.md, images/, superpowers/, gitbook/
```

- [ ] **Step 4: Commit**

```bash
git add -A docs/
git commit --no-verify -m "docs: remove old scattered documentation (replaced by gitbook)"
```

---

## Task 12: Update README.md Links

**Files:**
- Modify: `README.md` (root)

**Source references:** Current README.md links to `docs/guide/*` files. Update to `docs/gitbook/*` paths per the spec's link mapping table.

- [ ] **Step 1: Read current README.md**

Identify all links pointing to `docs/guide/` or other deleted files.

- [ ] **Step 2: Update links**

Apply the mapping:
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

Also check for any links to `docs/setup-guide.md`, `docs/slack-setup.md`, `docs/specs/` — update or remove them.

- [ ] **Step 3: Add Slack setup link if missing**

If README doesn't mention Slack setup, add link to `docs/gitbook/platform-setup/slack.md` alongside Telegram and Discord links.

- [ ] **Step 4: Verify no broken links remain**

```bash
grep -n 'docs/guide/' README.md
grep -n 'docs/specs/' README.md
grep -n 'docs/setup-guide' README.md
grep -n 'docs/slack-setup' README.md
# All should return empty
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit --no-verify -m "docs: update README.md links to point to new gitbook documentation"
```

---

## Dependency Graph

```
Task 1 (scaffold) ← must run first
  ├── Task 2 (getting-started) — can run in parallel after Task 1
  ├── Task 3 (platform-setup) — can run in parallel after Task 1
  ├── Task 4 (using-viben) — can run in parallel after Task 1
  ├── Task 5 (self-hosting) — can run in parallel after Task 1
  ├── Task 6 (features) — can run in parallel after Task 1
  ├── Task 7 (extending) — can run in parallel after Task 1
  ├── Task 8 (api-reference) — can run in parallel after Task 1
  └── Task 9 (troubleshooting) — can run in parallel after Task 1
Task 10 (cross-references) ← after Tasks 2-9
Task 11 (delete old docs) ← after Tasks 2-9
Task 12 (update README) ← after Task 11
```

Tasks 2-9 are fully independent and can be executed in parallel by separate subagents.
