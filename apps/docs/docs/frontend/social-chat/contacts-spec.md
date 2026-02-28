---
sidebar_position: 4
title: 联系人功能开发规范
description: Desktop 联系人页面实现指南
---

# 联系人功能开发规范

> 开发规范：Desktop 联系人页面实现指南

---

## 1. 文件结构

```
apps/desktop/src/
├── pages/
│   └── contacts.tsx                # 联系人主页面
├── components/
│   └── contacts/
│       ├── index.ts                # 导出入口
│       ├── contact-list.tsx        # 联系人列表（左侧）
│       ├── contact-group.tsx       # 可折叠分组
│       ├── contact-item.tsx        # 联系人列表项
│       ├── agent-detail.tsx        # 智能体详情面板
│       ├── group-detail.tsx        # 群聊详情面板
│       ├── team-detail.tsx         # 智能体团队详情面板
│       ├── create-agent-dialog.tsx # 创建智能体对话框
│       ├── create-group-dialog.tsx # 创建群聊对话框
│       └── create-team-dialog.tsx  # 创建团队对话框
└── hooks/
    └── use-contacts.ts             # 联系人业务逻辑
```

---

## 2. 主页面

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
      {/* 左侧列表 */}
      <div className="w-[300px] flex-shrink-0 border-r border-border">
        <ContactList onSelect={handleSelect} selectedId={selectedId} />
      </div>

      {/* 右侧详情 */}
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
      选择一个联系人查看详情
    </div>
  );
}
```

---

## 3. 核心组件

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
      {/* 搜索框 */}
      <div className="p-3 border-b border-border">
        <Input placeholder="搜索..." className="w-full" />
      </div>

      <ScrollArea className="flex-1">
        {/* 智能体分组 */}
        <ContactGroup
          title="智能体"
          count={getAgents().length}
          collapsed={collapsedGroups.agents}
          onToggle={() => toggleGroup("agents")}
          onAdd={() => {/* 打开创建对话框 */}}
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

        {/* 群聊分组 */}
        <ContactGroup
          title="群聊"
          count={getGroups().length}
          collapsed={collapsedGroups.groups}
          onToggle={() => toggleGroup("groups")}
          onAdd={() => {/* 打开创建对话框 */}}
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

        {/* 智能体团队分组 */}
        <ContactGroup
          title="智能体团队"
          count={getTeams().length}
          collapsed={collapsedGroups.teams}
          onToggle={() => toggleGroup("teams")}
          onAdd={() => {/* 打开创建对话框 */}}
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
    // 创建或打开与该智能体的对话，跳转到聊天页面
    navigate(`/chat?agent=${agentId}`);
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* 头部 */}
      <div className="flex flex-col items-center pb-6 border-b border-border">
        <Avatar className="w-20 h-20 mb-4">
          <AvatarImage src={agent.avatar} />
          <AvatarFallback>🤖</AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-semibold">{agent.name}</h2>
        <p className="text-sm text-muted-foreground">本地智能体</p>
      </div>

      {/* 基础信息 */}
      <div className="py-4 border-b border-border">
        <h3 className="font-medium mb-3">基础信息</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">模型</dt>
            <dd>{agent.agent?.model}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">系统提示</dt>
            <dd className="text-xs bg-muted p-2 rounded">{agent.agent?.system_prompt}</dd>
          </div>
        </dl>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-auto pt-4">
        <Button onClick={handleChat} className="flex-1">
          <MessageSquare className="w-4 h-4 mr-2" />
          发消息
        </Button>
        <Button variant="outline">
          <Pencil className="w-4 h-4 mr-2" />
          编辑
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

## 4. 导航集成

```tsx
// apps/desktop/src/components/layout/sidebar.tsx

const navigationItems = [
  { id: "chat", label: "聊天", icon: MessageSquare, href: "/chat" },
  { id: "contacts", label: "联系人", icon: Users, href: "/contacts" },
  // ...
];
```

---

## 5. 关键交互

| 操作 | 触发 | 结果 |
|------|------|------|
| 点击分组标题 | 单击 | 展开/折叠分组 |
| 点击 + 按钮 | 单击 | 打开创建对话框 |
| 点击联系人 | 单击 | 右侧显示详情 |
| 点击"发消息" | 单击 | 跳转聊天页面 |
| 点击"删除" | 单击 | 确认后删除 |

---

## 6. 与现有系统集成

- 智能体数据复用 `useAgentsStore` 中的 `localAgents`
- 跳转聊天时复用 `useSocialChatStore.createConversation`
- 详情面板复用 Agent 编辑组件
