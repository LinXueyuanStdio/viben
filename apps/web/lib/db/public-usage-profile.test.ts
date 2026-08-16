import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildPublicUsageProfileData,
  getPublicUsageProfile,
} from "./public-usage-profile";

type MockPublicUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  publicUsageEnabled: boolean | null;
};

const state = vi.hoisted(() => ({
  findPublicUsersByUsernameMock: vi.fn(
    async (): Promise<MockPublicUser[]> => [],
  ),
  getUsageHistoryMock: vi.fn(async () => []),
  getUsageInsightsMock: vi.fn(async () => ({
    lookbackDays: 0,
    pr: {
      trackedPrCount: 0,
      sessionsWithPrCount: 0,
      openPrCount: 0,
      mergedPrCount: 0,
      closedPrCount: 0,
      mergeRate: 0,
    },
    efficiency: {
      mainAssistantTurnCount: 0,
      averageTokensPerMainTurn: 0,
      largestMainTurnTokens: 0,
      toolCallsPerMainTurn: 0,
      cacheReadRatio: 0,
    },
    code: {
      linesAdded: 0,
      linesRemoved: 0,
      totalLinesChanged: 0,
    },
    topRepositories: [],
  })),
}));

vi.mock("./client", () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: state.findPublicUsersByUsernameMock,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("./usage", () => ({
  getUsageHistory: state.getUsageHistoryMock,
}));

vi.mock("./usage-insights", () => ({
  getUsageInsights: state.getUsageInsightsMock,
}));

beforeEach(() => {
  state.findPublicUsersByUsernameMock.mockClear();
  state.getUsageHistoryMock.mockClear();
  state.getUsageInsightsMock.mockClear();

  state.findPublicUsersByUsernameMock.mockImplementation(async () => []);
  state.getUsageHistoryMock.mockImplementation(async () => []);
  state.getUsageInsightsMock.mockImplementation(async () => ({
    lookbackDays: 0,
    pr: {
      trackedPrCount: 0,
      sessionsWithPrCount: 0,
      openPrCount: 0,
      mergedPrCount: 0,
      closedPrCount: 0,
      mergeRate: 0,
    },
    efficiency: {
      mainAssistantTurnCount: 0,
      averageTokensPerMainTurn: 0,
      largestMainTurnTokens: 0,
      toolCallsPerMainTurn: 0,
      cacheReadRatio: 0,
    },
    code: {
      linesAdded: 0,
      linesRemoved: 0,
      totalLinesChanged: 0,
    },
    topRepositories: [],
  }));
});

describe("buildPublicUsageProfileData", () => {
  test("aggregates totals, agent split, and top models", async () => {
    const result = buildPublicUsageProfileData({
      usage: [
        {
          date: "2026-02-01",
          source: "web",
          agentType: "main",
          provider: "anthropic",
          modelId: "anthropic/claude-sonnet-4",
          inputTokens: 100,
          cachedInputTokens: 20,
          outputTokens: 50,
          messageCount: 2,
          toolCallCount: 1,
        },
        {
          date: "2026-02-02",
          source: "web",
          agentType: "subagent",
          provider: "openai",
          modelId: "openai/gpt-5-mini",
          inputTokens: 60,
          cachedInputTokens: 0,
          outputTokens: 30,
          messageCount: 0,
          toolCallCount: 3,
        },
        {
          date: "2026-02-03",
          source: "web",
          agentType: "main",
          provider: "anthropic",
          modelId: "anthropic/claude-sonnet-4",
          inputTokens: 20,
          cachedInputTokens: 10,
          outputTokens: 10,
          messageCount: 1,
          toolCallCount: 0,
        },
      ],
      insights: {
        lookbackDays: 30,
        pr: {
          trackedPrCount: 2,
          sessionsWithPrCount: 2,
          openPrCount: 0,
          mergedPrCount: 2,
          closedPrCount: 0,
          mergeRate: 1,
        },
        efficiency: {
          mainAssistantTurnCount: 3,
          averageTokensPerMainTurn: 60,
          largestMainTurnTokens: 150,
          toolCallsPerMainTurn: 1.3,
          cacheReadRatio: 0.2,
        },
        code: {
          linesAdded: 40,
          linesRemoved: 12,
          totalLinesChanged: 52,
        },
        topRepositories: [
          {
            repoOwner: "vercel",
            repoName: "viben-agent",
            sessionCount: 3,
            trackedPrCount: 2,
            linesAdded: 40,
            linesRemoved: 12,
            totalLinesChanged: 52,
          },
        ],
      },
    });

    expect(result).toEqual({
      totals: {
        inputTokens: 180,
        cachedInputTokens: 30,
        outputTokens: 90,
        messageCount: 3,
        toolCallCount: 4,
        totalTokens: 270,
      },
      agentSplit: {
        mainTokens: 180,
        subagentTokens: 90,
      },
      topModels: [
        {
          modelId: "anthropic/claude-sonnet-4",
          provider: "anthropic",
          label: "claude-sonnet-4",
          totalTokens: 180,
          inputTokens: 120,
          cachedInputTokens: 30,
          outputTokens: 60,
          messageCount: 3,
          toolCallCount: 1,
        },
        {
          modelId: "openai/gpt-5-mini",
          provider: "openai",
          label: "gpt-5-mini",
          totalTokens: 90,
          inputTokens: 60,
          cachedInputTokens: 0,
          outputTokens: 30,
          messageCount: 0,
          toolCallCount: 3,
        },
      ],
      topRepositories: [
        {
          repoOwner: "vercel",
          repoName: "viben-agent",
          sessionCount: 3,
          trackedPrCount: 2,
          linesAdded: 40,
          linesRemoved: 12,
          totalLinesChanged: 52,
        },
      ],
      dailyActivity: [
        {
          date: "2026-02-01",
          inputTokens: 100,
          outputTokens: 50,
          messageCount: 2,
          toolCallCount: 1,
        },
        {
          date: "2026-02-02",
          inputTokens: 60,
          outputTokens: 30,
          messageCount: 0,
          toolCallCount: 3,
        },
        {
          date: "2026-02-03",
          inputTokens: 20,
          outputTokens: 10,
          messageCount: 1,
          toolCallCount: 0,
        },
      ],
      hasUsage: true,
    });
  });

  test("returns empty state when usage is empty", async () => {
    expect(
      buildPublicUsageProfileData({
        usage: [],
        insights: await state.getUsageInsightsMock(),
      }),
    ).toEqual({
      totals: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        messageCount: 0,
        toolCallCount: 0,
        totalTokens: 0,
      },
      agentSplit: {
        mainTokens: 0,
        subagentTokens: 0,
      },
      topModels: [],
      topRepositories: [],
      dailyActivity: [],
      hasUsage: false,
    });
  });
});

