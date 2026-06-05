# Slack Setup

This guide walks you through creating a Slack app and connecting it to Viben. Each coding session gets its own dedicated Slack channel, keeping conversations isolated and easy to search.

## Prerequisites

- **Slack workspace admin access** — required to create and install an app
- Viben installed: `npm install -g @viben/kernel`
- At least one ACP agent installed (e.g., `claude-agent-acp`)

---

## Step 1: Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps).
2. Click **Create New App**.
3. Choose **From scratch**.
4. Enter a name (e.g., `Viben`).
5. Select your Slack workspace.
6. Click **Create App**.

You are now on the app's **Basic Information** page. Keep this page open — you will return to it several times.

---

## Step 2: Enable Socket Mode and Generate an App-Level Token

Viben uses Socket Mode to connect to Slack over a persistent WebSocket connection. This means no public URL or webhook is required — ideal for running on a local machine.

1. In the left sidebar, go to **Socket Mode**.
2. Toggle **Enable Socket Mode** to On.
3. A dialog prompts you to create an **App-Level Token**. Click **Generate Token and Events**.
4. Name the token (e.g., `viben-token`).
5. Under **Scopes**, select `connections:write`.
6. Click **Generate**.
7. **Copy and save the token** — it starts with `xapp-1-...`. You will need it as `appToken` in the Viben config.

> This token controls your app's WebSocket connection. Store it securely and do not commit it to version control.

---

## Step 3: Configure Bot Token Scopes

Bot Token Scopes determine what your bot is allowed to do in the workspace.

1. In the left sidebar, go to **OAuth & Permissions**.
2. Scroll down to **Bot Token Scopes**.
3. Click **Add an OAuth Scope** and add each of the following:

| Scope | Why it is needed |
|-------|-----------------|
| `chat:write` | Post messages in session channels |
| `chat:write.public` | Post in channels without joining them first |
| `channels:history` | Receive message events from public channels (required — without this, messages are silently dropped) |
| `channels:manage` | Create and archive public session channels |
| `channels:read` | List and inspect channels |
| `channels:join` | Join channels when needed |
| `groups:history` | Receive message events from private channels (required — without this, messages are silently dropped) |
| `groups:read` | List private channels |
| `groups:write` | Manage private channels |
| `im:history` | Receive direct messages |
| `im:read` | Read DM channel info |
| `im:write` | Open DM channels |
| `users:read` | Look up user information |
| `files:read` | Download uploaded files (required for voice message transcription) |
| `files:write` | Upload audio files (required for TTS voice replies) |
| `commands` | Register and handle slash commands |
| `reactions:write` | Add emoji reactions as status indicators |

> **Important:** `channels:history` and `groups:history` are critical. Without them, your bot connects via Socket Mode and joins channels successfully, but Slack silently drops all incoming `message` events — no errors and no logs. This is one of the most common sources of confusion during setup.

---

## Step 4: Install the App to Your Workspace

1. In the left sidebar under **Settings**, go to **Install App**.
2. Click **Install to Workspace**.
3. Review the requested permissions.
4. Click **Allow**.
5. You are redirected to a page showing your **Bot User OAuth Token**.
6. **Copy and save this token** — it starts with `xoxb-...`. You will need it as `botToken` in the Viben config.

---

## Step 5: Subscribe to Bot Events

After configuring scopes, subscribe to the message events Viben needs to receive.

1. In the left sidebar, go to **Event Subscriptions**.
2. Toggle **Enable Events** to On.
3. Scroll to **Subscribe to bot events**.
4. Click **Add Bot User Event** and add:
   - `message.channels` — receive messages from public channels the bot is in
   - `message.groups` — receive messages from private channels the bot is in
   - `message.im` — receive direct messages
   - `app_mention` — receive messages where the bot is @mentioned
5. Click **Save Changes**.
6. A banner prompts you to reinstall the app. Click **Reinstall App** (or go to **Install App** → **Reinstall to Workspace**).

> In Socket Mode, event payloads are delivered over the WebSocket connection — no public URL is needed. However, you must still subscribe to the events here for Slack to deliver them to your app.

---

## Step 6: Enable Interactivity and Slash Commands

Permission buttons (Allow / Deny) and the `/outputmode` command both require interactivity to be enabled.

### Enable Interactivity

1. In the left sidebar, go to **Interactivity & Shortcuts**.
2. Toggle **Interactivity** to On.
3. In Socket Mode, interactive payloads are delivered over the same WebSocket connection. Leave the **Request URL** field blank or set a placeholder value — it is not used in Socket Mode.
4. Click **Save Changes**.

