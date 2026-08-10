import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSession } from "./use-session";

const swrState = vi.hoisted(() => ({
  data: undefined as
    | {
        user: {
          id: string;
          username: string;
          userSlug: string;
          email: string;
          role: string;
          githubUsername?: string;
        };
        hasGitHub: boolean;
      }
    | undefined,
  isLoading: false,
}));

vi.mock("swr", () => ({
  default: () => swrState,
}));

describe("useSession", () => {
  beforeEach(() => {
    swrState.data = undefined;
    swrState.isLoading = false;
  });

  test("does not report GitHub connected from a profile username without a repo token", () => {
    swrState.data = {
      user: {
        id: "user-1",
        username: "alice",
        userSlug: "alice",
        email: "alice@example.com",
        role: "developer",
        githubUsername: "octocat",
      },
      hasGitHub: false,
    };

    const { result } = renderHook(() => useSession());

    expect(result.current.hasGitHub).toBe(false);
  });

  test("reports GitHub connected when the server confirms a repo token", () => {
    swrState.data = {
      user: {
        id: "user-1",
        username: "alice",
        userSlug: "alice",
        email: "alice@example.com",
        role: "developer",
      },
      hasGitHub: true,
    };

    const { result } = renderHook(() => useSession());

    expect(result.current.hasGitHub).toBe(true);
  });
});
