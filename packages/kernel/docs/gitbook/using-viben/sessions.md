# Sessions

A session is an isolated conversation between you and an AI agent. Each session has its own context window, working directory, and state. On Telegram, sessions get their own forum topic. On Discord, sessions get their own thread.

## Creating a session

Use `/new` to start a session:

```
/new                           # interactive — choose agent and workspace
/new claude ~/code/my-project  # create directly
```

If you have multiple agents installed, an inline keyboard lets you pick one. You then choose or type a workspace directory — the folder the agent will read, write, and run code in.

## Session lifecycle

A session goes through several stages during its life:

1. **Starting up** — The session is being created and the AI agent is warming up. This usually takes a few seconds.
2. **Active** — The session is ready. You can send messages and the agent will respond. This is where you spend most of your time.
3. **Done** — The agent finished its work. The session topic stays open for reference.

Sometimes things go differently:

- **Error** — Something went wrong, but you can usually recover by sending another message. Viben will try to reconnect the agent automatically.
- **Cancelled** — You stopped the session with `/cancel`. The session topic stays open and you can start a new one.

Use `/status` inside a session topic to see the current state.

## Auto-naming

After you send your first message, Viben silently asks the agent to generate a 5-word title. The session topic or thread is renamed automatically. You never see this internal prompt — it runs in the background and does not affect your conversation.

If naming fails, the session falls back to `Session <id>`.

## Concurrent sessions

You can run multiple sessions at the same time. The default limit is 20 concurrent active sessions. This is configurable via `maxConcurrentSessions` in your config file.

If the limit is reached, `/new` returns an error message. Cancel or finish an existing session to free a slot.

## Session timeout

Sessions have an inactivity timeout (default: 60 minutes). If no prompt is sent within the timeout period, the session is automatically cancelled. The timeout is configurable.

## Resuming sessions

Sessions that are `finished` or have been idle since a restart can often be resumed by simply sending a message in the existing topic or thread. Viben will reconnect to the agent process if possible.

Sessions that went offline (e.g., after a server restart) are automatically resumed when you send a message to their topic. This happens transparently — you do not need to manually restart the session.

For richer resume with full conversation history, use `/resume` (Telegram only). This loads context from Entire checkpoints or Viben's built-in history recorder — previous sessions' work is injected into the new session's context window. See the `/resume` section in [Chat Commands](chat-commands.md) for query formats.

## Session settings

Some agents let you change settings mid-conversation — like switching between different modes or models:

```
/mode                          # show available modes (e.g., code, architect)
/model                         # show available models
/thought                       # toggle thinking/reasoning mode
/dangerous                     # toggle bypass permissions
```

Available options depend on the agent you are using. When an agent updates its available options, the session reflects the changes automatically.

## Cancelling a prompt

`/cancel` inside a session topic aborts the running prompt and clears the queue. The session stays in `active` state — you can send another message immediately.

This does not end the session. If you want to permanently stop a session and remove its topic, use `/archive`.

## Starting a new chat in the same session

`/newchat` creates a fresh conversation window with the same agent and workspace, without going through the full setup flow. Run it inside an existing session topic. A new topic is created and a link is posted in the original topic.

## Viewing all sessions

Use `/sessions` to list every session with its status emoji:

- Green circle — active
- Yellow circle — initializing
- Check mark — finished
- Red X — error
- Stop sign — cancelled

On Telegram, cleanup buttons let you bulk-remove finished, errored, or all sessions from the list and their topics from the group.
