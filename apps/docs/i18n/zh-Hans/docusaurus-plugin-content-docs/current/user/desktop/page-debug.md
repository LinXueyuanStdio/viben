---
sidebar_position: 4
title: "Page Debug"
description: "AI-powered page debugging for Viben Desktop - Automatically debug Tauri WebView pages"
---

# Page Debug

Let AI automatically debug Tauri WebView pages. This feature integrates MCP (Model Context Protocol) to provide AI models with the ability to screenshot, execute JavaScript, and inspect DOM structures.

:::warning Development Only
Page Debug is only available in development builds. Production builds have this feature disabled for security.
:::

---

## Overview

Page Debug enables AI-assisted debugging of the Viben Desktop application's WebView. Through the MCP protocol, AI models can:

- Take screenshots of the current window
- Execute JavaScript code in the browser context
- Inspect DOM structure
- Simulate keyboard input

This is especially useful for:
- **Visual verification** - AI can see what the UI looks like
- **Bug investigation** - AI can inspect DOM and run diagnostic scripts
- **Automated testing** - AI can simulate user interactions

---

## Available Tools

When the debug service is running, AI models have access to these tools:

| Tool | Function | Use Case |
|------|----------|----------|
| `take_screenshot` | Capture current window | Visual verification, UI issue investigation |
| `execute_js` | Execute JavaScript code | Query DOM, check errors, modify state |
| `get_dom` | Get DOM structure | Page structure analysis |
| `send_keyboard_input` | Simulate keyboard input | Automated testing |
| `launch_app` | Start application | Automation testing |
| `stop_app` | Stop application | Process control |

---

## Accessing Page Debug

1. Open Viben Desktop in development mode
2. Navigate to **MCP Services** in the sidebar
3. Select **Page Debug**

The Page Debug panel shows:
- **Service Status** - Whether the debug service is running
- **Socket Path** - The communication socket location
- **Available Features** - List of debug capabilities
- **AI Configuration** - MCP configuration to copy

---

## Configuring AI Clients

To allow AI clients to use Page Debug, configure MCP in your client settings.

### Claude Code

Add to `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "viben-debug": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/tauri-mcp-client", "--socket", "/tmp/viben-mcp.sock"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "viben-debug": {
      "transport": "socket",
      "socketPath": "/tmp/viben-mcp.sock"
    }
  }
}
```

---

## Debug Workflow

A typical AI-assisted debug session follows this workflow:

1. **Trigger Issue** - Reproduce the problem in Viben Desktop
2. **AI Collection** - AI gathers debugging information:
   - IPC call logs
   - WebView console errors
   - Window/state snapshots
   - Screenshots
3. **AI Analysis** - AI model analyzes the data:
   - Locates error source (frontend/backend/IPC)
   - Compares normal vs abnormal flow
   - Generates fix suggestions
4. **Apply Fix** - Apply the suggested fix:
   - Frontend JavaScript patches
   - Rust backend fixes
   - IPC call corrections

---

## Example Usage

### Ask AI to Debug UI Issue

```
I see a rendering issue in Viben Desktop. Can you:
1. Take a screenshot of the current state
2. Inspect the DOM structure of the sidebar
3. Check for any console errors
```

### Ask AI to Verify Feature

```
Please verify the new button works correctly:
1. Take a screenshot showing the button
2. Execute JS to check the button's click handler
3. Simulate a keyboard shortcut to trigger it
```

---

## Security Notes

Page Debug is designed with security in mind:

1. **Development Only** - Enabled only with `#[cfg(debug_assertions)]`
2. **Local Access** - Socket path restricted to local access
3. **No Sensitive Data** - Tokens and API keys are not exposed to MCP

In production builds:
- MCP plugin is not included in the binary
- The Page Debug page shows a "Development Only" message
- No debug endpoints are available

---

## Troubleshooting

### Service Not Running

If the debug service shows as "Stopped":

1. Ensure you are running a development build
2. Check that the socket file exists: `ls /tmp/viben-mcp.sock`
3. Restart Viben Desktop

### AI Cannot Connect

If your AI client cannot connect to the debug service:

1. Verify the socket path matches your MCP configuration
2. Check file permissions on the socket file
3. Try restarting both Viben Desktop and your AI client

### Commands Not Working

If debug commands fail:

1. Check the AI client's MCP logs for errors
2. Ensure the WebView is loaded and responsive
3. Try a simple command first like `take_screenshot`

---

## Related Documentation

- [Features](./features) - Complete feature list
- [Installation](./installation) - Install Viben Desktop
- [MCP Configuration](/user/mcp/configuration) - General MCP setup
