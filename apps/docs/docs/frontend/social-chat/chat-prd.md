---
sidebar_position: 2
title: Chat Feature PRD
description: Desktop Chat Page Product Requirements Document
---

# Chat Feature PRD

> Product Requirements Document: Desktop Chat Page

---

## 1. Feature Overview

### 1.1 Objectives

Provide users with a unified chat entry point that integrates all conversation types (agent conversations, contact direct messages, group chats, Workspace Chat), using a classic WeChat-style layout.

### 1.2 User Value

- **One-stop Communication**: No need to switch between multiple pages, all conversations managed centrally
- **Familiar Experience**: WeChat-style layout with zero learning curve
- **AI Assistants at Your Fingertips**: Agents and human contacts on equal footing

---

## 2. Page Layout

### 2.1 Overall Structure

```
┌────────────────────────────────────────────────────────────────┐
│                          Chat Page                              │
├──────────────────┬─────────────────────────────────────────────┤
│                  │                                             │
│   Conversation   │              Conversation Area              │
│   List           │              (flex-1)                       │
│   (300px)        │                                             │
│                  │                                             │
│  ┌────────────┐  │  ┌─────────────────────────────────────────┐│
│  │ Search Box │  │  │  Conversation Title Bar                 ││
│  └────────────┘  │  │  - Avatar + Name                        ││
│                  │  │  - Online Status                        ││
│  ┌────────────┐  │  │  - Action Menu (...)                    ││
│  │ Pinned     │  │  └─────────────────────────────────────────┘│
│  │  ├─ Conv1  │  │  ┌─────────────────────────────────────────┐│
│  │  └─ Conv2  │  │  │                                         ││
│  └────────────┘  │  │           Message List Area             ││
│                  │  │                                         ││
│  ┌────────────┐  │  │  - Message Bubbles                      ││
│  │ Regular    │  │  │  - Time Separators                      ││
│  │  ├─ Conv3  │  │  │  - System Messages                      ││
│  │  ├─ Conv4  │  │  │                                         ││
│  │  └─ ...    │  │  │                                         ││
│  └────────────┘  │  └─────────────────────────────────────────┘│
│                  │  ┌─────────────────────────────────────────┐│
│                  │  │           Input Area                     ││
│                  │  │  - Toolbar (attachments, emoji, etc.)   ││
│                  │  │  - Text Input Box                       ││
│                  │  │  - Send Button                          ││
│                  │  └─────────────────────────────────────────┘│
│                  │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

### 2.2 Responsive Behavior

| Screen Width | Behavior |
|--------------|----------|
| ≥ 800px | Two-column layout (list + conversation) |
| < 800px | Single-column layout (list/conversation toggle) |

---

## 3. Conversation List

### 3.1 List Item Structure

```
┌─────────────────────────────────────────────────┐
│ [Avatar]  Conversation Name     Timestamp [Pin] │
│           Latest message preview...  [Unread]   │
└─────────────────────────────────────────────────┘
```

### 3.2 Conversation Types and Icons

| Type | Icon | Description |
|------|------|-------------|
| Agent Conversation | 🤖 | Conversation with a single agent |
| Contact Direct Message | 👤 | Private chat with a human contact |
| Group Chat | 👥 | Multi-person/multi-agent group chat |
| Workspace | 📁 | Workspace context conversation |

### 3.3 Sorting Rules

1. **Pinned Conversations**: Always at the top, sorted by pin time
2. **Regular Conversations**: Sorted by latest message time in descending order

### 3.4 List Interactions

| Action | Trigger | Effect |
|--------|---------|--------|
| Select Conversation | Click | Display conversation content on the right |
| Pin/Unpin | Right-click menu | Move to pinned/regular area |
| Delete Conversation | Right-click menu | Delete conversation (requires confirmation) |
| Mark as Read | Right-click menu | Clear unread count |
| Mute | Right-click menu | Disable message notifications |

---

## 4. Conversation Area

### 4.1 Title Bar

```
┌─────────────────────────────────────────────────────────────┐
│ [Avatar]  Conversation Name                     [📞] [📹] [⋮] │
│           Online Status / Member Count                       │
└─────────────────────────────────────────────────────────────┘
```

- **Avatar**: Conversation avatar (agent icon/user avatar/group avatar)
- **Name**: Conversation name
- **Status**:
  - Agent: Model type (e.g., "Claude 3.5 Sonnet")
  - Contact: Online/Offline
  - Group Chat: Member count
- **Action Buttons**:
  - Audio call (future)
  - Video call (future)
  - More menu (view profile, clear history, leave group, etc.)

### 4.2 Message List

#### Message Types

| Type | Description |
|------|-------------|
| Text Message | Plain text with Markdown support |
| Image Message | Supports preview and download |
| File Message | Displays filename and size, supports download |
| Code Message | Syntax highlighted display |
| System Message | Join group, leave group, name changes, etc. |

#### Message Bubbles

```
Sender (right side, theme color background):
                    ┌─────────────────────┐
                    │  Message content     │
                    └─────────────────────┘
                                    12:34 ✓✓

