# FAQ

### What operating systems does Viben support?

Viben runs on macOS, Linux, and Windows (via WSL). It requires Node.js 20 or later. Native Windows (PowerShell/CMD) is not officially tested — WSL 2 is recommended on Windows.

---

### Can I run multiple bots for different platforms at the same time?

Yes. Viben supports multiple channel adapters simultaneously. You can enable Telegram, Discord, and Slack in the same `config.json` — all three will start when you run `viben start`. Each platform gets its own adapter instance sharing a single agent backend.

---

### Is my data private? Does Viben send data anywhere?

Viben itself does not collect or transmit any telemetry. All data stays on your machine in the instance directory (`<workspace>/.viben/`). Your messages are sent directly from your machine to the AI agent (e.g., Claude, Codex) via the agent's own API. Review each agent's privacy policy independently — Viben is just the bridge.

---

### Does Viben cost money?

Viben is free and open source. However, the AI agents it connects to (Claude, Codex, Gemini, etc.) may have their own costs. Check the pricing page for whichever agent you use. Some agents (Gemini, Qwen) have free tiers. See `viben agents list` for setup notes per agent.

---

### Can I use Viben without Telegram?

Yes. Telegram is the default adapter used in the quick-start guide, but it is not required. Discord and Slack adapters are built in. You can also build a custom adapter by implementing the `ChannelAdapter` abstract class. Disable Telegram entirely by setting `channels.telegram.enabled: false` in your config.

---

### How many concurrent sessions can I run?

This is controlled by `security.maxConcurrentSessions` in the instance `config.json`. The default is intentionally low to prevent resource exhaustion. Each session spawns one agent subprocess — increase the limit carefully based on available RAM and CPU.

```json
"security": {
  "maxConcurrentSessions": 5
}
```

---

### Does Viben work offline or with local models?

Viben works with any agent that implements the ACP protocol. If your agent uses a local model (e.g., via Ollama), it will work offline. Agents like Goose support local model providers out of the box. The Viben server itself does not need internet access — only the agent subprocess does (if it calls a remote API).

---

### How do I back up my sessions and configuration?

All persistent state is stored in the instance directory (`<workspace>/.viben/`):
- `config.json` — your full configuration
- `sessions.json` — session metadata
- `history/` — conversation history

Back up the entire `<workspace>/.viben/` directory (e.g. `~/viben-workspace/.viben/`). To restore on a new machine, copy it back, reinstall Viben (`npm install -g @viben/kernel`), and register the instance with `viben instances create --dir <workspace>`.

---

### Can multiple people use the same Viben instance?

Viben supports multiple users via the `security.allowedUserIds` setting. Add each user's platform-specific ID to the list:

```json
"security": {
  "allowedUserIds": ["123456789", "987654321"]
}
```

Each user gets their own session thread. Note that all sessions share the same agent configuration and working directory root — there is no per-user isolation of the filesystem.

---

### Viben crashed and left orphaned agent processes. How do I clean up?

When Viben exits uncleanly, agent subprocesses may continue running. Find and stop them:

```bash
# Find orphaned agent processes
ps aux | grep claude   # or codex, gemini, etc.

# Kill by PID
kill <pid>
```

On next startup, Viben will create fresh sessions. If a session record in `<instance-root>/sessions.json` references an agent session that no longer exists, Viben will fall back to starting a new agent session automatically rather than crashing.

---

### How do I report a bug or request a feature?

Open an issue on the [Viben GitHub repository](https://github.com/LinXueyuanStdio/viben). Before filing, run `viben doctor` and include its output. Enable debug logging with `VIBEN_DEBUG=true viben start` and attach the relevant log section.
