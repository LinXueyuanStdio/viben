# Quick Start for Contributors

Welcome, and thank you for wanting to contribute! This guide gets your local development environment running so you can explore the code, fix bugs, or build new features.

## Prerequisites

- **Node.js 20 or later** — check with `node --version`
- **pnpm** — Viben uses pnpm for package management. Install it with `npm install -g pnpm`
- **Git**

---

## Set up the repository

```bash
# Clone the repo
git clone https://github.com/LinXueyuanStdio/viben.git
cd Viben

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run the tests — everything should pass
pnpm test

# Start watch mode (rebuilds on every file save)
pnpm dev
```

That's it. You now have a fully working local build.

To run your local build instead of the globally installed version:

```bash
node dist/cli.js --version
```

---

## Project structure

```
src/
  cli.ts              Entry point for the CLI (start, install, uninstall, plugins, --version, --help)
  main.ts             Server startup — registers adapters and starts listening
  index.ts            Public API exports (for use as a library)

  core/               The heart of Viben
    config.ts         Zod-validated config loader (<instance-root>/config.json)
    core.ts           VibenCore — the main orchestrator
    session.ts        Session lifecycle, prompt queue, auto-naming
    agent-instance.ts ACP subprocess client — spawns and talks to agents
    channel.ts        ChannelAdapter abstract base class
    plugin/           Plugin system (PluginRegistry, LifecycleManager, PluginContext)
    command-registry.ts  Central command registry with namespace resolution
    commands/         Built-in system command handlers
    setup/            Interactive setup wizard and reconfigure flow

  plugins/
    telegram/         Telegram adapter plugin (grammY)
    discord/          Discord adapter plugin
    slack/            Slack adapter plugin
```

---

## Key concepts

Understanding these three abstractions covers most of the codebase:

**ChannelAdapter** (`src/core/channel.ts`)
The abstract base that every platform integration extends. Implementations provide `sendMessage`, `sendPermissionRequest`, `sendNotification`, `createSessionThread`, and `renameSessionThread`. If you're adding a new platform, you're writing a ChannelAdapter.

**Session** (`src/core/session.ts`)
Represents one conversation between a user and an agent. It owns a prompt queue (so messages are processed serially, never in parallel), handles auto-naming after the first prompt, and manages the lifecycle of the underlying agent instance.

**AgentInstance** (`src/core/agent-instance.ts`)
The bridge between Viben and an AI agent. It spawns the agent as a subprocess, communicates via the ACP protocol, and converts ACP events into the internal `AgentEvent` types that the rest of the system understands.

---

## Running a single test file

```bash
pnpm test src/core/__tests__/session-lifecycle.test.ts
```

Or run all tests in watch mode:

```bash
pnpm test --watch
```

---

## Before you open a PR

- Make sure `pnpm build` completes without errors.
- Make sure `pnpm test` passes.
- For new features, add tests in `src/core/__tests__/` or alongside the relevant module.
- Follow the ESM-only convention — all imports use `.js` extensions, even for TypeScript source files.

---

## Where to go next

- [Contributing](../extending/contributing.md) — PR process, code conventions, and testing guidelines
- [Building Adapters](../extending/building-adapters.md) — step-by-step guide to adding a new platform
- [Plugin System](../extending/plugin-system.md) — how the plugin system works
