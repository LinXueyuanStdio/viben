# Slack Issues

If you haven't finished initial setup, see the [Slack Setup guide](../platform-setup/slack.md) first.

---

### Socket Mode connection fails on startup

**Symptoms:** Viben exits immediately with an error like `Slack adapter requires botToken, appToken, and signingSecret` or the Bolt app fails to connect.

**Cause:** Socket Mode requires three credentials: a **Bot Token** (`xoxb-…`), an **App-Level Token** (`xapp-…`), and a **Signing Secret**. Missing any one of them prevents the adapter from starting.

**Solution:**
1. In the [Slack API dashboard](https://api.slack.com/apps), open your app.
2. **Bot Token**: Settings → **OAuth & Permissions** → copy the `xoxb-…` token.
3. **App-Level Token**: Settings → **Basic Information** → **App-Level Tokens** → generate one with the `connections:write` scope. It starts with `xapp-`.
4. **Signing Secret**: Settings → **Basic Information** → **App Credentials** → Signing Secret.
5. Add all three to `<instance-root>/config.json` under `channels.slack`.

---

### Bot doesn't respond to messages

**Symptoms:** You post in the session channel but the agent is silent, with no log output.

**Cause:** The Slack event router only processes messages in channels that have an active Viben session. Messages in other channels, DMs, or the notification channel are not routed to an agent.

**Solution:**
1. Use `/new` to create a new session — this creates a dedicated channel for the conversation.
2. Ensure Socket Mode is enabled for your app: Settings → **Socket Mode → Enable Socket Mode**.
3. Check that the `message.channels` event subscription is present under **Event Subscriptions → Subscribe to bot events**.
4. Verify `security.allowedUserIds` — if non-empty, your Slack user ID must be listed.

---

### "not_allowed_token_type" error

**Symptoms:** Logs show `not_allowed_token_type` from the Slack API, or `auth.test() did not return user_id`.

**Cause:** A User Token (`xoxp-…`) was provided where a Bot Token (`xoxb-…`) is required, or vice versa. The App-Level Token (`xapp-…`) was placed in the wrong field.

**Solution:**
- `botToken` must be an `xoxb-…` token from **OAuth & Permissions**.
- `appToken` must be an `xapp-…` token from **Basic Information → App-Level Tokens**.
- Do not swap these — they serve different purposes. The bot token authenticates API calls; the app token opens the Socket Mode WebSocket connection.

---

### Rate limiting causes delayed or dropped messages

**Symptoms:** Responses are slow to appear, or logs show rate limit warnings from the Slack API.

**Cause:** Slack enforces per-method rate limits (Tier 1–4). Heavy usage — many concurrent sessions posting messages quickly — can exhaust these limits.

**Solution:**
- Viben's `SlackSendQueue` serialises outbound API calls automatically to respect rate limits.
- If you hit limits consistently, reduce `security.maxConcurrentSessions` in config.
- Avoid bursting many messages at once; consider using `outputMode: "low"` in your config, or type `/outputmode low` in a session channel to reduce intermediate streaming updates.

---

### Interactivity (permission buttons) not working

**Symptoms:** The agent posts a permission request with buttons, but clicking them does nothing.

**Cause:** Interactivity requires Socket Mode to be enabled. If the app is in HTTP mode or the app-level token is missing/invalid, button interactions are never delivered.

**Solution:**
1. Enable Socket Mode: **Settings → Socket Mode → Enable**.
2. Ensure the `appToken` (`xapp-…`) is valid and has the `connections:write` scope.
3. Under **Interactivity & Shortcuts**, confirm that Interactivity is **On**.
4. Restart Viben after enabling interactivity.

---

### Voice messages are not transcribed

**Symptoms:** You send a voice memo in Slack but the agent receives no text, or receives the file path instead of a transcription.

**Cause:** Slack voice clips are audio files. Viben downloads the file and passes it to the agent as an audio attachment — but this requires the bot to have the `files:read` scope, and the agent must support audio input.

If the download returns an HTML login page instead of binary audio, the `files:read` scope is missing.

**Solution:**
1. Add `files:read` to your bot's OAuth scopes: **OAuth & Permissions → Bot Token Scopes → Add `files:read`**.
2. Reinstall the app to the workspace (Slack requires reinstallation after scope changes): **Settings → Install App → Reinstall**.
3. Confirm your agent supports audio input — agents that do not expose audio capability receive the file path as text instead.

---

### `/outputmode` command does nothing or returns "command not found"

**Symptoms:** Typing `/outputmode` shows no autocomplete, or Slack says the command is not found.

**Cause:** The `/outputmode` slash command must be registered in the Slack app's configuration before Slack delivers its payloads to Viben.

**Solution:**
1. In the [Slack API dashboard](https://api.slack.com/apps), open your app.
2. Go to **Slash Commands** in the left sidebar.
3. Click **Create New Command** and fill in:
   - **Command**: `/outputmode`
   - **Request URL**: leave blank (Socket Mode delivers the payload via WebSocket)
   - **Short Description**: `Change output verbosity`
   - **Usage Hint**: `[low|medium|high]`
4. Click **Save**.
5. Reinstall the app: **Settings → Install App → Reinstall to Workspace**.
6. Restart Viben.

---

### Channel creation fails or produces duplicate channels

**Symptoms:** Each restart creates a new `#viben-…` channel, or channel creation fails with a permissions error.

**Cause:** The bot needs `channels:manage` (for public channels) or `groups:write` (for private channels) scope to create channels. Duplicate channels appear when the saved `startupChannelId` in config has been deleted.

**Solution:**
1. Add the required scope: **OAuth & Permissions → Bot Token Scopes → `channels:manage`** (or `groups:write` for private).
2. Reinstall the app after adding scopes.
3. If duplicate channels have accumulated, delete the extras in Slack and clear `startupChannelId` from `<instance-root>/config.json`. Viben will create one clean channel on next startup and save its ID for reuse.
