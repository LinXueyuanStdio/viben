# Pet Gateway & CLI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现 Pet 管理的 Gateway API 路由和 CLI 命令

**Spec:** `docs/superpowers/specs/2026-06-03-pet-management-design.md`

**Depends on:** `2026-06-03-pet-01-core.md` (必须先完成 Core 模块)

**Architecture:** Gateway 路由调用 petManager 单例，CLI 命令通过 commander 注册子命令，两者共用 Core 模块逻辑。

**Tech Stack:** Fastify (Gateway), Commander.js (CLI), chalk (CLI 输出)

---

## 文件结构

```
packages/core/src/
├── gateway/routes/
│   └── pet.ts                # Pet API 路由
└── cli/commands/
    └── pet.ts                # Pet CLI 命令
```

---

## Task 1: 创建 Gateway 路由文件（基础结构）

**Files:**
- Create: `packages/core/src/gateway/routes/pet.ts`

- [ ] **Step 1: 创建路由文件基础结构**

```typescript
// packages/core/src/gateway/routes/pet.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { petManager } from "../../pet";
import type { Pet, PetConfig, CommunityPet, PetSource } from "../../pet";
import { PetError } from "../../pet";

// ============================================================================
// snake_case 转换函数
// ============================================================================

function toSnakeCasePet(pet: Pet) {
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
    spritesheet_url: pet.spritesheetUrl,
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
  // 路由将在后续步骤中添加
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /root/viben && pnpm exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/pet.ts
git commit -m "feat(pet): add gateway routes base structure"
```

---

## Task 2: 添加 Pet 列表和详情路由

**Files:**
- Modify: `packages/core/src/gateway/routes/pet.ts`

- [ ] **Step 1: 在 registerPetRoutes 函数中添加路由**

在 `registerPetRoutes` 函数内添加：

```typescript
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /root/viben && pnpm exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/pet.ts
git commit -m "feat(pet): add list and show routes"
```

---

## Task 3: 添加 Pet 设置和删除路由

**Files:**
- Modify: `packages/core/src/gateway/routes/pet.ts`

- [ ] **Step 1: 添加 set 和 remove 路由**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/pet.ts
git commit -m "feat(pet): add set and remove routes"
```

---

## Task 4: 添加社区 Pet 路由

**Files:**
- Modify: `packages/core/src/gateway/routes/pet.ts`

- [ ] **Step 1: 添加 community、search、preview、install 路由**

```typescript
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
      const pet = await petManager.previewPet(request.params.id, request.query.source);
      if (!pet) {
        reply.code(404);
        return { error: "Pet not found", code: "PET_NOT_FOUND" };
      }
      return { pet: toSnakeCaseCommunityPet(pet) };
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/pet.ts
git commit -m "feat(pet): add community pet routes"
```

---

## Task 5: 添加配置和来源管理路由

**Files:**
- Modify: `packages/core/src/gateway/routes/pet.ts`

- [ ] **Step 1: 添加 config 和 sources 路由**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/pet.ts
git commit -m "feat(pet): add config and sources routes"
```

---

## Task 6: 添加导入导出路由

**Files:**
- Modify: `packages/core/src/gateway/routes/pet.ts`

- [ ] **Step 1: 添加 import 和 export 路由**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/pet.ts
git commit -m "feat(pet): add import and export routes"
```

---

## Task 7: 注册路由到 Gateway

**Files:**
- Modify: `packages/core/src/gateway/routes/index.ts`

- [ ] **Step 1: 在 routes/index.ts 中导入并注册 pet 路由**

找到 `registerRoutes` 函数，添加：

```typescript
import { registerPetRoutes } from "./pet";

// 在 registerRoutes 函数内添加：
registerPetRoutes(fastify);
```

- [ ] **Step 2: 验证 Gateway 构建**

Run: `cd /root/viben/packages/core && pnpm build`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/index.ts
git commit -m "feat(pet): register pet routes in gateway"
```

---

## Task 8: 创建 CLI 命令基础结构

**Files:**
- Create: `packages/core/src/cli/commands/pet.ts`

- [ ] **Step 1: 创建 CLI 命令文件**