describe("getPublicUsageProfile", () => {
  test("returns null when the user does not exist", async () => {
    state.findPublicUsersByUsernameMock.mockImplementation(async () => []);

    expect(await getPublicUsageProfile("missing-user", null)).toBeNull();
    expect(state.getUsageHistoryMock).not.toHaveBeenCalled();
    expect(state.getUsageInsightsMock).not.toHaveBeenCalled();
  });

  test("returns null when public usage is disabled", async () => {
    state.findPublicUsersByUsernameMock.mockImplementation(async () => [
      {
        id: "user-1",
        username: "private-user",
        displayName: "Private User",
        avatarUrl: null,
        lastLoginAt: new Date("2026-01-01T00:00:00.000Z"),
        publicUsageEnabled: false,
      },
    ]);

    expect(await getPublicUsageProfile("private-user", null)).toBeNull();
    expect(state.getUsageHistoryMock).not.toHaveBeenCalled();
    expect(state.getUsageInsightsMock).not.toHaveBeenCalled();
  });

  test("uses all-time queries when no valid date is provided", async () => {
    state.findPublicUsersByUsernameMock.mockImplementation(async () => [
      {
        id: "user-2",
        username: "all-time-user",
        displayName: null,
        avatarUrl: null,
        lastLoginAt: new Date("2026-01-02T00:00:00.000Z"),
        publicUsageEnabled: true,
      },
    ]);

    const profile = await getPublicUsageProfile("all-time-user", "bad-value");

    expect(profile?.dateSelection).toEqual({
      kind: "all",
      value: null,
      label: "All time",
      range: null,
    });
    expect(profile?.invalidDateError).toBeTruthy();
    expect(state.getUsageHistoryMock).toHaveBeenCalledWith("user-2", {
      allTime: true,
    });
    expect(state.getUsageInsightsMock).toHaveBeenCalledWith("user-2", {
      allTime: true,
    });
  });

  test("prefers an enabled case-insensitive match", async () => {
    state.findPublicUsersByUsernameMock.mockImplementation(async () => [
      {
        id: "user-disabled",
        username: "range-user",
        displayName: "Disabled User",
        avatarUrl: null,
        lastLoginAt: new Date("2026-01-01T00:00:00.000Z"),
        publicUsageEnabled: false,
      },
      {
        id: "user-3",
        username: "Range-User",
        displayName: "Range User",
        avatarUrl: null,
        lastLoginAt: new Date("2026-01-03T00:00:00.000Z"),
        publicUsageEnabled: true,
      },
    ]);

    const profile = await getPublicUsageProfile(
      "RANGE-USER",
      "2026-01-01..2026-01-31",
    );

    expect(profile?.user).toEqual({
      id: "user-3",
      username: "Range-User",
      displayName: "Range User",
      avatarUrl: null,
    });
    expect(profile?.dateSelection).toEqual({
      kind: "range",
      value: "2026-01-01..2026-01-31",
      label: "Jan 1, 2026 – Jan 31, 2026",
      range: {
        from: "2026-01-01",
        to: "2026-01-31",
      },
    });
    expect(state.getUsageHistoryMock).toHaveBeenCalledWith("user-3", {
      range: {
        from: "2026-01-01",
        to: "2026-01-31",
      },
    });
    expect(state.getUsageInsightsMock).toHaveBeenCalledWith("user-3", {
      range: {
        from: "2026-01-01",
        to: "2026-01-31",
      },
    });
  });
});
