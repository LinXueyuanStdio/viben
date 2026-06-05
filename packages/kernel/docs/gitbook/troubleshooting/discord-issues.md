# Discord Issues

Run `viben doctor` first — it validates your bot token and guild access automatically.

If you haven't finished initial setup, see the [Discord Setup guide](../platform-setup/discord.md) first.

---

### Slash commands don't appear in Discord

**Symptoms:** You type `/` in a Discord channel but no Viben commands are listed.

**Cause:** Slash commands are registered per-guild on startup. Either the bot hasn't started successfully, it hasn't been invited to the server with the `applications.commands` scope, or Discord's cache hasn't updated yet.

**Solution:**
1. Invite the bot using a URL that includes both `bot` and `applications.commands` scopes. Generate this URL in the Discord Developer Portal under **OAuth2 → URL Generator**.
2. Restart Viben — commands are registered on every startup via the Discord REST API.
3. Discord can take a few minutes to propagate newly registered slash commands to clients. Wait a moment and try again.

---

### "Missing Intents" error in logs

**Symptoms:** Logs show an error like `Used disallowed intents` or `Missing Intents`, and the bot goes offline.

**Cause:** The Discord bot requires `Guilds`, `GuildMessages`, and `MessageContent` intents. `MessageContent` is a privileged intent that must be explicitly enabled in the Developer Portal.

**Solution:**
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → your application → **Bot**.
2. Under **Privileged Gateway Intents**, enable **Message Content Intent**.
3. Save changes and restart Viben.

---

### Thread creation fails

**Symptoms:** A new session starts but no thread appears in Discord, or logs show `Failed to create thread`.

**Cause:** The bot does not have permission to create threads in the forum channel, or the forum channel ID stored in config is stale (channel was deleted and recreated).

**Solution:**
1. Ensure the bot has **Manage Threads** and **Send Messages in Threads** permissions in the forum channel.
2. Delete the `forumChannelId` value from `<instance-root>/config.json` so Viben recreates the forum channel on next startup.
3. If using a pre-existing forum channel, make sure it is a **Forum** type channel, not a regular text channel.

---

### Bot shows as offline

**Symptoms:** The bot's status dot in Discord is grey (offline) even though Viben is running.

**Cause:** The bot token is invalid or has been regenerated in the Developer Portal, or the bot failed to connect to the Discord Gateway.

**Solution:**
1. Run `viben doctor` — it calls `GET /users/@me` with your token and reports `401 Unauthorized` if the token is invalid.
2. If the token has been regenerated, update it in `<instance-root>/config.json` (or the `DISCORD_BOT_TOKEN` environment variable) and restart.
3. Check for `[DiscordAdapter] Initialization failed` in the logs for the specific error.

---

### "Unknown interaction" errors

**Symptoms:** Clicking permission buttons or slash commands produces a Discord "This interaction failed" message.

**Cause:** Discord requires interactions to be acknowledged within 3 seconds. If Viben is under heavy load or paused (e.g., waiting for agent startup), the interaction token expires.

**Solution:**
- This is typically transient. Retry the action once Viben is idle.
- If it happens consistently, check `[DiscordAdapter] interactionCreate handler error` in logs for the underlying cause.
- Ensure the server running Viben has low latency to Discord's API (ideally under 1 second round-trip).

---

### Messages are not received by the agent

**Symptoms:** You send a message in a thread but the agent doesn't respond and no log entries appear.

**Cause:** The `MessageContent` privileged intent is not enabled (Discord sends the message event but with an empty content field), or the message was sent outside an active session thread.

**Solution:**
1. Enable **Message Content Intent** in the Discord Developer Portal (see "Missing Intents" above).
2. Confirm you are writing in a thread that belongs to an active Viben session — messages in regular channels are ignored; only thread messages are routed to the agent.
3. Check `security.allowedUserIds` — if populated, your Discord user ID must be listed.

---

### Forum channel not found on startup

**Symptoms:** Viben fails to start with `Guild not found` or creates duplicate forum channels on each restart.

**Cause:** The `guildId` is wrong, or the bot is not a member of the guild. Alternatively, the saved `forumChannelId` points to a deleted channel.

**Solution:**
1. Run `viben doctor` — it calls `GET /guilds/{guildId}` and returns a specific error (403 if the bot isn't in the server, 404 if the guild ID is wrong).
2. To invite the bot: Developer Portal → **OAuth2 → URL Generator** → scopes: `bot`, `applications.commands` → permissions: `Manage Channels`, `Manage Threads`, `Send Messages`, `Send Messages in Threads`, `Read Message History`.
3. Clear stale channel IDs from config and let Viben recreate them.
