# What is Viben?

Viben is a bridge between the AI coding agents running on your machine and the messaging apps you already use every day — Telegram, Discord, and Slack.

Think of it as a **universal remote for AI agents**. Instead of jumping between a terminal, a browser, and an IDE just to ask an agent to fix a bug, you send a message in your chat app and get the results back right there — streaming, in real time.

## How it works

```
You (Telegram / Discord / Slack)
        ↓
    Viben
        ↓
    AI Agent  (Claude Code, Gemini CLI, Codex, ...)
        ↓
  Your codebase
```

You send a prompt from your phone or desktop. Viben receives it, forwards it to the AI agent running on your machine, and streams the response back to your chat. If the agent needs a permission (like writing a file or running a command), you get a button to approve or deny — right in the chat.

## Supported platforms

Viben ships with first-class support for **Telegram**, **Discord**, and **Slack**. Additional platforms can be added through the plugin system — see [Extending Viben](../extending/).

## Supported agents

Viben works with any agent that speaks the **Agent Client Protocol (ACP)**. That currently covers 28+ agents, including:

- Claude Code
- Gemini CLI
- OpenAI Codex
- GitHub Copilot
- Cursor
- Cline
- goose
- Amp
- ...and many more

If your favorite agent supports ACP, it works with Viben. If it doesn't yet, the plugin system lets you add adapters.

## What can you do with it?

- **Code from your phone.** Review a PR, ask an agent to fix a failing test, or kick off a refactor — while you're away from your desk.
- **Team collaboration with AI.** Shared Telegram groups or Discord channels where the whole team can interact with the same agent.
- **Code review via chat.** Paste a diff, ask for a review, get a detailed response without leaving the conversation.

## What is ACP?

ACP (Agent Client Protocol) is an open standard that defines how tools like editors and CLIs communicate with AI agents. It handles things like streaming responses, tool calls, and permission requests in a consistent way — so Viben doesn't need to know the internals of each agent. For a deeper dive, see the [ACP Guide](https://agentclientprotocol.com/).

## Your data stays on your machine

Viben is **self-hosted**. Everything — config, session history, logs — lives in `~/.viben/` on the machine where you run it. Nothing is sent to any Viben server. The AI agent itself may call external APIs (like Anthropic or OpenAI), but that's between you and the agent.
