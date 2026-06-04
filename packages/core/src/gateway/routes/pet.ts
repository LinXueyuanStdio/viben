// packages/core/src/gateway/routes/pet.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { petManager, getPetsDir } from "../../pet";
import type { Pet, PetConfig, CommunityPet, PetSource } from "../../pet";
import { PetError } from "../../pet";

// ============================================================================
// snake_case 转换函数
// ============================================================================

function toSnakeCasePet(pet: Pet) {
  // 已安装 Pet 的 spritesheet_url 使用 Gateway asset 路由
  const spritesheetUrl = pet.isBuiltin
    ? pet.spritesheetUrl
    : `/api/pet/asset/${encodeURIComponent(pet.id)}/${pet.metadata.spritesheetPath}`;

  return {
    id: pet.id,
    metadata: {
      id: pet.metadata.id,
      display_name: pet.metadata.displayName,
      description: pet.metadata.description,
      spritesheet_path: pet.metadata.spritesheetPath,
      author: pet.metadata.author,
      tags: pet.metadata.tags,
      source: pet.metadata.source,
      source_url: pet.metadata.sourceUrl,
    },
    local_path: pet.localPath,
    spritesheet_url: spritesheetUrl,
    is_builtin: pet.isBuiltin,
    installed_at: pet.installedAt,
  };
}

function toSnakeCaseCommunityPet(pet: CommunityPet) {
  return {
    id: pet.id,
    display_name: pet.displayName,
    description: pet.description,
    author: pet.author,
    tags: pet.tags,
    thumbnail_url: pet.thumbnailUrl,
    download_url: pet.downloadUrl,
    source: pet.source,
  };
}

function toSnakeCaseConfig(config: PetConfig) {
  return {
    current: config.current,
    enabled: config.enabled,
    preferences: config.preferences,
  };
}

function toSnakeCaseSource(source: PetSource) {
  return {
    name: source.name,
    url: source.url,
    enabled: source.enabled,
    builtin: source.builtin,
  };
}

// ============================================================================
// 错误处理
// ============================================================================

function handlePetError(error: unknown, reply: FastifyReply) {
  if (error instanceof PetError) {
    const statusMap: Record<string, number> = {
      PET_NOT_FOUND: 404,
      SOURCE_NOT_FOUND: 404,
      PET_IS_BUILTIN: 400,
      SOURCE_IS_BUILTIN: 400,
      SOURCE_EXISTS: 409,
      INVALID_URL: 400,
      INVALID_ZIP: 400,
      INVALID_PET_FORMAT: 400,
      DOWNLOAD_FAILED: 502,
      FILE_TOO_LARGE: 413,
    };
    reply.code(statusMap[error.code] ?? 500);
    return { error: error.message, code: error.code };
  }
  reply.code(500);
  return { error: error instanceof Error ? error.message : "Unknown error" };
}

// ============================================================================
// 路由注册
// ============================================================================

