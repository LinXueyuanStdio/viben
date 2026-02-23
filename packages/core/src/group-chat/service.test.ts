/**
 * Group Chat Service Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { GroupChatService } from "./service";

describe("GroupChatService", () => {
  let service: GroupChatService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-test-"));
    service = new GroupChatService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createGroupChat", () => {
    it("should create a new group chat", async () => {
      const groupChat = await service.createGroupChat("user-1", {
        name: "Test Group",
        description: "A test group chat",
      });

      expect(groupChat.id).toBeDefined();
      expect(groupChat.name).toBe("Test Group");
      expect(groupChat.description).toBe("A test group chat");
      expect(groupChat.createdBy).toBe("user-1");
      expect(groupChat.createdAt).toBeDefined();
      expect(groupChat.updatedAt).toBeDefined();
    });

    it("should create group chat with custom id", async () => {
      const groupChat = await service.createGroupChat("user-1", {
        id: "custom-id",
        name: "Custom ID Group",
      });

      expect(groupChat.id).toBe("custom-id");
    });

    it("should create group chat with initial members", async () => {
      const groupChat = await service.createGroupChat("user-1", {
        name: "Group with Members",
        members: [
          { type: "human", refId: "user-1", displayName: "Alice", role: "admin" },
          { type: "agent", refId: "agent-1", displayName: "Bot" },
        ],
      });

      const members = await service.getMembers(groupChat.id);
      expect(members).toHaveLength(2);
      expect(members[0].displayName).toBe("Alice");
      expect(members[0].role).toBe("admin");
      expect(members[1].displayName).toBe("Bot");
      expect(members[1].role).toBe("member");
    });

    it("should throw when creating duplicate group chat", async () => {
      await service.createGroupChat("user-1", {
        id: "duplicate-id",
        name: "First",
      });

      await expect(
        service.createGroupChat("user-1", {
          id: "duplicate-id",
          name: "Second",
        })
      ).rejects.toThrow("Group chat already exists");
    });
  });

  describe("getGroupChat", () => {
    it("should return group chat by id", async () => {
      const created = await service.createGroupChat("user-1", {
        name: "Test Group",
      });

      const found = await service.getGroupChat(created.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Test Group");
    });

    it("should return null for non-existent group chat", async () => {
      const found = await service.getGroupChat("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("listGroupChats", () => {
    it("should list all group chats sorted by creation time", async () => {
      // Add small delays to ensure different timestamps
      await service.createGroupChat("user-1", { name: "Group 1" });
      await new Promise((r) => setTimeout(r, 10));
      await service.createGroupChat("user-1", { name: "Group 2" });
      await new Promise((r) => setTimeout(r, 10));
      await service.createGroupChat("user-1", { name: "Group 3" });

      const list = await service.listGroupChats();
      expect(list).toHaveLength(3);
      // Most recent first
      expect(list[0].name).toBe("Group 3");
      expect(list[2].name).toBe("Group 1");
    });

    it("should return empty array when no group chats exist", async () => {
      const list = await service.listGroupChats();
      expect(list).toEqual([]);
    });
  });

  describe("updateGroupChat", () => {
    it("should update group chat name", async () => {
      const created = await service.createGroupChat("user-1", {
        name: "Original Name",
      });

      // Wait to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      const updated = await service.updateGroupChat(created.id, {
        name: "New Name",
      });

      expect(updated.name).toBe("New Name");
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it("should update group chat settings", async () => {
      const created = await service.createGroupChat("user-1", {
        name: "Test",
        settings: { maxConcurrentAgents: 3 },
      });

      const updated = await service.updateGroupChat(created.id, {
        settings: { agentTimeout: 30000 },
      });

      expect(updated.settings?.maxConcurrentAgents).toBe(3);
      expect(updated.settings?.agentTimeout).toBe(30000);
    });

    it("should throw when updating non-existent group chat", async () => {
      await expect(
        service.updateGroupChat("non-existent", { name: "New" })
      ).rejects.toThrow("Group chat not found");
    });
  });

  describe("deleteGroupChat", () => {
    it("should delete group chat", async () => {
      const created = await service.createGroupChat("user-1", {
        name: "To Delete",
      });

      await service.deleteGroupChat(created.id);

      const found = await service.getGroupChat(created.id);
      expect(found).toBeNull();
    });

    it("should throw when deleting non-existent group chat", async () => {
      await expect(service.deleteGroupChat("non-existent")).rejects.toThrow(
        "Group chat not found"
      );
    });
  });

  describe("Members", () => {
    let groupChatId: string;

    beforeEach(async () => {
      const groupChat = await service.createGroupChat("user-1", {
        name: "Test Group",
      });
      groupChatId = groupChat.id;
    });

    it("should add a member", async () => {
      const member = await service.addMember(
        groupChatId,
        "human",
        "user-2",
        "Bob",
        "member"
      );

      expect(member.id).toBeDefined();
      expect(member.type).toBe("human");
      expect(member.refId).toBe("user-2");
      expect(member.displayName).toBe("Bob");
      expect(member.role).toBe("member");
    });

    it("should remove a member", async () => {
      const member = await service.addMember(
        groupChatId,
        "agent",
        "agent-1",
        "Assistant"
      );

      await service.removeMember(groupChatId, member.id);

      const members = await service.getMembers(groupChatId);
      expect(members).toHaveLength(0);
    });

    it("should update member last seen", async () => {
      const member = await service.addMember(
        groupChatId,
        "human",
        "user-2",
        "Bob"
      );

      await service.updateMemberLastSeen(groupChatId, member.id);

      const members = await service.getMembers(groupChatId);
      expect(members[0].lastSeenAt).toBeDefined();
    });
  });

  describe("Sessions", () => {
    let groupChatId: string;

    beforeEach(async () => {
      const groupChat = await service.createGroupChat("user-1", {
        name: "Test Group",
      });
      groupChatId = groupChat.id;
    });

    it("should create a session", async () => {
      const session = await service.createSession(groupChatId, {
        name: "Test Session",
      });

      expect(session.id).toBeDefined();
      expect(session.groupChatId).toBe(groupChatId);
      expect(session.name).toBe("Test Session");
      expect(session.status).toBe("active");
    });

    it("should get a session", async () => {
      const created = await service.createSession(groupChatId, {
        name: "Test",
      });

      const found = await service.getSession(groupChatId, created.id);
      expect(found?.name).toBe("Test");
    });

    it("should list sessions", async () => {
      await service.createSession(groupChatId, { name: "Session 1" });
      await service.createSession(groupChatId, { name: "Session 2" });

      const sessions = await service.listSessions(groupChatId);
      expect(sessions).toHaveLength(2);
    });

    it("should update a session", async () => {
      const session = await service.createSession(groupChatId, {
        name: "Original",
      });

      const updated = await service.updateSession(groupChatId, session.id, {
        name: "Updated",
        status: "paused",
      });

      expect(updated.name).toBe("Updated");
      expect(updated.status).toBe("paused");
    });

    it("should delete a session", async () => {
      const session = await service.createSession(groupChatId, {
        name: "To Delete",
      });

      await service.deleteSession(groupChatId, session.id);

      const found = await service.getSession(groupChatId, session.id);
      expect(found).toBeNull();
    });
  });

  describe("Messages", () => {
    let groupChatId: string;
    let sessionId: string;

    beforeEach(async () => {
      const groupChat = await service.createGroupChat("user-1", {
        name: "Test Group",
      });
      groupChatId = groupChat.id;

      const session = await service.createSession(groupChatId, {
        name: "Test Session",
      });
      sessionId = session.id;
    });

    it("should send a message", async () => {
      const message = await service.sendMessage(
        groupChatId,
        sessionId,
        "user-1",
        "human",
        "Alice",
        { content: "Hello, world!" }
      );

      expect(message.id).toBeDefined();
      expect(message.senderId).toBe("user-1");
      expect(message.senderType).toBe("human");
      expect(message.senderName).toBe("Alice");
      expect(message.content).toBe("Hello, world!");
      expect(message.type).toBe("user");
    });

    it("should get messages", async () => {
      await service.sendMessage(
        groupChatId,
        sessionId,
        "user-1",
        "human",
        "Alice",
        { content: "Message 1" }
      );
      await service.sendMessage(
        groupChatId,
        sessionId,
        "agent-1",
        "agent",
        "Bot",
        { content: "Message 2", type: "text" }
      );

      const messages = await service.getMessages(groupChatId, sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Message 1");
      expect(messages[1].content).toBe("Message 2");
    });

    it("should filter messages by sender", async () => {
      await service.sendMessage(
        groupChatId,
        sessionId,
        "user-1",
        "human",
        "Alice",
        { content: "From Alice" }
      );
      await service.sendMessage(
        groupChatId,
        sessionId,
        "user-2",
        "human",
        "Bob",
        { content: "From Bob" }
      );

      const messages = await service.getMessages(groupChatId, sessionId, {
        senderId: "user-1",
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("From Alice");
    });

    it("should limit messages", async () => {
      for (let i = 0; i < 5; i++) {
        await service.sendMessage(
          groupChatId,
          sessionId,
          "user-1",
          "human",
          "Alice",
          { content: `Message ${i}` }
        );
      }

      const messages = await service.getMessages(groupChatId, sessionId, {
        limit: 2,
      });
      expect(messages).toHaveLength(2);
      // Should get last 2 messages
      expect(messages[0].content).toBe("Message 3");
      expect(messages[1].content).toBe("Message 4");
    });
  });

  describe("Agent Responses", () => {
    let groupChatId: string;
    let sessionId: string;

    beforeEach(async () => {
      const groupChat = await service.createGroupChat("user-1", {
        name: "Test Group",
      });
      groupChatId = groupChat.id;

      const session = await service.createSession(groupChatId, {
        name: "Test Session",
      });
      sessionId = session.id;
    });

    it("should add and get agent responses", async () => {
      await service.addAgentResponse(groupChatId, sessionId, {
        id: "resp-1",
        agentId: "agent-1",
        agentName: "Bot",
        sessionId,
        content: "Response content",
        status: "completed",
        startedAt: new Date().toISOString(),
      });

      const responses = await service.getAgentResponses(groupChatId, sessionId);
      expect(responses).toHaveLength(1);
      expect(responses[0].content).toBe("Response content");
    });

    it("should clear agent responses", async () => {
      await service.addAgentResponse(groupChatId, sessionId, {
        id: "resp-1",
        agentId: "agent-1",
        agentName: "Bot",
        sessionId,
        content: "Response",
        status: "completed",
        startedAt: new Date().toISOString(),
      });

      await service.clearAgentResponses(groupChatId, sessionId);

      const responses = await service.getAgentResponses(groupChatId, sessionId);
      expect(responses).toHaveLength(0);
    });
  });
});
