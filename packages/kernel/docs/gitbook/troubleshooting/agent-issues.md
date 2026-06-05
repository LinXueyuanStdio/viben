# Agent Issues

Run `viben doctor` first — it checks whether each configured agent command exists in your PATH.

---

### "Agent not found" or default agent missing

**Symptoms:** Viben logs show `Default agent "..." not found in agents config` and no sessions start.

**Cause:** The `defaultAgent` field in `<instance-root>/config.json` references an agent name that is not defined under the `agents` map, or was mistyped.

**Solution:**
1. Open `<instance-root>/config.json` (e.g. `~/viben-workspace/.viben/config.json`) and verify that `defaultAgent` matches a key under `agents` exactly (case-sensitive).
2. Run `viben doctor` — it reports `Default agent "X" not found in agents config` with the offending name.
3. Run `viben agents list` to see all available agents and their registry IDs.

---

### Agent crashes on startup — missing dependency

**Symptoms:** A session starts and immediately reports `Agent crashed (exit code 1)` with stderr output mentioning a command not found.

**Cause:** Some agents depend on an external CLI being installed first. For example, `claude-acp` requires `@anthropic-ai/claude-code` and `codex-acp` requires `@openai/codex`.

**Solution:**

Install the required dependency. Common cases:

| Agent | Required CLI | Install command |
|-------|-------------|-----------------|
| `claude-acp` | Claude CLI | `npm install -g @anthropic-ai/claude-code` |
| `codex-acp` | Codex CLI | `npm install -g @openai/codex` |
| `crow-cli`, `fast-agent` | uvx (Python) | `pip install uv` |

After installing, run `viben doctor` to confirm the command is found. Then restart Viben.

---

### Agent times out and session stalls

**Symptoms:** The session shows activity (typing indicator) but never produces a response, eventually timing out.

**Cause:** The agent subprocess is alive but not producing ACP output — typically because it is waiting for an API key, authentication, or interactive input that can't be provided via stdin.

**Solution:**
1. Run the agent directly in your terminal first: `viben agents run <agent-name>`. Complete any one-time setup (login, API key entry) interactively.
2. For agents requiring login:
   - Claude: `claude login`
   - Codex: `codex` → select "Sign in with ChatGPT"
   - Gemini: `viben agents run gemini` → sign in with Google
3. After completing setup, restart Viben — subsequent spawns will reuse the stored credentials.

---

### "Command not found" for the agent

**Symptoms:** `viben doctor` reports `<command> not found in PATH` and sessions fail immediately.

**Cause:** The agent's executable is not on your system's `PATH`. This can happen after a global npm install if the npm bin directory is not in `PATH`, or if the agent was installed locally but not globally.

**Solution:**
1. Confirm the command exists: `which claude` (or the relevant command).
2. If not found, install globally: `npm install -g <package>`.
3. If installed but not found, add the npm global bin directory to your PATH:
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export PATH="$(npm root -g)/../bin:$PATH"
   ```
4. Open a new terminal and verify: `which claude`. Restart Viben.

---

### Permission denied when spawning agent

**Symptoms:** Logs show `Failed to spawn agent "...": EACCES` or `permission denied`.

**Cause:** The agent executable exists but is not marked as executable, or it lives in a directory your user cannot read.

**Solution:**
1. Locate the binary: `which <command>`.
2. Fix permissions: `chmod +x $(which <command>)`.
3. If the file is owned by another user (e.g., installed with `sudo`), reinstall without sudo: `npm install -g <package>` as your regular user.

---

### Agent works in the terminal but not via Viben

**Symptoms:** Running the agent command directly in your terminal works fine, but Viben sessions fail or produce empty responses.

**Cause:** Viben spawns the agent as a subprocess with a clean environment (`process.env` plus any `env` overrides in config). Environment variables set only in interactive shell sessions (e.g., in `.zshrc` but not `.zprofile`) may not be inherited.

**Solution:**
1. Add required environment variables (API keys, etc.) explicitly to the agent's `env` block in `<instance-root>/config.json` (e.g. `~/viben-workspace/.viben/config.json`):
   ```json
   "agents": {
     "my-agent": {
       "command": "my-agent",
       "env": { "ANTHROPIC_API_KEY": "sk-..." }
     }
   }
   ```
2. Alternatively, ensure the variable is exported in a file loaded for non-interactive shells (e.g., `~/.zprofile` or `~/.bashrc`).

---

### Session stuck in "initializing"

**Symptoms:** A session is created but the agent never responds. Logs show the spawn completed but no ACP events appear.

**Cause:** The agent started but failed the ACP handshake (`initialize` → `newSession`) — either it does not speak ACP, or it exited before the handshake completed.

**Solution:**
1. Enable debug logging: set `VIBEN_DEBUG=true` and restart. Look for `ACP raw` log lines — if none appear after `Spawning agent`, the subprocess is not producing stdout.
2. Confirm the agent is an ACP-compatible binary. Only agents that implement the Agent Client Protocol work with Viben.
3. Check stderr output in the logs (`Agent crashed` events include the last 50 lines of stderr).

---

### High resource usage (CPU/memory)

**Symptoms:** Viben or an agent subprocess consumes excessive CPU or memory over time.

**Cause:** Long-running agent sessions accumulate context. Each new prompt appends to the agent's conversation history, which grows unboundedly until the session is destroyed.

**Solution:**
- Start a new session periodically for long workstreams. In Telegram, use `/new`; in Discord and Slack, use the `/viben-new` command.
- Sessions that are idle for a long time can be destroyed — Viben cleans up the subprocess with `SIGTERM` (then `SIGKILL` after 10 seconds) on session destruction.
- If a specific agent subprocess is the culprit, identify it with `ps aux | grep <agent-command>` and destroy the session from the messaging interface.
