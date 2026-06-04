import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "../client";
import { GatewayError } from "../error";

describe("GatewayClient request", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends JSON bodies for arbitrary HTTP methods", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const client = new GatewayClient("http://127.0.0.1:18790");
    const result = await client.request<{ ok: boolean }>("/api/queue/config", {
      method: "PUT",
      body: { max_concurrency: 3 },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18790/api/queue/config",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ max_concurrency: 3 }),
      })
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("supports empty success responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new GatewayClient("http://127.0.0.1:18790");
    await expect(
      client.request<void>("/api/pet/set/default", {
        method: "POST",
        responseType: "none",
      })
    ).resolves.toBeUndefined();
  });

  it("throws GatewayError with parsed error text", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "No pet" }), {
        status: 404,
        statusText: "Not Found",
        headers: { "Content-Type": "application/json" },
      })
    );

    const client = new GatewayClient("http://127.0.0.1:18790");

    await expect(client.request("/api/pet/remove/missing", { method: "POST" })).rejects.toMatchObject({
      name: "GatewayError",
      message: "No pet",
      statusCode: 404,
    } satisfies Partial<GatewayError>);
  });

  it("passes FormData through without forcing JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const formData = new FormData();
    formData.append("file", new Blob(["hello"]), "hello.txt");

    const client = new GatewayClient("http://127.0.0.1:18790");
    await client.request("/api/page/asset/upload", {
      method: "POST",
      body: formData,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:18790/api/page/asset/upload", {
      method: "POST",
      body: formData,
    });
  });
});
