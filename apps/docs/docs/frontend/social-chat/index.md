---
sidebar_position: 1
title: Social Chat Module
description: Social chat feature module for the Desktop application
---

# Social Chat Module Specification

> Social chat feature for Desktop application, including two core pages: [Chat] and [Contacts].

---

## Overview

This module adds WeChat-like social chat capabilities to Viben Desktop, unifying all conversation entry points (agent conversations, contact private chats, group chats) and providing contact management functionality.

### Core Features

- **Unified Chat Entry**: Integrates Workspace Chat, agent conversations, private chats, and group chats
- **WeChat-like UI**: Classic layout with list on the left and conversation/details on the right
- **Deep Agent Integration**: Agents can be contacts, join group chats, and form teams

---

## Documentation Index

| Document | Description | Status |
|----------|-------------|--------|
| Module Overview (this document) | Module overview and architecture | ✅ Complete |
| [Chat Feature PRD](./chat-prd.md) | Chat feature product requirements | ✅ Complete |
| [Chat Feature Spec](./chat-spec.md) | Chat feature development specification | ✅ Complete |
| [Contacts Feature Spec](./contacts-spec.md) | Contacts feature development specification | ✅ Complete |
| Contacts Feature PRD | Contacts feature product requirements | 📋 Planned |
| Agent Teams PRD | Agent teams product requirements | 📋 Planned |
| Data Model Design | Detailed data model design | 📋 Planned |

---

## Feature Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Desktop Left Navigation              │
├─────────────────────────────────────────────────────────┤
│  [Chat]  [Contacts]  [Kanban]  [Marketplace]  [Settings]  ...      │
└─────────────────────────────────────────────────────────┘
         │          │
         ▼          ▼
┌─────────────┐ ┌─────────────────────────────────────────┐
│   Chat Page   │ │              Contacts Page              │
├─────────────┤ ├─────────────────────────────────────────┤
│ Conversation │ │ Group List                              │
│ List         │ │ ├─ Agents (collapsible)                 │
│ - Agent Chat │ │ │   └─ Locally created agents           │
│ - Private    │ │ ├─ Group Chats (collapsible)            │
│ - Group Chat │ │ │   └─ Created group chat list          │
│ - Workspace  │ │ └─ Agent Teams (collapsible)            │
│              │ │     └─ Orchestrated workflow teams      │
│ [Pinnable]   │ │                                         │
└─────────────┘ └─────────────────────────────────────────┘
```

---

## Relationship with Existing Features

### Workspace Chat Integration

The existing Workspace Chat will be integrated as a special conversation type into the unified chat entry:

```
Chat List
├─ Pinned Conversations
│   └─ Workspace: My Project  ← Workspace Chat conversation
├─ Regular Conversations
│   ├─ Agent: Claude Assistant
│   ├─ Private: John Doe
│   └─ Group: Development Team
```

### Agent System Integration

Agents exist in three forms within this module:

1. **As Contacts**: Appear in the Contacts - Agents group
2. **As Conversation Partners**: Can initiate direct conversations
3. **As Group Members**: Can be invited to join group chats, triggered by @mentions

---

## Design Principles

1. **Familiar Interaction**: Adopts WeChat-style layout to reduce user learning curve
2. **Agent First**: Agents are first-class citizens, with equal status to human contacts
3. **Unified Context**: All conversations share the same message components and interaction logic
4. **Progressive Complexity**: Basic chat is simple and easy to use, advanced features (team orchestration) are optional

---

## Technical Decisions

| Decision Point | Choice | Rationale |
|----------------|--------|-----------|
| Message Components | Reuse existing Chat components | Maintain consistency, reduce duplicate code |
| State Management | Zustand store | Consistent with existing architecture |
| Real-time Communication | WebSocket | Support multi-device sync (future) |
| Workflow Orchestration | Visual drag-and-drop | n8n/Dify-like experience |

---

## Implementation Phases

### Phase 1: Basic Chat (MVP)

- [ ] Chat page layout (list on left, conversation on right)
- [ ] Agent conversations (reuse existing capabilities)
- [ ] Conversation list (pinned + time sorted)

### Phase 2: Contact Management

- [ ] Contacts page layout (list on left, details on right)
- [ ] Agent list (locally created)
- [ ] Group chat list and management

### Phase 3: Group Chat Features

- [ ] Create group chats
- [ ] Invite agents to groups
- [ ] @mention triggers agent responses

### Phase 4: Agent Teams

- [ ] Team creation and orchestration
- [ ] Visual workflow editor
- [ ] Team execution and monitoring

---

## Related Documentation

- [Chat Integration](../chat-integration.md) - Workspace chat integration specification
- [Chat Input Components](../chat-input-components.md) - Unified ChatInput component
- [Design System](../design-system.md) - Viben design system
- [Component Guide](../components.md) - React component development guide
