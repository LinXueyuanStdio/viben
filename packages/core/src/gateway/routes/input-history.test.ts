import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { InputHistoryService, createInputHistoryEntry } from "../../services/input-history";
import { registerInputHistoryRoutes } from "./input-history";

describe("Input history routes", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let service: InputHistoryService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-input-history-route-test-"));
    service = new InputHistoryService(tempDir);
    app = Fastify();
    registerInputHistoryRoutes(app, service);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns input history text values oldest-to-newest", async () => {
    await service.addEntry(createInputHistoryEntry("first prompt"));
    await service.addEntry(createInputHistoryEntry("second prompt"));

    const response = await app.inject({
      method: "GET",
      url: "/api/input-history",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      entries: ["first prompt", "second prompt"],
      total: 2,
      limit: 100,
    });
  });

  it("honors snake_case limit query parameter", async () => {
    await service.addEntry(createInputHistoryEntry("first"));
    await service.addEntry(createInputHistoryEntry("second"));
    await service.addEntry(createInputHistoryEntry("third"));

    const response = await app.inject({
      method: "GET",
      url: "/api/input-history?limit=2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      entries: ["second", "third"],
      total: 2,
      limit: 2,
    });
  });
});
