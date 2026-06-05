import { describe, it, expect, vi } from "vitest";
import { SecurityGuard } from "../security-guard.js";
import type { SecurityConfig } from "../security-guard.js";
import type { SessionStatus } from "../../../core/types.js";

function makeMessage(overrides: Partial<{ channelId: string; threadId: string; userId: string | number; text: string }> = {}) {
  return {
    channelId: "telegram",
    threadId: "t1",
    userId: "user-1",
    text: "hello",
    ...overrides,
  };
}

function makeConfigGetter(overrides: {
  allowedUserIds?: string[];
  maxConcurrentSessions?: number;
} = {}) {
  return vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
    allowedUserIds: overrides.allowedUserIds ?? [],
    maxConcurrentSessions: overrides.maxConcurrentSessions ?? 5,
  });
}

function makeSessionManager(sessions: Array<{ status: SessionStatus }> = []) {
  return {
    listSessions: () => sessions,
  } as any;
}

describe("SecurityGuard — Comprehensive Edge Cases", () => {
  describe("user access control", () => {
    it("allows all users when allowedUserIds is empty", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ allowedUserIds: [] }),
        makeSessionManager(),
      );
      expect(await guard.checkAccess(makeMessage())).toEqual({ allowed: true });
    });

    it("converts numeric userId to string for comparison", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ allowedUserIds: ["12345"] }),
        makeSessionManager(),
      );
      // userId comes as number from Telegram but config stores as string
      const result = await guard.checkAccess(makeMessage({ userId: 12345 as any }));
      expect(result).toEqual({ allowed: true });
    });

    it("rejects user not in allowed list", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ allowedUserIds: ["user-2", "user-3"] }),
        makeSessionManager(),
      );
      const result = await guard.checkAccess(makeMessage({ userId: "user-1" }));
      expect(result).toEqual({ allowed: false, reason: "Unauthorized user" });
    });

    it("allows user in allowed list (exact match)", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ allowedUserIds: ["user-1", "user-2"] }),
        makeSessionManager(),
      );
      expect(await guard.checkAccess(makeMessage({ userId: "user-1" }))).toEqual({
        allowed: true,
      });
    });

    it("single allowed user - authorized", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ allowedUserIds: ["only-me"] }),
        makeSessionManager(),
      );
      expect(await guard.checkAccess(makeMessage({ userId: "only-me" }))).toEqual({
        allowed: true,
      });
    });

    it("single allowed user - unauthorized", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ allowedUserIds: ["only-me"] }),
        makeSessionManager(),
      );
      expect(await guard.checkAccess(makeMessage({ userId: "not-me" }))).toEqual({
        allowed: false,
        reason: "Unauthorized user",
      });
    });
  });

  describe("session limit enforcement", () => {
    it("allows when active sessions < max", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 3 }),
        makeSessionManager([{ status: "active" }, { status: "active" }]),
      );
      expect(await guard.checkAccess(makeMessage())).toEqual({ allowed: true });
    });

    it("rejects when active sessions == max (boundary)", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 2 }),
        makeSessionManager([{ status: "active" }, { status: "active" }]),
      );
      const result = await guard.checkAccess(makeMessage());
      expect(result).toEqual({
        allowed: false,
        reason: "Session limit reached (2)",
      });
    });

    it("rejects when active sessions > max", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 1 }),
        makeSessionManager([
          { status: "active" },
          { status: "active" },
        ]),
      );
      expect((await guard.checkAccess(makeMessage())).allowed).toBe(false);
    });

    it("counts initializing sessions toward limit", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 2 }),
        makeSessionManager([
          { status: "initializing" },
          { status: "initializing" },
        ]),
      );
      expect((await guard.checkAccess(makeMessage())).allowed).toBe(false);
    });

    it("counts mix of active and initializing", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 2 }),
        makeSessionManager([
          { status: "active" },
          { status: "initializing" },
        ]),
      );
      expect((await guard.checkAccess(makeMessage())).allowed).toBe(false);
    });

    it("ignores finished sessions for limit", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 1 }),
        makeSessionManager([
          { status: "finished" },
          { status: "finished" },
          { status: "finished" },
        ]),
      );
      expect(await guard.checkAccess(makeMessage())).toEqual({ allowed: true });
    });

    it("ignores cancelled sessions for limit", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 1 }),
        makeSessionManager([{ status: "cancelled" }]),
      );
      expect(await guard.checkAccess(makeMessage())).toEqual({ allowed: true });
    });

    it("ignores error sessions for limit", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 1 }),
        makeSessionManager([{ status: "error" }]),
      );
      expect(await guard.checkAccess(makeMessage())).toEqual({ allowed: true });
    });

    it("maxConcurrentSessions of 0 always rejects", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({ maxConcurrentSessions: 0 }),
        makeSessionManager([]),
      );
      expect((await guard.checkAccess(makeMessage())).allowed).toBe(false);
    });
  });

  describe("combined checks (user + session limit)", () => {
    it("user check runs before session limit check", async () => {
      // If user is unauthorized, should return "Unauthorized user" not "Session limit"
      const guard = new SecurityGuard(
        makeConfigGetter({
          allowedUserIds: ["admin"],
          maxConcurrentSessions: 0,
        }),
        makeSessionManager(),
      );
      const result = await guard.checkAccess(makeMessage({ userId: "hacker" }));
      expect(result).toEqual({ allowed: false, reason: "Unauthorized user" });
    });

    it("authorized user still blocked by session limit", async () => {
      const guard = new SecurityGuard(
        makeConfigGetter({
          allowedUserIds: ["user-1"],
          maxConcurrentSessions: 1,
        }),
        makeSessionManager([{ status: "active" }]),
      );
      const result = await guard.checkAccess(makeMessage({ userId: "user-1" }));
      expect(result.allowed).toBe(false);
      expect((result as any).reason).toContain("Session limit");
    });
  });

  describe("config reads fresh on each call", () => {
    it("reflects config changes between calls", async () => {
      let allowedUserIds: string[] = [];
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockImplementation(async () => ({
        allowedUserIds,
        maxConcurrentSessions: 5,
      }));
      const guard = new SecurityGuard(getConfig, makeSessionManager());

      // First: no restrictions
      expect(await guard.checkAccess(makeMessage())).toEqual({ allowed: true });

      // Update config
      allowedUserIds = ["user-2"];

      // Now user-1 should be blocked
      expect((await guard.checkAccess(makeMessage({ userId: "user-1" }))).allowed).toBe(false);
    });
  });
});