export function registerPetRoutes(fastify: FastifyInstance): void {
  // GET /api/pet/list - 列出所有 Pet
  fastify.get("/api/pet/list", async () => {
    const [pets, config] = await Promise.all([
      petManager.listPets(),
      petManager.getConfig(),
    ]);
    return {
      pets: pets.map(toSnakeCasePet),
      current: config.current,
    };
  });

  // GET /api/pet/show/:id - 获取 Pet 详情
  fastify.get(
    "/api/pet/show/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const pet = await petManager.getPet(request.params.id);
        if (!pet) {
          reply.code(404);
          return { error: "Pet not found", code: "PET_NOT_FOUND" };
        }
        return { pet: toSnakeCasePet(pet) };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // POST /api/pet/set/:id - 设置当前 Pet
  fastify.post(
    "/api/pet/set/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        await petManager.setCurrent(request.params.id);
        return { success: true, current: request.params.id };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // POST /api/pet/remove/:id - 删除已安装 Pet
  fastify.post(
    "/api/pet/remove/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        await petManager.removePet(request.params.id);
        return { success: true, removed: request.params.id };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // GET /api/pet/community - 列出社区 Pet
  fastify.get(
    "/api/pet/community",
    async (request: FastifyRequest<{ Querystring: { source?: string } }>) => {
      const pets = await petManager.listCommunityPets(request.query.source);
      return { pets: pets.map(toSnakeCaseCommunityPet) };
    },
  );

  // GET /api/pet/search - 搜索社区 Pet
  fastify.get(
    "/api/pet/search",
    async (request: FastifyRequest<{ Querystring: { q?: string } }>) => {
      const query = request.query.q ?? "";
      const pets = await petManager.searchCommunityPets(query);
      return { pets: pets.map(toSnakeCaseCommunityPet) };
    },
  );

  // GET /api/pet/preview/:id - 预览社区 Pet 信息
  fastify.get(
    "/api/pet/preview/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { source?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const pet = await petManager.previewPet(request.params.id, request.query.source);
        if (!pet) {
          reply.code(404);
          return { error: "Pet not found", code: "PET_NOT_FOUND" };
        }
        return { pet: toSnakeCaseCommunityPet(pet) };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // POST /api/pet/install - 安装社区 Pet
  fastify.post(
    "/api/pet/install",
    async (
      request: FastifyRequest<{ Body: { pet_id: string; source: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { pet_id, source } = request.body;
        const pet = await petManager.installPet(pet_id, source);
        return { pet: toSnakeCasePet(pet) };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // GET /api/pet/config - 获取配置
  fastify.get("/api/pet/config", async () => {
    const config = await petManager.getConfig();
    return { config: toSnakeCaseConfig(config) };
  });

  // PUT /api/pet/config - 更新配置
  fastify.put(
    "/api/pet/config",
    async (
      request: FastifyRequest<{ Body: Partial<PetConfig> }>,
      reply: FastifyReply,
    ) => {
      try {
        const config = await petManager.setConfig(request.body);
        return { config: toSnakeCaseConfig(config) };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // GET /api/pet/sources/list - 列出来源
  fastify.get("/api/pet/sources/list", async () => {
    const sources = await petManager.listSources();
    return { sources: sources.map(toSnakeCaseSource) };
  });

  // POST /api/pet/sources/add - 添加来源
  fastify.post(
    "/api/pet/sources/add",
    async (
      request: FastifyRequest<{ Body: { name: string; url: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { name, url } = request.body;
        const source = await petManager.addSource(name, url);
        return { source: toSnakeCaseSource(source) };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // POST /api/pet/sources/remove/:name - 删除来源
  fastify.post(
    "/api/pet/sources/remove/:name",
    async (
      request: FastifyRequest<{ Params: { name: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        await petManager.removeSource(request.params.name);
        return { success: true, removed: request.params.name };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // POST /api/pet/import - 导入本地 Pet
  fastify.post(
    "/api/pet/import",
    async (
      request: FastifyRequest<{ Body: { path: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const pet = await petManager.importPet(request.body.path);
        return { pet: toSnakeCasePet(pet) };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // GET /api/pet/export/:id - 导出 Pet 为 zip
  fastify.get(
    "/api/pet/export/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { out_path?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const outPath = request.query.out_path ?? `/tmp/${request.params.id}.zip`;
        const path = await petManager.exportPet(request.params.id, outPath);
        return { path };
      } catch (error) {
        return handlePetError(error, reply);
      }
    },
  );

  // GET /api/pet/asset/:id/:filename - 提供已安装 Pet 的资源文件
  fastify.get(
    "/api/pet/asset/:id/:filename",
    async (
      request: FastifyRequest<{ Params: { id: string; filename: string } }>,
      reply: FastifyReply,
    ) => {
      const { id, filename } = request.params;

      // 安全检查：防止路径穿越
      if (id.includes("..") || id.includes("/") || filename.includes("..") || filename.includes("/")) {
        reply.code(400);
        return { error: "Invalid path" };
      }

      // 只允许图片格式
      const allowedExts = [".webp", ".png", ".gif"];
      const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
      if (!allowedExts.includes(ext)) {
        reply.code(400);
        return { error: "Invalid file type" };
      }

      const filePath = join(getPetsDir(), id, filename);
      if (!existsSync(filePath)) {
        reply.code(404);
        return { error: "File not found" };
      }

      const stats = await stat(filePath);
      const mimeMap: Record<string, string> = {
        ".webp": "image/webp",
        ".png": "image/png",
        ".gif": "image/gif",
      };

      reply.header("Content-Type", mimeMap[ext] ?? "application/octet-stream");
      reply.header("Content-Length", stats.size);
      reply.header("Cache-Control", "public, max-age=86400");
      return reply.send(createReadStream(filePath));
    },
  );
}