### Register the `/outputmode` Slash Command

1. In the left sidebar, go to **Slash Commands**.
2. Click **Create New Command**.
3. Fill in the fields:
   - **Command**: `/outputmode`
   - **Request URL**: leave blank (Socket Mode delivers the payload via WebSocket)
   - **Short Description**: `Change output verbosity for this session`
   - **Usage Hint**: `[low|medium|high]`
4. Click **Save**.
5. You will be prompted to **Reinstall App** — do this now, or after Step 8 once all config is ready.

---

## Step 7: Get the Signing Secret

1. In the left sidebar, go to **Basic Information**.
2. Scroll down to **App Credentials**.
3. Copy the **Signing Secret**. You will need it as `signingSecret` in the Viben config.

---

## Step 8: Configure Viben

Edit `<workspace>/.viben/config.json` (e.g. `~/viben-workspace/.viben/config.json`) and add the Slack section (see the [full configuration reference](../self-hosting/configuration.md) for all available options):

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-1-...",
      "signingSecret": "abcd1234efgh5678ijkl9012",
      "notificationChannelId": "C1234567890",
      "allowedUserIds": [],
      "channelPrefix": "viben"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `enabled` | Set to `true` to activate the Slack adapter |
| `botToken` | Bot User OAuth Token from Step 4 (starts with `xoxb-`) |
| `appToken` | App-Level Token from Step 2 (starts with `xapp-1-`) |
| `signingSecret` | Signing Secret from Step 7 |
| `notificationChannelId` | Optional. Slack channel ID for system notifications. Right-click a channel → View Details → copy the ID from the URL (e.g., `C1234567890`) |
| `allowedUserIds` | Optional. Array of Slack user IDs allowed to create sessions. If empty, all workspace members can create sessions. Get a user's ID by opening their profile → click the `•••` menu → **Copy user ID** |
| `channelPrefix` | Prefix for auto-created session channels. Default: `viben`. Session channels are named `{prefix}-{slug}-{sessionId}` |
| `outputMode` | Optional. Default output verbosity: `"low"`, `"medium"`, or `"high"`. Defaults to `"medium"`. Can be overridden per session with `/outputmode`. See [Output Mode](#output-mode) below |

---

## Step 9: Start Viben and Test

Start Viben:

```bash
viben start
```

Expected output:

```
[info] Slack bot authenticated (botUserId: U...)
[info] Slack adapter started (Socket Mode)
```

To create your first coding session, type the slash command in any Slack channel where the bot is present:

```
/new claude my-project
```

Viben creates a new channel named `viben-my-project-{id}` and invites you to it.

---

## How Sessions Work

### Session Model

Each Viben session in Slack gets its own dedicated channel:

1. User sends `/new [agent] [workspace]` in any channel where the bot is present.
2. Viben creates a new channel named `viben-{slug}-{sessionId}` (e.g., `viben-fix-auth-bug-a3k9`).
3. The user sends coding requests in that session channel.
4. The agent responds with streaming text, tool call results, and code.
5. When the agent needs approval to run a command or edit a file, **Allow** and **Deny** buttons appear.
6. When the session ends or times out, the channel is archived for record-keeping.

### Available Commands

| Command | Description |
|---------|-------------|
| `/new [agent] [workspace]` | Create a new session |
| `/newchat` | New session with the same agent and workspace as the current one |
| `/cancel` | Cancel the active session |
| `/status` | Show current session status or system status |
| `/agents` | List available agents |
| `/help` | Show help |
| `/outputmode [low\|medium\|high]` | Change output verbosity. Omit the argument to open an interactive modal |

### Command Examples

```
/new claude my-app          → Claude session in ~/viben-workspace/my-app/
/new codex api-server       → Codex session in ~/viben-workspace/api-server/
/new claude ~/code/project  → Claude session at an absolute path
/new                        → Default agent and default workspace
/newchat                    → New session using current agent and workspace
/cancel                     → Cancel the running session
/outputmode high            → Switch to High verbosity for this session
/outputmode                 → Open a modal to choose verbosity and scope
```

---

## Output Mode

The Slack adapter renders agent activity in real time using Slack threads. When the agent starts using tools, a **Processing...** message appears in the channel. Tool details are posted as thread replies. When the response is complete, the message updates to **✅ Done** and the agent's reply appears in the channel.

You can control how much detail is shown with the output mode setting.

### Verbosity Levels

| Mode | What you see |
|------|-------------|
| **Low** 🔇 | A single `🔧 Processing...` → `✅ Done` indicator. No tool details. |
| **Medium** 📊 | Progress indicator with tool names and a running count (`2/5 tools`). Thread shows tool cards with summaries. |
| **High** 🔍 | Full detail: tool input/output, file diffs, viewer links, and the agent's thinking in the thread. |

The default is **Medium**.

### Changing Output Mode

**Inline shortcut** — type directly in a session channel:

```
/outputmode low
/outputmode medium
/outputmode high
```

**Interactive modal** — type `/outputmode` with no arguments to open a modal where you can select the verbosity level and choose whether to apply it to the current session only or to all sessions.

### Setting the Default

To set a default for all sessions, add `outputMode` to your config:

```json
{
  "channels": {
    "slack": {
      "outputMode": "medium"
    }
  }
}
```

---

## Voice Support (Speech-to-Text and Text-to-Speech)

The Slack adapter supports voice interactions — record audio clips and optionally receive spoken replies.

### Speech-to-Text (STT)

Record an audio clip using Slack's built-in microphone button. Viben transcribes it using [Groq Whisper](https://console.groq.com/) (free tier: ~8 hours/day) and sends the transcribed text to the agent.

1. Get a free Groq API key at [console.groq.com](https://console.groq.com/).
2. Add this to `<instance-root>/config.json`:

```json
{
  "speech": {
    "stt": {
      "provider": "groq",
      "providers": {
        "groq": {
          "apiKey": "gsk_..."
        }
      }
    }
  }
}
```

Or use environment variables:

```bash
export VIBEN_SPEECH_STT_PROVIDER=groq
export VIBEN_SPEECH_GROQ_API_KEY=gsk_...
```

3. Ensure your bot has the `files:read` scope (Step 3). If you added this scope after the initial install, reinstall the app to your workspace.

After restarting Viben, send an audio clip in a session channel. A transcription confirmation appears: `🎤 You said: ...`.

### Text-to-Speech (TTS)

TTS uses Microsoft Edge TTS (free, no API key required). The agent's reply is synthesized into audio and uploaded as a playable file in the session channel.

Add this to `<instance-root>/config.json`:

```json
{
  "speech": {
    "tts": {
      "provider": "edge-tts"
    }
  }
}
```

Ensure your bot has the `files:write` scope (Step 3). Reinstall the app if this scope was added after initial installation.

---

## Environment Variables

Override config values using environment variables:

```bash
export VIBEN_SLACK_BOT_TOKEN="xoxb-..."
export VIBEN_SLACK_APP_TOKEN="xapp-1-..."
export VIBEN_SLACK_SIGNING_SECRET="abcd1234..."
viben start
```

| Variable | Config path |
|----------|-------------|
| `VIBEN_SLACK_BOT_TOKEN` | `channels.slack.botToken` |
| `VIBEN_SLACK_APP_TOKEN` | `channels.slack.appToken` |
| `VIBEN_SLACK_SIGNING_SECRET` | `channels.slack.signingSecret` |

---

## Troubleshooting

**Messages are completely ignored (no response, no logs)**

This is almost always a missing scope or event subscription.

1. Go to **OAuth & Permissions → Bot Token Scopes** and verify `channels:history` and `groups:history` are listed.
2. Go to **Event Subscriptions → Subscribe to bot events** and confirm `message.channels` and `message.groups` are listed.
3. After adding any new scope or event, you must **reinstall the app** to your workspace (Install App → Reinstall to Workspace).

**"Socket Mode connection failed"**
- Verify `appToken` starts with `xapp-1-`.
- Confirm Socket Mode is enabled in the app settings.
- Regenerate the App-Level Token if it may have expired.

**Permission buttons not responding**
- Go to **Interactivity & Shortcuts** and confirm Interactivity is toggled On.
- In Socket Mode, no Request URL is needed — interactive payloads arrive over the WebSocket.

**Voice transcription returns "could not process file"**
- The bot downloaded an HTML login page instead of the audio binary. This means the `files:read` scope is missing.
- Add `files:read` in **OAuth & Permissions → Bot Token Scopes** and reinstall the app.

**"Bot is not a member of the channel"**
- Verify the `channels:join` scope is enabled and reinstall the app.

**"Invalid signing secret"**
- Go to **Basic Information → App Credentials** and re-copy the Signing Secret. Ensure there are no leading or trailing spaces.

For more detailed troubleshooting, see [Slack Issues](../troubleshooting/slack-issues.md).