Receiver (left side, gray background):
┌─────────────────────┐
│  Message content     │
└─────────────────────┘
12:35
```

#### Special Displays

- **Time Separator**: Display time label for messages more than 5 minutes apart
- **Date Separator**: Display date label for messages on different days
- **@Mention Highlight**: Highlighted display for @someone text

### 4.3 Input Area

```
┌─────────────────────────────────────────────────────────────┐
│ [📎] [😊] [📷]                               [@] [Model Select] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Type a message...                              [Send]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Toolbar**:
  - Attachment: Send files
  - Emoji: Emoji picker
  - Image: Send images
  - @Mention: Mention members/agents in group chat
  - Model Select: Switch models during agent conversation
- **Input Box**: Multi-line text input, Ctrl+Enter for new line, Enter to send
- **Send Button**: Send message

---

## 5. Agent Conversation Features

### 5.1 Model Selection

When conversing with an agent, users can:

- View the currently used model
- Switch to other available models
- View token usage (optional display)

### 5.2 Conversation Context

- Support clearing context
- Support exporting conversation history
- Support restarting from a specific message

### 5.3 Tool Call Display

When an agent uses tools, display the tool call status:

```
┌─────────────────────────────────────────┐
│ 🔧 Executing: Searching files...         │
│    ├─ Searching "*.ts" files             │
│    └─ Found 23 files                     │
└─────────────────────────────────────────┘
```

---

## 6. Group Chat Features

### 6.1 @Mention Agents

In group chat, you can trigger agent responses by @agent-name:

```
User: @Claude-Assistant Please help me analyze this code

Claude-Assistant: Sure, let me take a look...
```

### 6.2 Agent Response Rules

- Only @mentioned agents will respond
- Agents can see all messages in the group as context
- When multiple agents are mentioned, they respond in mention order

### 6.3 Group Announcements

- Admins can publish group announcements
- Announcements are pinned at the top of the conversation area

---

## 7. User Stories

### 7.1 Basic Conversation

```
As a user
I want to quickly find a conversation in the chat list
So that I can continue previous exchanges

Acceptance Criteria:
- Search box supports searching by name
- Recent conversations automatically appear first
- Unread conversations have clear indicators
```

### 7.2 Agent Conversation

```
As a user
I want to have a conversation with an agent
So that I can get help from an AI assistant

Acceptance Criteria:
- Can select which agent to chat with
- Agent responses are displayed in the conversation
- Can view and switch the model being used
```

### 7.3 Group Collaboration

```
As a user
I want to @mention agents in group chat
So that team agents can participate in discussions

Acceptance Criteria:
- Typing @ displays member/agent list
- @mentioned agents automatically respond
- Other members can see agent replies
```

---

## 8. Non-Functional Requirements

### 8.1 Performance

- Conversation list load time < 500ms
- Message send response time < 200ms
- Support smooth scrolling for 10000+ historical messages

### 8.2 Usability

- Support keyboard shortcuts
- Support drag and drop to send files
- Provide retry option when message sending fails

### 8.3 Security

- Message content encrypted at rest
- Sensitive information (API Keys, etc.) displayed with masking

---

## 9. Future Plans

- [ ] Message search (global/single conversation)
- [ ] Message recall
- [ ] Message forwarding
- [ ] Voice messages
- [ ] Multi-device sync
