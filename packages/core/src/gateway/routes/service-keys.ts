/**
 * Service API Keys routes
 *
 * Provides HTTP API for managing service API keys used for external client authentication.
 * Keys are stored in ~/.config/browse-mcp/service_keys.json
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

// ============================================================================
// Types
// ============================================================================

interface ServiceApiKey {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  created_at: string;
  last_used: string | null;
}

interface ServiceKeysStore {
  keys: ServiceApiKey[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the service keys file path
 */
function getKeysFilePath(): string {
  const configDir = process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "browse-mcp")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "browse-mcp")
      : join(homedir(), ".config", "browse-mcp");

  return join(configDir, "service_keys.json");
}

/**
 * Load service keys from file
 */
async function loadKeys(): Promise<ServiceApiKey[]> {
  const path = getKeysFilePath();
  try {
    if (!existsSync(path)) {
      return [];
    }
    const content = await readFile(path, "utf-8");
    const store: ServiceKeysStore = JSON.parse(content);
    return store.keys;
  } catch {
    return [];
  }
}

/**
 * Save service keys to file
 */
async function saveKeys(keys: ServiceApiKey[]): Promise<void> {
  const path = getKeysFilePath();
  const dir = join(path, "..");

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const store: ServiceKeysStore = { keys };
  await writeFile(path, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Generate a new API key
 */
function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < 32; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `bm_live_${randomPart}`;
}

/**
 * Create key prefix for display
 */
function createKeyPrefix(key: string): string {
  if (key.length > 12) {
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }
  return "****";
}

/**
 * Get current timestamp string
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

// ============================================================================
// Routes
// ============================================================================

export function registerServiceKeysRoutes(fastify: FastifyInstance): void {
  /**
   * Get all service API keys
   * GET /api/service-keys
   */
  fastify.get("/api/service-keys", async () => {
    const keys = await loadKeys();
    return { keys };
  });

  /**
   * Create a new service API key
   * POST /api/service-keys
   */
  fastify.post<{
    Body: { name: string };
  }>("/api/service-keys", async (request, reply) => {
    const { name } = request.body;

    if (!name) {
      reply.code(400);
      return { error: "Name is required" };
    }

    const keys = await loadKeys();

    const key = generateApiKey();
    const newKey: ServiceApiKey = {
      id: randomUUID(),
      name,
      key,
      key_prefix: createKeyPrefix(key),
      created_at: getCurrentTimestamp(),
      last_used: null,
    };

    keys.push(newKey);
    await saveKeys(keys);

    reply.code(201);
    return newKey;
  });

  /**
   * Get a service API key by ID
   * GET /api/service-keys/:keyId
   */
  fastify.get<{
    Params: { keyId: string };
  }>("/api/service-keys/:keyId", async (request, reply) => {
    const { keyId } = request.params;
    const keys = await loadKeys();
    const key = keys.find((k) => k.id === keyId);

    if (!key) {
      reply.code(404);
      return { error: "Key not found" };
    }

    return key;
  });

  /**
   * Delete a service API key
   * DELETE /api/service-keys/:keyId
   */
  fastify.delete<{
    Params: { keyId: string };
  }>("/api/service-keys/:keyId", async (request, reply) => {
    const { keyId } = request.params;
    const keys = await loadKeys();
    const filtered = keys.filter((k) => k.id !== keyId);

    if (filtered.length === keys.length) {
      reply.code(404);
      return { error: "Key not found" };
    }

    await saveKeys(filtered);
    return { deleted: keyId };
  });

  /**
   * Validate a service API key
   * POST /api/service-keys/validate
   */
  fastify.post<{
    Body: { api_key: string };
  }>("/api/service-keys/validate", async (request) => {
    const { api_key } = request.body;
    const keys = await loadKeys();
    const valid = keys.some((k) => k.key === api_key);
    return { valid };
  });

  /**
   * Update last used timestamp for a key
   * POST /api/service-keys/:keyId/usage
   */
  fastify.post<{
    Params: { keyId: string };
  }>("/api/service-keys/:keyId/usage", async (request, reply) => {
    const { keyId } = request.params;
    const keys = await loadKeys();
    const keyIndex = keys.findIndex((k) => k.id === keyId);

    if (keyIndex === -1) {
      reply.code(404);
      return { error: "Key not found" };
    }

    keys[keyIndex].last_used = getCurrentTimestamp();
    await saveKeys(keys);

    return { updated: keyId };
  });
}
