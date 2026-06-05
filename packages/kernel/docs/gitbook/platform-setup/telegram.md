# Telegram Setup

This guide walks you through connecting Viben to Telegram. Viben uses a Telegram group with Topics enabled — each coding session gets its own topic thread for an organized, isolated workspace.

> **Prerequisites:**
> 1. A Telegram group (any size)
> 2. **Topics enabled** — Group Settings → Edit → Topics
> 3. **Bot is admin with "Manage Topics" permission** — Group Settings → Administrators
>
> If these aren't set up when Viben first starts, it will send instructions to your group's General topic and keep retrying automatically.

## Prerequisites

- A Telegram account
- Viben installed: `npm install -g @viben/kernel`
- At least one ACP agent installed (e.g., `claude-agent-acp`)

---

## Step 1: Create a Bot via BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather), or click that link.
2. Send the command `/newbot`.
3. BotFather will ask for a name — enter a display name (e.g., `My Viben Bot`).
4. BotFather will then ask for a username — enter a unique username ending in `bot` (e.g., `myviben_bot`).
5. BotFather replies with your **bot token**. It looks like:
   ```
   123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Copy and save this token somewhere safe. You will need it in Step 6.

> **Important:** Your bot token is a secret. Anyone with this token can control your bot. Never share it publicly or commit it to version control.

---

## Step 2: Create a Group with Topics Enabled

Viben requires a Telegram group with the **Topics** feature enabled. Topics create thread-like channels — one per coding session.

1. In Telegram, tap the compose icon and select **New Group**.
2. Add your bot as a member (search for its username).
3. Give the group a name (e.g., `Viben`) and create it.
4. Open the group → tap the group name at the top → **Edit** (pencil icon).
5. Scroll down and enable **Topics**.
6. Save the changes.

---

## Step 3: Add the Bot as Admin

The bot must be an administrator with the following permissions to manage topics and send messages:

1. Open the group → tap the group name → **Administrators**.
2. Tap **Add Administrator**.
3. Search for your bot by username and select it.
4. Make sure these permissions are enabled:
   - **Manage Topics** — required to create and rename session topics
   - **Send Messages** — required to send responses
   - **Delete Messages** — recommended for cleanup
5. Tap **Save**.

> Viben validates that the bot is an administrator during setup. If it is not, setup will fail with an error and prompt you to fix it.

---

## Step 4: Get the Chat ID

The Chat ID is the unique numeric identifier for your group. You need it for the config.

**Option A: Use the Viben setup wizard (recommended)**

The interactive wizard auto-detects your Chat ID. Run:

```bash
viben
```

When prompted for the Chat ID, send any message in your group. The wizard polls the Telegram API for updates and reports the group it sees:

```
Group detected: My Viben Bot (-1001234567890)
```

**Option B: Use @RawDataBot**

Forward any message from your group to [@RawDataBot](https://t.me/raw_data_bot). It replies with the raw update JSON, which includes `"chat": {"id": -1001234567890, ...}`. The Chat ID is the negative number starting with `-100`.

**Option C: Use the Telegram API directly**

```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```

Replace `<YOUR_TOKEN>` with your bot token. Send a message in the group first, then open this URL. Look for `"chat": {"id": ...}` in the response.

---

## Step 5: Configure Viben

Edit `<workspace>/.viben/config.json` (e.g. `~/viben-workspace/.viben/config.json`) and fill in the Telegram section (see the [full configuration reference](../self-hosting/configuration.md) for all available options):

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "chatId": -1001234567890,
      "notificationTopicId": null,
      "assistantTopicId": null
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `enabled` | Set to `true` to activate the Telegram adapter |
| `botToken` | The token from BotFather (Step 1) |
| `chatId` | The group's Chat ID — negative number starting with `-100` (Step 4) |
| `notificationTopicId` | Leave `null` — Viben creates this topic on first start |
| `assistantTopicId` | Leave `null` — Viben creates this topic on first start |

> **Tip:** You can also run `viben` (the interactive setup wizard) instead of editing the file manually. The wizard validates your token and auto-detects the Chat ID.

---

## Step 6: Start Viben and Test

Start Viben:

```bash
viben start
```

Expected output:

```
[info] Telegram adapter started
[info] Notification topic created (id: 2)
[info] Assistant topic created (id: 3)
[info] Viben ready
```

Open your Telegram group. You should see two new topics appear automatically.

To create your first coding session, use the `/new` command in the group's **General** topic or the **Assistant** topic:

```
/new claude my-project
```

Viben creates a new topic thread for this session.

---

## Step 7: System Topics (Auto-Created on First Start)

On first start, Viben automatically creates two system topics in your group:

| Topic | Purpose |
|-------|---------|
| **Notifications** (`📋 Notifications`) | Receives completion summaries, error alerts, and permission request notifications with deep links back to the relevant session topic |
| **Assistant** (`🤖 Assistant`) | An always-on AI helper session. Send questions here to get guidance on using Viben, creating sessions, or troubleshooting |

The topic IDs are saved to your config automatically:

```json
{
  "channels": {
    "telegram": {
      "notificationTopicId": 2,
      "assistantTopicId": 3
    }
  }
}
```

On subsequent restarts, Viben reuses these existing topics rather than creating new ones.

---

## Step 8: Session Topics

Each `/new` command creates a dedicated forum topic for that coding session:

- **Real-time streaming** — agent responses appear as the model generates them, with message edits batched at ~1-second intervals to avoid Telegram rate limits.
- **Auto-naming** — after the first prompt, the topic is renamed to a short 5-word summary of the task (e.g., `Add login form to app`).
- **Prompt queue** — send multiple messages while the agent is processing; they are queued and processed in order.
- **Permission buttons** — when the agent needs approval to run a command or modify a file, inline **Allow / Always Allow / Reject** buttons appear in the topic.
- **Skill commands** — the agent publishes available skills as inline buttons, pinned at the top of the topic.
- **Viewer links** — if the tunnel feature is enabled, tool calls include clickable links to an in-browser file or diff viewer.

When the session ends, the topic stays open for reference. Use `/cancel` to cancel a running session.

---

## Environment Variables

You can pass credentials via environment variables instead of editing the config file. This is useful in scripts or CI environments:

```bash
export VIBEN_TELEGRAM_BOT_TOKEN="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export VIBEN_TELEGRAM_CHAT_ID="-1001234567890"
viben start
```

| Variable | Config path |
|----------|-------------|
| `VIBEN_TELEGRAM_BOT_TOKEN` | `channels.telegram.botToken` |
| `VIBEN_TELEGRAM_CHAT_ID` | `channels.telegram.chatId` |

Environment variables take precedence over values in `config.json`.

---

## Troubleshooting

**Bot is not responding**
- Confirm the bot is added to the group and is an administrator.
- Verify `enabled: true` in the config.
- Check `<instance-root>/logs/` for error messages.

**"Chat must be a group" error**
- Make sure you are using a group (not a channel). Channels are not supported.
- If the group was just created, wait a moment and try again.

**Topics not appearing after first start**
- If Viben cannot create topics, it sends a message to the group's General topic with instructions.
- Follow the instructions in that message: enable Topics and/or grant the bot "Manage Topics" permission.
- Viben retries automatically every 30 seconds — no need to restart.

**Chat ID is not detected**
- Make sure you sent a message in the group after adding the bot.
- Press `m` in the setup wizard to enter the Chat ID manually.

For more detailed troubleshooting, see [Telegram Issues](../troubleshooting/telegram-issues.md).
