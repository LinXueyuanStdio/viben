# Telegram Issues

Run `viben doctor` first — it validates your bot token, chat ID, group type, and admin status automatically.

If you haven't finished initial setup, see the [Telegram Setup guide](../platform-setup/telegram.md) first.

---

### Bot doesn't respond to messages

**Symptoms:** You send a message in Telegram but the bot stays silent.

**Cause:** The most common cause is that the bot is not an administrator in the group, or the `chatId` in your config does not match the actual group.

**Solution:**
1. Open your Telegram group → **Edit → Administrators** → add your bot and enable at minimum "Manage Topics".
2. Confirm the chat ID in `<instance-root>/config.json` matches the group. The ID of a group is negative (e.g., `-1001234567890`).
3. Restart Viben after making changes.

---

### "Not enough rights" error in logs

**Symptoms:** Viben logs show `Not enough rights` or `TOPIC_CLOSED` errors when trying to send messages.

**Cause:** The bot lacks administrator permissions in the group, or Topics are not enabled.

**Solution:**
1. Promote the bot to administrator in the group settings.
2. Enable Topics: **Group Settings → Edit → Topics**.
3. In the bot's admin settings, ensure "Manage Topics" is enabled.

---

### Topics are not created on startup

**Symptoms:** Viben starts but no "Notifications" or "Assistant" topics appear.

**Cause:** Either Topics are not enabled on the group, or the bot lacks the "Manage Topics" admin permission.

**New behavior (automatic):** Viben detects this at startup and sends a message to the group's **General** topic listing exactly what needs to be fixed. It then retries every 30 seconds automatically. Once the issues are resolved, topics are created and a confirmation message is sent.

**If you don't see the setup message:**
1. Confirm the bot is a member of the group.
2. Check logs for error details.
3. Run `viben doctor` to diagnose.

---

### Bot cannot manage topics

**Symptoms:** Topics are enabled, but the bot still cannot create session topics. Logs may show `Not enough rights to manage forum topics`.

**Cause:** The bot is an admin but the "Manage Topics" permission is not enabled in its admin role.

**Solution:**
1. Open the group in Telegram.
2. Go to **Group Settings → Administrators**.
3. Select your bot.
4. Enable the **Manage Topics** toggle.
5. Save. Viben will detect this within 30 seconds and complete setup automatically.

---

### "Chat not found" error

**Symptoms:** Logs show `Chat not found` or `Bad Request: chat not found` immediately on startup.

**Cause:** The `chatId` in config is wrong, or the bot has never been added to the group (Telegram only returns chat info for groups the bot is a member of).

**Solution:**
1. Add the bot to your group if you haven't already.
2. Run `viben doctor` — it calls `getChat` and reports the exact error from the Telegram API.
3. If the ID looks correct, check that it is a negative integer for groups.

---

### Rate limiting — messages are delayed or dropped

**Symptoms:** Responses appear sporadically, logs show `Rate limited by Telegram, retrying` with a `retryAfter` value.

**Cause:** Telegram enforces rate limits per bot per chat (roughly 20 messages per minute per group). Viben automatically retries up to 3 times with the delay Telegram specifies, but heavy usage can still cause visible delays.

**Solution:**
- This is normal behaviour under load. Viben's send queue handles it automatically.
- Avoid triggering many sessions simultaneously.
- If the problem is persistent, consider lowering `maxConcurrentSessions` in your config to reduce outbound message volume.

---

### Session doesn't start after sending a message

**Symptoms:** You send a message but no new topic appears and the agent doesn't respond.

**Cause:** Either the concurrent session limit has been reached, or your user ID is not in `allowedUserIds`.

**Solution:**
1. Check `security.maxConcurrentSessions` in `<instance-root>/config.json` — the default is low. Increase it if needed.
2. Check `security.allowedUserIds` — if the array is non-empty, only listed user IDs can create sessions. Find your Telegram user ID with `@userinfobot` and add it.

---

### Permission buttons are missing or unresponsive

**Symptoms:** The agent asks for permission but no buttons appear, or clicking buttons does nothing.

**Cause:** Callback queries (button clicks) are only delivered if `callback_query` is listed in `allowed_updates`. Viben sets this automatically on every polling cycle, but the bot must be running when buttons are clicked.

**Solution:**
1. Ensure the bot is running — buttons expire after the bot restarts if not answered.
2. If buttons appear but clicking does nothing, check logs for `Telegram bot error` entries that may indicate the bot token has been revoked.
3. Re-run setup (`viben onboard`) to regenerate configuration if the token is suspect.

---

### Streaming responses flicker or show duplicate edits

**Symptoms:** Agent responses appear to flash or update repeatedly instead of streaming smoothly.

**Cause:** Telegram rate-limits `editMessageText` calls. Viben batches updates with a send queue (default 3-second window), but under heavy load edits can still appear jumpy.

**Solution:**
- This is a Telegram API constraint, not an Viben bug.
- Lower `outputMode` to `"low"` in your Telegram config to reduce the number of intermediate edits sent during streaming:

```json
"telegram": {
  "outputMode": "low"
}
```

  The legacy key `displayVerbosity` is also accepted for backward compatibility.