```typescript
// packages/core/src/cli/commands/pet.ts
import type { Command } from "commander";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
} from "../lib";
import { petManager, PetError } from "../../pet";

function getContext(cmd: Command): OutputContext {
  const opts = cmd.optsWithGlobals();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

export function registerPetCommand(program: Command): void {
  const pet = program.command("pet").description("Manage pets");

  // pet list (alias: ls)
  pet
    .command("list")
    .alias("ls")
    .description("List all pets (builtin + installed)")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const [pets, config] = await Promise.all([
          petManager.listPets(),
          petManager.getConfig(),
        ]);

        output(ctx, successResponse({ pets, current: config.current }), () => {
          if (pets.length === 0) {
            console.log(chalk.gray("No pets installed"));
            return;
          }
          outputTable(
            ctx,
            ["ID", "Name", "Source", "Current"],
            pets.map((p) => [
              p.id,
              p.metadata.displayName,
              p.isBuiltin ? "builtin" : p.metadata.source ?? "local",
              config.current === p.id ? chalk.green("✓") : "",
            ]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet show <id>
  pet
    .command("show <id>")
    .description("Show pet details")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        const p = await petManager.getPet(id);
        if (!p) {
          throw new PetError(`Pet "${id}" not found`, "PET_NOT_FOUND");
        }

        output(ctx, successResponse({ pet: p }), () => {
          console.log(chalk.bold(`Pet: ${p.metadata.displayName}`));
          outputKeyValue(ctx, {
            ID: p.id,
            Description: p.metadata.description,
            Author: p.metadata.author ?? "-",
            Tags: p.metadata.tags?.join(", ") ?? "-",
            Builtin: p.isBuiltin ? "Yes" : "No",
            Path: p.localPath,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet set <id>
  pet
    .command("set <id>")
    .description("Set current pet")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        await petManager.setCurrent(id);
        output(ctx, successResponse({ current: id }), () => {
          outputSuccess(ctx, `Set current pet to "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // 后续命令在 Task 9-11 中添加
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /root/viben && pnpm exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/commands/pet.ts
git commit -m "feat(pet): add CLI base structure with list, show, set commands"
```

---

## Task 9: 添加 remove 和 import/export CLI 命令

**Files:**
- Modify: `packages/core/src/cli/commands/pet.ts`

- [ ] **Step 1: 在 registerPetCommand 函数内添加命令**

```typescript
  // pet remove <id> (alias: rm)
  pet
    .command("remove <id>")
    .alias("rm")
    .description("Remove an installed pet")
    .option("-y, --yes", "Skip confirmation")
    .action(async function (this: Command, id: string, options: { yes?: boolean }) {
      const ctx = getContext(this);
      try {
        if (!options.yes) {
          const readline = await import("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Are you sure you want to remove "${id}"? [y/N] `, resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log(chalk.gray("Cancelled"));
            return;
          }
        }

        await petManager.removePet(id);
        output(ctx, successResponse({ removed: id }), () => {
          outputSuccess(ctx, `Removed pet "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet import <path>
  pet
    .command("import <path>")
    .description("Import pet from local zip file")
    .action(async function (this: Command, zipPath: string) {
      const ctx = getContext(this);
      try {
        const pet = await petManager.importPet(zipPath);
        output(ctx, successResponse({ pet }), () => {
          outputSuccess(ctx, `Imported pet "${pet.metadata.displayName}" (${pet.id})`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet export <id>
  pet
    .command("export <id>")
    .description("Export pet to zip file")
    .option("-o, --output <path>", "Output path")
    .action(async function (this: Command, id: string, options: { output?: string }) {
      const ctx = getContext(this);
      try {
        const outPath = options.output ?? `./${id}.zip`;
        const path = await petManager.exportPet(id, outPath);
        output(ctx, successResponse({ path }), () => {
          outputSuccess(ctx, `Exported pet to "${path}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/cli/commands/pet.ts
git commit -m "feat(pet): add remove, import, export CLI commands"
```

---

## Task 10: 添加社区 Pet CLI 命令

**Files:**
- Modify: `packages/core/src/cli/commands/pet.ts`

- [ ] **Step 1: 添加 community、search、preview、install 命令**

```typescript
  // pet community
  pet
    .command("community")
    .description("List community pets")
    .option("-s, --source <source>", "Filter by source")
    .action(async function (this: Command, options: { source?: string }) {
      const ctx = getContext(this);
      try {
        const pets = await petManager.listCommunityPets(options.source);
        output(ctx, successResponse({ pets }), () => {
          if (pets.length === 0) {
            console.log(chalk.gray("No community pets found"));
            return;
          }
          outputTable(
            ctx,
            ["ID", "Name", "Author", "Source"],
            pets.map((p) => [p.id, p.displayName, p.author ?? "-", p.source]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet search <query>
  pet
    .command("search <query>")
    .description("Search community pets")
    .action(async function (this: Command, query: string) {
      const ctx = getContext(this);
      try {
        const pets = await petManager.searchCommunityPets(query);
        output(ctx, successResponse({ pets }), () => {
          if (pets.length === 0) {
            console.log(chalk.gray(`No pets found matching "${query}"`));
            return;
          }
          outputTable(
            ctx,
            ["ID", "Name", "Author", "Source"],
            pets.map((p) => [p.id, p.displayName, p.author ?? "-", p.source]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet preview <id>
  pet
    .command("preview <id>")
    .description("Preview community pet info")
    .option("-s, --source <source>", "Specify source")
    .action(async function (this: Command, id: string, options: { source?: string }) {
      const ctx = getContext(this);
      try {
        const pet = await petManager.previewPet(id, options.source);
        if (!pet) {
          throw new PetError(`Pet "${id}" not found`, "PET_NOT_FOUND");
        }
        output(ctx, successResponse({ pet }), () => {
          console.log(chalk.bold(`Pet: ${pet.displayName}`));
          outputKeyValue(ctx, {
            ID: pet.id,
            Description: pet.description,
            Author: pet.author ?? "-",
            Tags: pet.tags?.join(", ") ?? "-",
            Source: pet.source,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet install <id>
  pet
    .command("install <id>")
    .description("Install community pet")
    .option("-s, --source <source>", "Specify source", "codex-pet-share")
    .action(async function (this: Command, id: string, options: { source: string }) {
      const ctx = getContext(this);
      try {
        const pet = await petManager.installPet(id, options.source);
        output(ctx, successResponse({ pet }), () => {
          outputSuccess(ctx, `Installed pet "${pet.metadata.displayName}" (${pet.id})`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/cli/commands/pet.ts
git commit -m "feat(pet): add community, search, preview, install CLI commands"
```

---

## Task 11: 添加来源管理 CLI 命令

**Files:**
- Modify: `packages/core/src/cli/commands/pet.ts`

- [ ] **Step 1: 添加 sources 子命令**

```typescript
  // pet sources (subcommand group)
  const sources = pet.command("sources").description("Manage pet sources");

  // pet sources list
  sources
    .command("list")
    .description("List all sources")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const sourceList = await petManager.listSources();
        output(ctx, successResponse({ sources: sourceList }), () => {
          if (sourceList.length === 0) {
            console.log(chalk.gray("No sources configured"));
            return;
          }
          outputTable(
            ctx,
            ["Name", "URL", "Enabled", "Builtin"],
            sourceList.map((s) => [
              s.name,
              s.url.length > 40 ? s.url.substring(0, 37) + "..." : s.url,
              s.enabled ? chalk.green("Yes") : chalk.red("No"),
              s.builtin ? "Yes" : "No",
            ]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet sources add
  sources
    .command("add")
    .description("Add a new source")
    .requiredOption("-n, --name <name>", "Source name")
    .requiredOption("-u, --url <url>", "Source URL (must be HTTPS)")
    .action(async function (this: Command, options: { name: string; url: string }) {
      const ctx = getContext(this);
      try {
        const source = await petManager.addSource(options.name, options.url);
        output(ctx, successResponse({ source }), () => {
          outputSuccess(ctx, `Added source "${source.name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet sources remove <name>
  sources
    .command("remove <name>")
    .description("Remove a source")
    .action(async function (this: Command, name: string) {
      const ctx = getContext(this);
      try {
        await petManager.removeSource(name);
        output(ctx, successResponse({ removed: name }), () => {
          outputSuccess(ctx, `Removed source "${name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/cli/commands/pet.ts
git commit -m "feat(pet): add sources management CLI commands"
```

---

## Task 12: 注册 CLI 命令

**Files:**
- Modify: `packages/core/src/cli/commands/index.ts`

- [ ] **Step 1: 在 commands/index.ts 中导入并注册 pet 命令**

```typescript
import { registerPetCommand } from "./pet";

// 在 registerCommands 函数内添加：
registerPetCommand(program);
```

- [ ] **Step 2: 验证 CLI 构建**

Run: `cd /root/viben/packages/core && pnpm build`
Expected: 构建成功

- [ ] **Step 3: 测试 CLI 帮助**

Run: `cd /root/viben && pnpm viben pet --help`
Expected: 显示 pet 命令帮助信息

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/index.ts
git commit -m "feat(pet): register pet command in CLI"
```
