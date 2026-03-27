---
sidebar_position: 4
title: Contacts Feature Development Specification
description: Desktop Contacts Page Implementation Guide
---

# Contacts Feature Development Specification

> Development Specification: Desktop Contacts Page Implementation Guide

---

## 1. File Structure

```
apps/desktop/src/
├── pages/
│   └── contacts.tsx                # Contacts main page
├── components/
│   └── contacts/
│       ├── index.ts                # Export entry
│       ├── contact-list.tsx        # Contact list (left side)
│       ├── contact-group.tsx       # Collapsible group
│       ├── contact-item.tsx        # Contact list item
│       ├── agent-detail.tsx        # Agent detail panel
│       ├── group-detail.tsx        # Group chat detail panel
│       ├── team-detail.tsx         # Agent team detail panel
│       ├── create-agent-dialog.tsx # Create agent dialog
│       ├── create-group-dialog.tsx # Create group chat dialog
│       └── create-team-dialog.tsx  # Create team dialog
└── hooks/
    └── use-contacts.ts             # Contacts business logic
```

---

## 2. Main Page

```tsx
// apps/desktop/src/pages/contacts.tsx

import { useState } from "react";
import { ContactList } from "@/components/contacts/contact-list";
import { AgentDetail } from "@/components/contacts/agent-detail";
import { GroupDetail } from "@/components/contacts/group-detail";
import { TeamDetail } from "@/components/contacts/team-detail";
import { useSocialChatStore } from "@/stores/social-chat-store";

export default function ContactsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"agent" | "group" | "team" | null>(null);

  const handleSelect = (id: string, type: "agent" | "group" | "team") => {
    setSelectedId(id);
    setSelectedType(type);
  };

  return (
    <div className="flex h-full">
      {/* Left side list */}
      <div className="w-[300px] flex-shrink-0 border-r border-border">
        <ContactList onSelect={handleSelect} selectedId={selectedId} />
      </div>

      {/* Right side detail */}
      <div className="flex-1 min-w-0">
        {selectedType === "agent" && <AgentDetail agentId={selectedId!} />}
        {selectedType === "group" && <GroupDetail groupId={selectedId!} />}
        {selectedType === "team" && <TeamDetail teamId={selectedId!} />}
        {!selectedType && <EmptyState />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Select a contact to view details
    </div>
  );
}
```

---

## 3. Core Components

### 3.1 ContactList

```tsx
// apps/desktop/src/components/contacts/contact-list.tsx

import { ContactGroup } from "./contact-group";
import { useSocialChatStore } from "@/stores/social-chat-store";

interface ContactListProps {
  onSelect: (id: string, type: "agent" | "group" | "team") => void;
  selectedId: string | null;
}

export function ContactList({ onSelect, selectedId }: ContactListProps) {
  const { getAgents, getGroups, getTeams, collapsedGroups, toggleGroup } = useSocialChatStore();

  return (
    <div className="flex flex-col h-full">
      {/* Search box */}
      <div className="p-3 border-b border-border">
        <Input placeholder="Search..." className="w-full" />
      </div>

      <ScrollArea className="flex-1">
        {/* Agents group */}
        <ContactGroup
          title="Agents"
          count={getAgents().length}
          collapsed={collapsedGroups.agents}
          onToggle={() => toggleGroup("agents")}
          onAdd={() => {/* Open create dialog */}}
        >
          {getAgents().map((agent) => (
            <ContactItem
              key={agent.id}
              contact={agent}
              isSelected={selectedId === agent.id}
              onClick={() => onSelect(agent.id, "agent")}
            />
          ))}
        </ContactGroup>

        {/* Group chats group */}
        <ContactGroup
          title="Group Chats"
          count={getGroups().length}
          collapsed={collapsedGroups.groups}
          onToggle={() => toggleGroup("groups")}
          onAdd={() => {/* Open create dialog */}}
        >
          {getGroups().map((group) => (
            <ContactItem
              key={group.id}
              contact={group}
              isSelected={selectedId === group.id}
              onClick={() => onSelect(group.id, "group")}
            />
          ))}
        </ContactGroup>

        {/* Agent teams group */}
        <ContactGroup
          title="Agent Teams"
          count={getTeams().length}
          collapsed={collapsedGroups.teams}
          onToggle={() => toggleGroup("teams")}
          onAdd={() => {/* Open create dialog */}}
        >
          {getTeams().map((team) => (
            <ContactItem
              key={team.id}
              contact={{ id: team.id, type: "team", name: team.name }}
              isSelected={selectedId === team.id}
              onClick={() => onSelect(team.id, "team")}
            />
          ))}
        </ContactGroup>
      </ScrollArea>
    </div>
  );
}
```

### 3.2 ContactGroup

```tsx
// apps/desktop/src/components/contacts/contact-group.tsx

import { ChevronDown, ChevronRight, Plus } from "lucide-react";

interface ContactGroupProps {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}

export function ContactGroup({
  title,
  count,
  collapsed,
  onToggle,
  onAdd,
  children,
}: ContactGroupProps) {
  return (
    <div className="py-1">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-sm">({count})</span>
        </div>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAdd(); }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {!collapsed && <div className="pl-2">{children}</div>}
    </div>
  );
}
```

### 3.3 AgentDetail

```tsx
// apps/desktop/src/components/contacts/agent-detail.tsx

import { useSocialChatStore } from "@/stores/social-chat-store";
import { useNavigate } from "react-router-dom";

interface AgentDetailProps {
  agentId: string;
}

export function AgentDetail({ agentId }: AgentDetailProps) {
  const { getContact, deleteContact } = useSocialChatStore();
  const navigate = useNavigate();
  const agent = getContact(agentId);

  if (!agent || agent.type !== "agent") return null;

  const handleChat = () => {
    // Create or open conversation with this agent, navigate to chat page
    navigate(`/chat?agent=${agentId}`);
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex flex-col items-center pb-6 border-b border-border">
        <Avatar className="w-20 h-20 mb-4">
          <AvatarImage src={agent.avatar} />
          <AvatarFallback>🤖</AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-semibold">{agent.name}</h2>
        <p className="text-sm text-muted-foreground">Local Agent</p>
      </div>

      {/* Basic Information */}
      <div className="py-4 border-b border-border">
        <h3 className="font-medium mb-3">Basic Information</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Model</dt>
            <dd>{agent.agent?.model}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">System Prompt</dt>
            <dd className="text-xs bg-muted p-2 rounded">{agent.agent?.system_prompt}</dd>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto pt-4">
        <Button onClick={handleChat} className="flex-1">
          <MessageSquare className="w-4 h-4 mr-2" />
          Send Message
        </Button>
        <Button variant="outline">
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button variant="destructive" size="icon" onClick={() => deleteContact(agentId)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## 4. Navigation Integration

```tsx
// apps/desktop/src/components/layout/sidebar.tsx

const navigationItems = [
  { id: "chat", label: "Chat", icon: MessageSquare, href: "/chat" },
  { id: "contacts", label: "Contacts", icon: Users, href: "/contacts" },
  // ...
];
```

---

## 5. Key Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Click group title | Single click | Expand/collapse group |
| Click + button | Single click | Open create dialog |
| Click contact | Single click | Show detail on right side |
| Click "Send Message" | Single click | Navigate to chat page |
| Click "Delete" | Single click | Delete after confirmation |

---

## 6. Integration with Existing System

- Agent data reuses `localAgents` from `useAgentsStore`
- When navigating to chat, reuses `useSocialChatStore.createConversation`
- Detail panel reuses Agent edit components
