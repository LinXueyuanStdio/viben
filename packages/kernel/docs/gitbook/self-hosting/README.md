# Self-Hosting

Everything you need to run Viben on your own infrastructure.

Viben is designed to be self-hosted: you own the process, the config, and the data. There are no cloud accounts required beyond the messaging platform bots you configure. Each instance stores its state in `<workspace>/.viben/`. Shared data (agent binaries, instance registry) lives in `~/.viben/`.

## In this section

- [**Installation**](installation.md) — System requirements, global install via npm, first-run setup wizard, and running from source.
- [**Configuration**](configuration.md) — The full config schema, interactive editor, environment variable overrides, and backward compatibility guarantees.
- [**Daemon Mode**](daemon-mode.md) — Running as a background process, PID/log file locations, and autostart on boot.
- [**Security**](security.md) — User allowlists, session limits, API bearer token authentication, and best practices.
- [**Logging**](logging.md) — Log levels, file rotation, per-session logs, and structured JSON format.
- [**Updating**](updating.md) — How to update, automatic config migrations, and the backward compatibility guarantee.
