# Media Provider Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Viben 现有 provider/model 体系中加入媒体生成 Provider 和 Model，并让 CLI、Gateway、Desktop 模型设置页共用 core 统一实现。

**Architecture:** `packages/core/src/providers` 和 `packages/core/src/models` 保持唯一配置实现边界，扩展 schema 支持 `category`、`surfaces`、`surface`、`capabilities` 和 surface 默认值。CLI 与 Gateway 只包装 core manager；Desktop 只通过 Gateway client 读写配置。

**Tech Stack:** TypeScript, pnpm, Vitest, Fastify routes, React Desktop UI, YAML file-native config.

---

### Task 1: Core Provider Schema

**Files:**
- Modify: `/root/viben/packages/core/src/types/index.ts`
- Modify: `/root/viben/packages/core/src/providers/types.ts`
- Modify: `/root/viben/packages/core/src/providers/index.ts`
- Test: `/root/viben/packages/core/src/cli/commands/provider-execution.test.ts`

- [ ] **Step 1: Write provider schema tests**

Add tests that create a media provider with `category: "media"` and `surfaces: ["image", "video"]`, reload the manager, and assert the provider round-trips with `provider_type` YAML compatibility.

Run: `pnpm --filter @viben/core test -- provider-execution.test.ts`
Expected: FAIL because Provider types and manager do not support `category` or `surfaces`.

- [ ] **Step 2: Implement provider schema**

Add `ProviderCategory`, `ProviderSurface`, extended `ProviderType`, `surfaces`, `supportsCustomModel`, `supports_custom_model`, `defaults`, and compatibility for legacy YAML `type`.

- [ ] **Step 3: Verify provider tests**

Run: `pnpm --filter @viben/core test -- provider-execution.test.ts`
Expected: PASS.

### Task 2: Core Model Schema

**Files:**
- Modify: `/root/viben/packages/core/src/types/index.ts`
- Modify: `/root/viben/packages/core/src/models/types.ts`
- Modify: `/root/viben/packages/core/src/models/known-models.ts`
- Modify: `/root/viben/packages/core/src/models/index.ts`
- Test: `/root/viben/packages/core/src/cli/commands/model-execution.test.ts`

- [ ] **Step 1: Write model schema tests**

Add tests that create a media model with `category: "media"`, `surface: "image"`, and `capabilities: ["t2i"]`, list by surface, set surface default, and reload from YAML.

Run: `pnpm --filter @viben/core test -- model-execution.test.ts`
Expected: FAIL because ModelManager does not support media fields, filtering, or surface defaults.

- [ ] **Step 2: Implement model schema**

Extend known model metadata with a small first batch of media models, add list filters, create/update media fields, surface defaults, and `fallbacks_by_surface`.

- [ ] **Step 3: Verify model tests**

Run: `pnpm --filter @viben/core test -- model-execution.test.ts`
Expected: PASS.

### Task 3: CLI Wrappers

**Files:**
- Modify: `/root/viben/packages/core/src/cli/commands/provider.ts`
- Modify: `/root/viben/packages/core/src/cli/commands/model.ts`
- Test: `/root/viben/packages/core/src/cli/commands/provider.test.ts`
- Test: `/root/viben/packages/core/src/cli/commands/model.test.ts`

- [ ] **Step 1: Write CLI option tests**

Assert `provider list --category media --surface image`, `provider create -t fal --category media --surface image --surface video`, `model list --category media --surface image`, and `model set-default -n gpt-image-2 --surface image`.

Run: `pnpm --filter @viben/core test -- provider.test.ts model.test.ts`
Expected: FAIL because CLI options are missing.

- [ ] **Step 2: Implement CLI options**

Wire category/surface options into managers and extend human table output with category/surface/capability columns.

- [ ] **Step 3: Verify CLI tests**

Run: `pnpm --filter @viben/core test -- provider.test.ts model.test.ts`
Expected: PASS.

### Task 4: Gateway API

**Files:**
- Modify: `/root/viben/packages/core/src/gateway/routes/providers.ts`
- Modify: `/root/viben/packages/core/src/gateway/routes/models.ts`
- Test: `/root/viben/packages/core/src/gateway/routes/models.test.ts`
- Test: `/root/viben/packages/core/src/gateway/routes/models.integration.test.ts`

- [ ] **Step 1: Write Gateway tests**

Assert snake_case query params `category`, `surface`, `provider_id`, response fields `category`, `surface`, `capabilities`, `surfaces`, and surface default routes.

Run: `pnpm --filter @viben/core test -- models.test.ts models.integration.test.ts`
Expected: FAIL because routes do not expose media fields.

- [ ] **Step 2: Implement Gateway routes**

Map request/response snake_case fields to core manager calls and keep legacy model/provider routes working.

- [ ] **Step 3: Verify Gateway tests**

Run: `pnpm --filter @viben/core test -- models.test.ts models.integration.test.ts`
Expected: PASS.

### Task 5: Desktop Gateway Types and Settings UI

**Files:**
- Modify: `/root/viben/apps/desktop/src/lib/gateway/types/model.ts`
- Modify: `/root/viben/apps/desktop/src/lib/gateway/modules/providers.ts`
- Modify: `/root/viben/apps/desktop/src/hooks/use-providers.ts`
- Modify: `/root/viben/apps/desktop/src/pages/settings/model.tsx` or the actual model section file discovered during implementation

- [ ] **Step 1: Locate model settings section**

Use `rg` to find the active desktop model settings component and existing provider hooks.

- [ ] **Step 2: Update Gateway client types**

Add `category`, `surfaces`, `surface`, `capabilities`, `supports_custom_model`, and filter options with snake_case API calls.

- [ ] **Step 3: Update model settings UI**

Add surface segmented controls for LLM, image, video, music, speech, and sfx; show provider/model rows for selected surface; expose create/edit/default/enable actions using existing UI patterns.

- [ ] **Step 4: Verify desktop typecheck/build**

Run: `pnpm --filter @viben/desktop typecheck`
Expected: PASS.

### Task 6: Full Verification

**Files:**
- No code edits unless verification exposes defects.

- [ ] **Step 1: Run focused core tests**

Run: `pnpm --filter @viben/core test -- provider-execution.test.ts model-execution.test.ts provider.test.ts model.test.ts models.test.ts models.integration.test.ts`
Expected: PASS.

- [ ] **Step 2: Run workspace typecheck/build**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Report remaining dirty files**

Run: `git status --short`
Expected: Report files changed by this task separately from pre-existing user changes.
