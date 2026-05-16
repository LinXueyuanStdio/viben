import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./crud", () => ({
  findAccount: vi.fn(),
}));
vi.mock("./exchanges", () => ({
  getExchange: vi.fn(),
}));

import { testAccount } from "./test";
import { findAccount } from "./crud";
import { getExchange } from "./exchanges";

describe("testAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not found error when account does not exist", async () => {
    vi.mocked(findAccount).mockResolvedValue(null);

    const result = await testAccount("xyz");

    expect(result).toEqual({ success: false, error: "Account not found: xyz" });
  });

  it("calls exchange.testConnection with correct credentials", async () => {
    const mockRecord = {
      id: "acc-1",
      exchange: "okx" as const,
      name: "my-okx",
      api_key: "key123",
      secret: "secret456",
      passphrase: "pass789",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    const mockTestConnection = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(findAccount).mockResolvedValue(mockRecord);
    vi.mocked(getExchange).mockReturnValue({ testConnection: mockTestConnection } as any);

    await testAccount("acc-1");

    expect(getExchange).toHaveBeenCalledWith("okx");
    expect(mockTestConnection).toHaveBeenCalledWith({
      api_key: "key123",
      secret: "secret456",
      passphrase: "pass789",
    });
  });

  it("passes through successful TestResult from exchange", async () => {
    const mockRecord = {
      id: "acc-2",
      exchange: "binance" as const,
      name: "my-binance",
      api_key: "bkey",
      secret: "bsecret",
      passphrase: undefined,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    const successResult = { success: true, latency_ms: 100 };
    const mockTestConnection = vi.fn().mockResolvedValue(successResult);

    vi.mocked(findAccount).mockResolvedValue(mockRecord);
    vi.mocked(getExchange).mockReturnValue({ testConnection: mockTestConnection } as any);

    const result = await testAccount("acc-2");

    expect(result).toEqual({ success: true, latency_ms: 100 });
  });

  it("passes through failed TestResult from exchange", async () => {
    const mockRecord = {
      id: "acc-3",
      exchange: "bybit" as const,
      name: "my-bybit",
      api_key: "bad-key",
      secret: "bad-secret",
      passphrase: undefined,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    const failResult = { success: false, error: "Invalid API key", latency_ms: 200 };
    const mockTestConnection = vi.fn().mockResolvedValue(failResult);

    vi.mocked(findAccount).mockResolvedValue(mockRecord);
    vi.mocked(getExchange).mockReturnValue({ testConnection: mockTestConnection } as any);

    const result = await testAccount("acc-3");

    expect(result).toEqual({ success: false, error: "Invalid API key", latency_ms: 200 });
  });

  it("returns 'not found' error for ambiguous name (findAccount returns null)", async () => {
    // When findAccount returns null (e.g., due to ambiguous name), testAccount
    // produces a generic "not found" message — it does not distinguish ambiguity.
    vi.mocked(findAccount).mockResolvedValue(null);

    const result = await testAccount("AmbiguousName");

    expect(result).toEqual({ success: false, error: "Account not found: AmbiguousName" });
  });

  it("propagates exception when testConnection throws", async () => {
    vi.mocked(findAccount).mockResolvedValue({
      id: "abc123",
      exchange: "okx",
      name: "OKX",
      api_key: "key",
      secret: "secret",
      passphrase: "pass",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const mockTestConnection = vi.fn().mockRejectedValue(new Error("Network timeout"));
    vi.mocked(getExchange).mockReturnValue({
      id: "okx",
      name: "OKX",
      fields: ["api_key", "secret", "passphrase"],
      sign: vi.fn() as any,
      testConnection: mockTestConnection,
    });

    await expect(testAccount("abc123")).rejects.toThrow("Network timeout");
  });
});
