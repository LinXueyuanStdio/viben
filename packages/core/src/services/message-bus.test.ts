/**
 * Message Bus Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MessageBus, type InboundMessage, type OutboundMessage } from "./message-bus";
import { EventService } from "./events";

describe("MessageBus", () => {
  let messageBus: MessageBus;
  let eventService: EventService;

  beforeEach(() => {
    eventService = new EventService();
    messageBus = new MessageBus(eventService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should create a MessageBus instance", () => {
      expect(messageBus).toBeInstanceOf(MessageBus);
    });

    it("should accept EventService in constructor", () => {
      const customEventService = new EventService();
      const bus = new MessageBus(customEventService);
      expect(bus).toBeInstanceOf(MessageBus);
    });
  });

  describe("onInboundMessage (registerHandler)", () => {
    it("should register a handler for a specific channel type", () => {
      const handler = vi.fn();
      messageBus.onInboundMessage("telegram", handler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      messageBus.publishInbound(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it("should register a handler for wildcard (*) channel type", () => {
      const handler = vi.fn();
      messageBus.onInboundMessage("*", handler);

      const message: InboundMessage = {
        channelType: "discord",
        channelName: "test-channel",
        chatId: "chat-456",
        message: "Hello from Discord",
        timestamp: Date.now(),
      };

      messageBus.publishInbound(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it("should return an unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = messageBus.onInboundMessage("telegram", handler);

      expect(typeof unsubscribe).toBe("function");
    });
  });

  describe("unsubscribe (unregisterHandler)", () => {
    it("should stop calling handler after unsubscribe", async () => {
      const handler = vi.fn();
      const unsubscribe = messageBus.onInboundMessage("telegram", handler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "First message",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await messageBus.publishInbound({
        ...message,
        message: "Second message",
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should only unsubscribe the specific handler", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = messageBus.onInboundMessage("telegram", handler1);
      messageBus.onInboundMessage("telegram", handler2);

      unsubscribe1();

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(message);
    });
  });

  describe("publishInbound (handleInbound)", () => {
    it("should call specific channel handlers", async () => {
      const telegramHandler = vi.fn();
      const discordHandler = vi.fn();

      messageBus.onInboundMessage("telegram", telegramHandler);
      messageBus.onInboundMessage("discord", discordHandler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      expect(telegramHandler).toHaveBeenCalledWith(message);
      expect(discordHandler).not.toHaveBeenCalled();
    });

    it("should call wildcard handlers for any channel type", async () => {
      const wildcardHandler = vi.fn();
      messageBus.onInboundMessage("*", wildcardHandler);

      const telegramMessage: InboundMessage = {
        channelType: "telegram",
        channelName: "tg-channel",
        chatId: "chat-1",
        message: "Telegram message",
        timestamp: Date.now(),
      };

      const discordMessage: InboundMessage = {
        channelType: "discord",
        channelName: "discord-channel",
        chatId: "chat-2",
        message: "Discord message",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(telegramMessage);
      await messageBus.publishInbound(discordMessage);

      expect(wildcardHandler).toHaveBeenCalledTimes(2);
      expect(wildcardHandler).toHaveBeenNthCalledWith(1, telegramMessage);
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, discordMessage);
    });

    it("should call both specific and wildcard handlers", async () => {
      const specificHandler = vi.fn();
      const wildcardHandler = vi.fn();

      messageBus.onInboundMessage("telegram", specificHandler);
      messageBus.onInboundMessage("*", wildcardHandler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      expect(specificHandler).toHaveBeenCalledWith(message);
      expect(wildcardHandler).toHaveBeenCalledWith(message);
    });

    it("should broadcast event to EventService", async () => {
      const eventListener = vi.fn();
      eventService.subscribe(eventListener);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        senderName: "TestUser",
        message: "Hello",
        timestamp: 1234567890,
      };

      await messageBus.publishInbound(message);

      expect(eventListener).toHaveBeenCalledWith({
        type: "channel_message_received",
        data: {
          channel_type: "telegram",
          channel_name: "test-channel",
          chat_id: "chat-123",
          sender_name: "TestUser",
          message: "Hello",
          timestamp: 1234567890,
        },
      });
    });

    it("should pass complete message data to handlers", async () => {
      const handler = vi.fn();
      messageBus.onInboundMessage("telegram", handler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        senderName: "John",
        senderId: "user-456",
        message: "Hello World",
        timestamp: 1234567890,
        metadata: { key: "value" },
      };

      await messageBus.publishInbound(message);

      expect(handler).toHaveBeenCalledWith(message);
    });
  });

  describe("publishOutbound (sendOutbound)", () => {
    it("should emit outbound message to registered handlers", async () => {
      const outboundHandler = vi.fn();
      messageBus.onOutboundMessage(outboundHandler);

      const message: OutboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Outgoing message",
      };

      await messageBus.publishOutbound(message);

      expect(outboundHandler).toHaveBeenCalledWith(message);
    });

    it("should pass parseMode and replyTo to handlers", async () => {
      const outboundHandler = vi.fn();
      messageBus.onOutboundMessage(outboundHandler);

      const message: OutboundMessage = {
        channelType: "discord",
        channelName: "discord-channel",
        chatId: "chat-456",
        message: "**Bold message**",
        parseMode: "markdown",
        replyTo: "msg-789",
        metadata: { urgent: true },
      };

      await messageBus.publishOutbound(message);

      expect(outboundHandler).toHaveBeenCalledWith(message);
    });

    it("should allow unsubscribing from outbound messages", async () => {
      const outboundHandler = vi.fn();
      const unsubscribe = messageBus.onOutboundMessage(outboundHandler);

      const message: OutboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "First message",
      };

      await messageBus.publishOutbound(message);
      expect(outboundHandler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await messageBus.publishOutbound({
        ...message,
        message: "Second message",
      });
      expect(outboundHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple handlers for same channel type", () => {
    it("should call all handlers registered for the same channel type", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      messageBus.onInboundMessage("telegram", handler1);
      messageBus.onInboundMessage("telegram", handler2);
      messageBus.onInboundMessage("telegram", handler3);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
      expect(handler3).toHaveBeenCalledWith(message);
    });

    it("should call multiple wildcard handlers", async () => {
      const wildcardHandler1 = vi.fn();
      const wildcardHandler2 = vi.fn();

      messageBus.onInboundMessage("*", wildcardHandler1);
      messageBus.onInboundMessage("*", wildcardHandler2);

      const message: InboundMessage = {
        channelType: "feishu",
        channelName: "feishu-channel",
        chatId: "chat-789",
        message: "Feishu message",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      expect(wildcardHandler1).toHaveBeenCalledWith(message);
      expect(wildcardHandler2).toHaveBeenCalledWith(message);
    });

    it("should call multiple outbound handlers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      messageBus.onOutboundMessage(handler1);
      messageBus.onOutboundMessage(handler2);

      const message: OutboundMessage = {
        channelType: "whatsapp",
        channelName: "wa-channel",
        chatId: "chat-123",
        message: "WhatsApp message",
      };

      await messageBus.publishOutbound(message);

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });
  });

  describe("handler error isolation", () => {
    it("should continue calling other handlers when one throws sync error", async () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });
      const successHandler = vi.fn();

      messageBus.onInboundMessage("telegram", errorHandler);
      messageBus.onInboundMessage("telegram", successHandler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await messageBus.publishInbound(message);

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalledWith(message);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should continue calling other handlers when one throws async error", async () => {
      const asyncErrorHandler = vi.fn().mockImplementation(async () => {
        throw new Error("Async handler error");
      });
      const successHandler = vi.fn();

      messageBus.onInboundMessage("discord", asyncErrorHandler);
      messageBus.onInboundMessage("discord", successHandler);

      const message: InboundMessage = {
        channelType: "discord",
        channelName: "discord-channel",
        chatId: "chat-456",
        message: "Discord message",
        timestamp: Date.now(),
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await messageBus.publishInbound(message);

      expect(asyncErrorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalledWith(message);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should isolate wildcard handler errors", async () => {
      const errorWildcardHandler = vi.fn().mockImplementation(() => {
        throw new Error("Wildcard handler error");
      });
      const successWildcardHandler = vi.fn();
      const specificHandler = vi.fn();

      messageBus.onInboundMessage("telegram", specificHandler);
      messageBus.onInboundMessage("*", errorWildcardHandler);
      messageBus.onInboundMessage("*", successWildcardHandler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await messageBus.publishInbound(message);

      expect(specificHandler).toHaveBeenCalledWith(message);
      expect(errorWildcardHandler).toHaveBeenCalled();
      expect(successWildcardHandler).toHaveBeenCalledWith(message);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log error with channel type for specific handlers", async () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });

      messageBus.onInboundMessage("feishu", errorHandler);

      const message: InboundMessage = {
        channelType: "feishu",
        channelName: "feishu-channel",
        chatId: "chat-789",
        message: "Feishu message",
        timestamp: Date.now(),
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await messageBus.publishInbound(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("feishu"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("async handlers", () => {
    it("should await async handlers", async () => {
      const callOrder: string[] = [];

      const asyncHandler = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push("async");
      });

      const syncHandler = vi.fn().mockImplementation(() => {
        callOrder.push("sync");
      });

      messageBus.onInboundMessage("telegram", asyncHandler);
      messageBus.onInboundMessage("telegram", syncHandler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      // Both should be called
      expect(asyncHandler).toHaveBeenCalled();
      expect(syncHandler).toHaveBeenCalled();
      // Async handler should complete before sync (sequential execution)
      expect(callOrder).toEqual(["async", "sync"]);
    });

    it("should handle async outbound handlers", async () => {
      const asyncOutboundHandler = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "done";
      });

      messageBus.onOutboundMessage(asyncOutboundHandler);

      const message: OutboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Outgoing",
      };

      await messageBus.publishOutbound(message);

      expect(asyncOutboundHandler).toHaveBeenCalledWith(message);
    });
  });

  describe("updateConnectionStatus", () => {
    it("should broadcast connection status event", () => {
      const eventListener = vi.fn();
      eventService.subscribe(eventListener);

      messageBus.updateConnectionStatus("telegram", "my-bot", true);

      expect(eventListener).toHaveBeenCalledWith({
        type: "channel_connection_status",
        data: {
          channel_type: "telegram",
          channel_name: "my-bot",
          connected: true,
          error: undefined,
        },
      });
    });

    it("should include error when disconnected", () => {
      const eventListener = vi.fn();
      eventService.subscribe(eventListener);

      messageBus.updateConnectionStatus("discord", "my-bot", false, "Connection timeout");

      expect(eventListener).toHaveBeenCalledWith({
        type: "channel_connection_status",
        data: {
          channel_type: "discord",
          channel_name: "my-bot",
          connected: false,
          error: "Connection timeout",
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should handle publishing when no handlers registered", async () => {
      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "Hello",
        timestamp: Date.now(),
      };

      // Should not throw
      await expect(messageBus.publishInbound(message)).resolves.toBeUndefined();
    });

    it("should handle unsubscribing handler that was already removed", () => {
      const handler = vi.fn();
      const unsubscribe = messageBus.onInboundMessage("telegram", handler);

      unsubscribe();
      // Second unsubscribe should not throw
      expect(() => unsubscribe()).not.toThrow();
    });

    it("should handle empty message content", async () => {
      const handler = vi.fn();
      messageBus.onInboundMessage("telegram", handler);

      const message: InboundMessage = {
        channelType: "telegram",
        channelName: "test-channel",
        chatId: "chat-123",
        message: "",
        timestamp: Date.now(),
      };

      await messageBus.publishInbound(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it("should handle all channel types", async () => {
      const handler = vi.fn();
      messageBus.onInboundMessage("*", handler);

      const channelTypes = ["telegram", "discord", "feishu", "whatsapp"] as const;

      for (const channelType of channelTypes) {
        const message: InboundMessage = {
          channelType,
          channelName: `${channelType}-channel`,
          chatId: "chat-123",
          message: `Message from ${channelType}`,
          timestamp: Date.now(),
        };

        await messageBus.publishInbound(message);
      }

      expect(handler).toHaveBeenCalledTimes(4);
    });
  });
});
