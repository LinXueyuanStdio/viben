/**
 * GroupChat model - file-based group chat storage
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../../config/yaml";
import { NotFoundError } from "../../error";
import type {
  GroupChat,
  GroupChatMember,
  GroupChatMessage,
  MemberType,
  MemberRole,
  MessageContentType,
} from "../types";

// ============================================================================
// File Storage
// ============================================================================

interface GroupChatsFile {
  groupChats: Record<string, GroupChatEntry>;
  members: Record<string, GroupChatMemberEntry>;
  messages: Record<string, GroupChatMessageEntry>;
}

interface GroupChatEntry {
  name: string;
  description?: string;
  taskId?: string;
  createdBy: string;
  created_at: string;
  updated_at: string;
}

interface GroupChatMemberEntry {
  groupChatId: string;
  memberType: MemberType;
  memberId: string;
  displayName: string;
  role: MemberRole;
  joined_at: string;
  lastSeenAt?: string;
}

interface GroupChatMessageEntry {
  groupChatId: string;
  senderId: string;
  senderType: MemberType;
  senderName: string;
  contentType: MessageContentType;
  content: string;
  mentions?: string[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

function getGroupChatsPath(): string {
  return join(getStateDir(), "group-chats.yaml");
}

async function loadGroupChats(): Promise<GroupChatsFile> {
  const path = getGroupChatsPath();
  if (!fileExists(path)) {
    return { groupChats: {}, members: {}, messages: {} };
  }
  const data = await readYaml<GroupChatsFile>(path);
  return data || { groupChats: {}, members: {}, messages: {} };
}

async function saveGroupChats(data: GroupChatsFile): Promise<void> {
  await ensureDir(getStateDir());
  await writeYaml(getGroupChatsPath(), data);
}

// ============================================================================
// GroupChat Model
// ============================================================================

export interface CreateGroupChat {
  id?: string;
  name: string;
  description?: string;
  taskId?: string;
  createdBy: string;
}

export interface UpdateGroupChat {
  name?: string;
  description?: string;
  taskId?: string;
}

export const GroupChatModel = {
  async findAll(): Promise<GroupChat[]> {
    const data = await loadGroupChats();
    return Object.entries(data.groupChats)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async findById(id: string): Promise<GroupChat | null> {
    const data = await loadGroupChats();
    const entry = data.groupChats[id];
    if (!entry) return null;
    return { id, ...entry };
  },

  async findByTaskId(taskId: string): Promise<GroupChat[]> {
    const all = await this.findAll();
    return all.filter((gc) => gc.taskId === taskId);
  },

  async create(input: CreateGroupChat): Promise<GroupChat> {
    const data = await loadGroupChats();
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const entry: GroupChatEntry = {
      name: input.name,
      description: input.description,
      taskId: input.taskId,
      createdBy: input.createdBy,
      created_at: now,
      updated_at: now,
    };

    data.groupChats[id] = entry;
    await saveGroupChats(data);
    return { id, ...entry };
  },

  async update(id: string, input: UpdateGroupChat): Promise<GroupChat> {
    const data = await loadGroupChats();
    const entry = data.groupChats[id];
    if (!entry) throw new NotFoundError("GroupChat", id);

    const now = new Date().toISOString();
    const updated: GroupChatEntry = {
      name: input.name ?? entry.name,
      description: input.description ?? entry.description,
      taskId: input.taskId ?? entry.taskId,
      createdBy: entry.createdBy,
      created_at: entry.created_at,
      updated_at: now,
    };

    data.groupChats[id] = updated;
    await saveGroupChats(data);
    return { id, ...updated };
  },

  async delete(id: string): Promise<boolean> {
    const data = await loadGroupChats();
    if (!data.groupChats[id]) return false;

    // Delete associated members and messages
    for (const [memberId, member] of Object.entries(data.members)) {
      if (member.groupChatId === id) {
        delete data.members[memberId];
      }
    }
    for (const [messageId, message] of Object.entries(data.messages)) {
      if (message.groupChatId === id) {
        delete data.messages[messageId];
      }
    }
    delete data.groupChats[id];

    await saveGroupChats(data);
    return true;
  },
};

// ============================================================================
// GroupChatMember Model
// ============================================================================

export interface CreateGroupChatMember {
  id?: string;
  groupChatId: string;
  memberType: MemberType;
  memberId: string;
  displayName: string;
  role?: MemberRole;
}

export interface UpdateGroupChatMember {
  displayName?: string;
  role?: MemberRole;
  lastSeenAt?: string;
}

export const GroupChatMemberModel = {
  async findAll(): Promise<GroupChatMember[]> {
    const data = await loadGroupChats();
    return Object.entries(data.members)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
  },

  async findById(id: string): Promise<GroupChatMember | null> {
    const data = await loadGroupChats();
    const entry = data.members[id];
    if (!entry) return null;
    return { id, ...entry };
  },

  async findByGroupChatId(groupChatId: string): Promise<GroupChatMember[]> {
    const all = await this.findAll();
    return all.filter((m) => m.groupChatId === groupChatId);
  },

  async findByMember(memberType: MemberType, memberId: string): Promise<GroupChatMember[]> {
    const all = await this.findAll();
    return all.filter((m) => m.memberType === memberType && m.memberId === memberId);
  },

  async create(input: CreateGroupChatMember): Promise<GroupChatMember> {
    const data = await loadGroupChats();
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const entry: GroupChatMemberEntry = {
      groupChatId: input.groupChatId,
      memberType: input.memberType,
      memberId: input.memberId,
      displayName: input.displayName,
      role: input.role || "member",
      joined_at: now,
    };

    data.members[id] = entry;
    await saveGroupChats(data);
    return { id, ...entry };
  },

  async update(id: string, input: UpdateGroupChatMember): Promise<GroupChatMember> {
    const data = await loadGroupChats();
    const entry = data.members[id];
    if (!entry) throw new NotFoundError("GroupChatMember", id);

    const updated: GroupChatMemberEntry = {
      ...entry,
      displayName: input.displayName ?? entry.displayName,
      role: input.role ?? entry.role,
      lastSeenAt: input.lastSeenAt ?? entry.lastSeenAt,
    };

    data.members[id] = updated;
    await saveGroupChats(data);
    return { id, ...updated };
  },

  async updateLastSeen(id: string): Promise<void> {
    await this.update(id, { lastSeenAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<boolean> {
    const data = await loadGroupChats();
    if (!data.members[id]) return false;
    delete data.members[id];
    await saveGroupChats(data);
    return true;
  },
};

// ============================================================================
// GroupChatMessage Model
// ============================================================================

export interface CreateGroupChatMessage {
  id?: string;
  groupChatId: string;
  senderId: string;
  senderType: MemberType;
  senderName: string;
  contentType?: MessageContentType;
  content: string;
  mentions?: string[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export const GroupChatMessageModel = {
  async findAll(): Promise<GroupChatMessage[]> {
    const data = await loadGroupChats();
    return Object.entries(data.messages)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  async findById(id: string): Promise<GroupChatMessage | null> {
    const data = await loadGroupChats();
    const entry = data.messages[id];
    if (!entry) return null;
    return { id, ...entry };
  },

  async findByGroupChatId(
    groupChatId: string,
    limit?: number,
    before?: string
  ): Promise<GroupChatMessage[]> {
    const all = await this.findAll();
    let filtered = all.filter((m) => m.groupChatId === groupChatId);

    if (before) {
      const beforeTime = new Date(before).getTime();
      filtered = filtered.filter((m) => new Date(m.created_at).getTime() < beforeTime);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  },

  async create(input: CreateGroupChatMessage): Promise<GroupChatMessage> {
    const data = await loadGroupChats();
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const entry: GroupChatMessageEntry = {
      groupChatId: input.groupChatId,
      senderId: input.senderId,
      senderType: input.senderType,
      senderName: input.senderName,
      contentType: input.contentType || "text",
      content: input.content,
      mentions: input.mentions,
      replyTo: input.replyTo,
      metadata: input.metadata,
      created_at: now,
    };

    data.messages[id] = entry;
    await saveGroupChats(data);
    return { id, ...entry };
  },

  async delete(id: string): Promise<boolean> {
    const data = await loadGroupChats();
    if (!data.messages[id]) return false;
    delete data.messages[id];
    await saveGroupChats(data);
    return true;
  },

  async deleteByGroupChatId(groupChatId: string): Promise<number> {
    const data = await loadGroupChats();
    let count = 0;
    for (const [id, message] of Object.entries(data.messages)) {
      if (message.groupChatId === groupChatId) {
        delete data.messages[id];
        count++;
      }
    }
    await saveGroupChats(data);
    return count;
  },
};
