# CLI Packaging Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/cli` 收敛为唯一 `viben` CLI 产品入口，并让 npm/npx CLI 与 Desktop sidecar 都从 `apps/cli` 发布。

**Architecture:** `packages/core` 保持底层能力包，只暴露可复用 API 和 command implementation；`apps/cli` 负责 Node/npm 风味和 sidecar/native 风味；`apps/desktop` 只消费 `apps/cli` 产出的 sidecar。迁移按“新增 apps/cli sidecar 构建能力 → 切 GitHub workflows 和本地脚本 → 收敛 core CLI bin → 移除 createRequire 热修”的顺序推进。

**Tech Stack:** TypeScript, tsup, Bun compile, pnpm/turbo, GitHub Actions, Tauri sidecar, bash.

---

## File Structure

Create:

- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/scripts/build-sidecar.ts`
  - `apps/cli` 自己的 sidecar/native 构建脚本，取代 `packages/core/scripts/build-sidecar.ts` 的 release 主链路职责。

Modify:

- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/package.json`
  - 增加 `build:node`、`build:sidecar`、`build:sidecar:current` 等脚本。
  - 修正 `build:binary` 当前指向不存在的 `src/main.ts` 的问题。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/tsup.config.ts`
  - 去掉 ESM `createRequire` banner 热修。
  - 让 Node/npm 风味不把可选 CJS 依赖塞进启动路径。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/package.json`
  - 移除面向用户的 `bin.viben`。
  - 停用或重命名 `build:sidecar`，避免 release 主链路继续调用 core sidecar builder。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/tsup.config.ts`
  - 停止把 `src/cli/bin.ts` 作为发布用 bin entry 构建，或至少不再作为 release 输入。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-all.yml`
  - `build-cli` job 改为从 `apps/cli` 生成 Node/npm artifact 和 sidecar artifact。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-cli.yml`
  - npm publish 明确以 `apps/cli` 为发布包根。
  - 增加 Node CLI integration checks，避免只 publish 没跑 CLI。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-desktop.yml`
  - Desktop sidecar 构建入口改为 `apps/cli`。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-cli.sh`
  - macOS 本地 sidecar 构建改为调用 `apps/cli` sidecar build。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-desktop.sh`
  - 继续消费 sidecar artifact，但 artifact 来源改为 `apps/cli`。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/check_before_release.sh`
  - 验证 Node/npm CLI 和 sidecar 都来自 `apps/cli`。

Reference only:

- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/scripts/build-sidecar.ts`
  - 作为迁移参考，不再作为 release 主链路入口。
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/docs/superpowers/specs/2026-06-19-cli-packaging-boundary-design.md`
  - 设计来源。

---

### Task 1: Add apps/cli Sidecar Builder

**Files:**
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/scripts/build-sidecar.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/package.json`

- [ ] **Step 1: Create `apps/cli/scripts/build-sidecar.ts`**

Create the file by adapting the platform table and argument parsing from `packages/core/scripts/build-sidecar.ts`, but set:

```typescript
const PACKAGE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, "apps/desktop/src-tauri/binaries");
const INPUT_FILE = join(PACKAGE_ROOT, "dist/index.js");
```

The build step must run from `apps/cli`, not `packages/core`:

```typescript
function buildTypeScript(): void {
  const result = spawnSync("pnpm", ["build:node"], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error("apps/cli Node build failed");
  }
}
```

The Bun compile command must compile `apps/cli/dist/index.js`:

```typescript
const bunArgs = [
  "build",
  INPUT_FILE,
  "--compile",
  "--target",
  config.bunTarget,
  "--outfile",
  tempOutput,
];
```

Keep the Tauri sidecar output names unchanged:

```typescript
const outputName = `viben-${config.tauriSuffix}${extension}`;
```

- [ ] **Step 2: Copy runtime templates from apps/cli build output**

At the end of a successful sidecar build, copy templates into the output directory when present:

```typescript
const templatesSource = join(PACKAGE_ROOT, "dist/templates");
const templatesTarget = join(outputDir, "templates");

if (existsSync(templatesSource)) {
  rmSync(templatesTarget, { recursive: true, force: true });
  cpSync(templatesSource, templatesTarget, { recursive: true });
}
```

Add the missing imports at the top:

```typescript
import { existsSync, mkdirSync, chmodSync, renameSync, rmSync, cpSync } from "node:fs";
```

- [ ] **Step 3: Add package scripts in `apps/cli/package.json`**

Update scripts to separate Node/npm and sidecar builds:

```json
{
  "scripts": {
    "build": "pnpm build:node",
    "build:node": "tsup && npm run copy-templates",
    "build:sidecar": "tsx scripts/build-sidecar.ts",
    "build:sidecar:current": "tsx scripts/build-sidecar.ts --platform current",
    "build:sidecar:macos-x64": "tsx scripts/build-sidecar.ts --platform macos-x64",
    "copy-templates": "rm -rf dist/templates && cp -r ../../packages/core/templates dist/templates",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Remove or replace the old `build:binary` script that references `src/main.ts`, because that entry does not exist in the current `apps/cli` tree.

- [ ] **Step 4: Run targeted build**

Run:

```bash
pnpm --dir /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli build:node
```

Expected:

- `apps/cli/dist/index.js` exists.
- `apps/cli/dist/templates/` exists.
- command exits 0.

- [ ] **Step 5: Build current-platform sidecar**

Run:

```bash
pnpm --dir /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli build:sidecar:current
```

Expected:

- one `viben-*` binary appears under `apps/desktop/src-tauri/binaries/`.
- `apps/desktop/src-tauri/binaries/templates/` exists if templates were copied.
- command exits 0.

- [ ] **Step 6: Commit Task 1**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/package.json \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/scripts/build-sidecar.ts
git commit -m "feat(cli): add apps cli sidecar builder"
```

---

### Task 2: Make Node/npm CLI Flavor Clean Without createRequire Banner

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/tsup.config.ts`

- [ ] **Step 1: Remove ESM banner hotfix**

Delete this block from `apps/cli/tsup.config.ts`:

```typescript
  esbuildOptions(options, context) {
    if (context.format === 'esm') {
      options.banner = {
        ...options.banner,
        js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      };
    }
  },
```

- [ ] **Step 2: Stop bundling CJS optional dependencies into the CLI ESM bundle**

Replace the existing `external` array with:

```typescript
  external: [
    'cli-progress',
    '@hypothesi/tauri-mcp-server',
    '@larksuiteoapi/node-sdk',
    'cloudflared',
    'node-notifier',
    'node-pty',
    'axios',
    'form-data',
    'follow-redirects',
  ],
```

Keep `noExternal: ['@viben/core', '@viben/api-client']` for now so npm publishes a self-contained workspace bundle. If this still pulls dynamic CJS requires into `apps/cli/dist/index.js`, revisit command-level lazy loading in a later task instead of restoring the banner.

- [ ] **Step 3: Build Node/npm CLI flavor**

Run:

```bash
pnpm --dir /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli build:node
```

Expected: exit 0.

- [ ] **Step 4: Verify original CI failure without warnings suppression**

Run:

```bash
node /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/bin/viben.js --version
node /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/bin/viben.js --help
```

Expected:

- `--version` prints a version like `0.1.0`.
- `--help` prints `Commands:`.
- neither command prints `Dynamic require of "http" is not supported`.

- [ ] **Step 5: Run Node CLI integration test**

Run:

```bash
NODE_OPTIONS='--no-warnings' /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/test-cli.sh --local
```

Expected: `Passed: 42`, `Failed: 0`.

Use `NODE_OPTIONS='--no-warnings'` only for local Node 25 warning noise from `node:sqlite`; GitHub release workflows use Node 24.

- [ ] **Step 6: Commit Task 2**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/tsup.config.ts
git commit -m "fix(cli): externalize optional cjs dependencies"
```

---

### Task 3: Switch release-all.yml to apps/cli Artifacts

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-all.yml`

- [ ] **Step 1: Update build-cli sidecar build step**

Replace:

```yaml
      - name: Build sidecar binary
        shell: bash
        run: |
          cd packages/core
          echo "Building sidecar for current platform..."
          npx tsx scripts/build-sidecar.ts --platform current
```

with:

```yaml
      - name: Build sidecar binary
        shell: bash
        run: |
          cd apps/cli
          echo "Building sidecar for current platform from apps/cli..."
          pnpm build:sidecar -- --platform current
```

- [ ] **Step 2: Update macOS x64 sidecar build step**

Replace:

```yaml
      - name: Build additional macOS sidecar (x64)
        if: matrix.platform == 'macos-latest'
        shell: bash
        run: |
          cd packages/core
          bun build dist/cli/bin.js --compile --target bun-darwin-x64 --outfile ../../apps/desktop/src-tauri/binaries/viben-x86_64-apple-darwin
```

with:

```yaml
      - name: Build additional macOS sidecar (x64)
        if: matrix.platform == 'macos-latest'
        shell: bash
        run: |
          cd apps/cli
          pnpm build:sidecar -- --platform macos-x64 --skip-build
```

- [ ] **Step 3: Update sidecar artifact template source**

In `Prepare sidecar artifact`, replace:

```bash
cp -R packages/core/templates sidecar-artifact/templates
```

with:

```bash
cp -R apps/cli/dist/templates sidecar-artifact/templates
```

- [ ] **Step 4: Keep CLI artifact focused on apps/cli**

Update `Upload CLI build artifact` path from:

```yaml
          path: |
            apps/cli/bin/
            apps/cli/dist/
            apps/cli/package.json
            packages/core/dist/
            packages/core/package.json
```

to:

```yaml
          path: |
            apps/cli/bin/
            apps/cli/dist/
            apps/cli/package.json
```

Rationale: `apps/cli` must be the published CLI product. If `apps/cli/dist/index.js` still requires `packages/core/dist`, Task 2 is incomplete.

- [ ] **Step 5: Update release-cli verification step**

Remove the `packages/core/dist/` listing and core version print from the `Verify CLI build artifacts` step. Keep:

```bash
echo "=== CLI artifacts ==="
ls -la apps/cli/
ls -la apps/cli/dist/
ls -la apps/cli/bin/
echo "=== Version check ==="
echo "CLI version: $(jq -r '.version' apps/cli/package.json)"
```

- [ ] **Step 6: Update desktop template preparation**

In the `build-desktop` job, replace:

```bash
cp -R packages/core/templates apps/desktop/src-tauri/resources/templates
```

with:

```bash
cp -R apps/desktop/src-tauri/binaries/templates apps/desktop/src-tauri/resources/templates
```

If `apps/desktop/src-tauri/binaries/templates` does not exist after artifact download, fail the step with:

```bash
test -d apps/desktop/src-tauri/binaries/templates
```

- [ ] **Step 7: Static check release-all.yml**

Run:

```bash
rg "cd packages/core|packages/core/dist/cli/bin.js|bun build dist/cli/bin|packages/core/templates" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-all.yml
```

Expected: no matches in sidecar/CLI release paths. Matches in comments must be removed or rewritten.

- [ ] **Step 8: Commit Task 3**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-all.yml
git commit -m "ci(release): build cli sidecars from apps cli"
```

---

### Task 4: Switch release-desktop.yml to apps/cli Sidecars

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-desktop.yml`

- [ ] **Step 1: Build apps/cli before sidecar**

Replace:

```yaml
      - name: Build @viben/core (for CLI)
        run: pnpm turbo build --filter=@viben/core
```

with:

```yaml
      - name: Build @viben/core
        run: pnpm turbo build --filter=@viben/core

      - name: Build viben CLI
        run: pnpm turbo build --filter=viben
```

- [ ] **Step 2: Update current-platform sidecar build**

Replace:

```yaml
      - name: Build sidecar binary
        shell: bash
        run: |
          cd packages/core
          echo "Building sidecar for current platform..."
          npx tsx scripts/build-sidecar.ts --platform current
```

with:

```yaml
      - name: Build sidecar binary
        shell: bash
        run: |
          cd apps/cli
          echo "Building sidecar for current platform from apps/cli..."
          pnpm build:sidecar -- --platform current --skip-build
```

- [ ] **Step 3: Update macOS x64 sidecar build**

Replace:

```yaml
      - name: Build additional macOS sidecar (x64)
        if: matrix.platform == 'macos-latest'
        shell: bash
        run: |
          cd packages/core
          bun build dist/cli/bin.cjs --compile --target bun-darwin-x64 --outfile ../../apps/desktop/src-tauri/binaries/viben-x86_64-apple-darwin
```

with:

```yaml
      - name: Build additional macOS sidecar (x64)
        if: matrix.platform == 'macos-latest'
        shell: bash
        run: |
          cd apps/cli
          pnpm build:sidecar -- --platform macos-x64 --skip-build
```

- [ ] **Step 4: Prepare desktop templates from apps/cli output**

Add this step after `List sidecar binaries`:

```yaml
      - name: Prepare desktop bundled templates
        shell: bash
        run: |
          test -d apps/cli/dist/templates
          rm -rf apps/desktop/src-tauri/resources/templates
          mkdir -p apps/desktop/src-tauri/resources
          cp -R apps/cli/dist/templates apps/desktop/src-tauri/resources/templates
```

- [ ] **Step 5: Static check release-desktop.yml**

Run:

```bash
rg "cd packages/core|packages/core/dist/cli/bin|dist/cli/bin.cjs|dist/cli/bin.js|packages/core/templates" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-desktop.yml
```

Expected: no matches.

- [ ] **Step 6: Commit Task 4**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-desktop.yml
git commit -m "ci(desktop): build bundled sidecar from apps cli"
```

---

### Task 5: Tighten release-cli.yml Around apps/cli Product Package

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-cli.yml`

- [ ] **Step 1: Use shared setup action with Node 24**

Replace the manual Node/pnpm setup in `publish-npm`:

```yaml
      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - name: Setup pnpm
        uses: pnpm/action-setup@v6

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
```

with:

```yaml
      - name: Setup Node.js + pnpm
        uses: ./.github/actions/setup-node-pnpm
        with:
          registry-url: 'https://registry.npmjs.org'
```

- [ ] **Step 2: Build only core and apps/cli product path**

Replace:

```yaml
      - name: Build CLI package and dependencies
        run: pnpm --filter viben... build
```

with:

```yaml
      - name: Build @viben/core
        run: pnpm turbo build --filter=@viben/core

      - name: Build viben CLI package
        run: pnpm turbo build --filter=viben
```

- [ ] **Step 3: Add Node CLI smoke test before publish**

Add before `Verify no workspace protocol references in runtime dependencies`:

```yaml
      - name: Test Node CLI package
        run: |
          node apps/cli/bin/viben.js --version
          node apps/cli/bin/viben.js --help
          chmod +x scripts/test-cli.sh
          ./scripts/test-cli.sh --local
```

- [ ] **Step 4: Keep npm publish rooted at apps/cli**

Ensure the publish step remains:

```yaml
      - name: Publish to npm
        run: |
          cd apps/cli
          npm publish --access public
```

Do not publish `packages/core` from this workflow.

- [ ] **Step 5: Static check release-cli.yml**

Run:

```bash
rg "packages/core/dist/cli/bin|dist/cli/bin.js|dist/cli/bin.cjs|cd packages/core" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-cli.yml
```

Expected: no matches.

- [ ] **Step 6: Commit Task 5**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github/workflows/release-cli.yml
git commit -m "ci(cli): publish apps cli product package"
```

---

### Task 6: Update macOS Local Release Scripts

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-cli.sh`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-desktop.sh`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/check_before_release.sh`

- [ ] **Step 1: Update build-cli.sh header**

Change the comment:

```bash
#   - compile packages/core/dist/cli/bin.js into both macOS Tauri sidecars
```

to:

```bash
#   - compile apps/cli/dist/index.js into both macOS Tauri sidecars
```

- [ ] **Step 2: Replace direct Bun compile in build-cli.sh**

Replace the subshell:

```bash
(
  cd "$REPO_ROOT/packages/core"
  bun build dist/cli/bin.js \
    --compile \
    --target bun-darwin-arm64 \
    --outfile "$BINARIES_DIR/viben-aarch64-apple-darwin"
  bun build dist/cli/bin.js \
    --compile \
    --target bun-darwin-x64 \
    --outfile "$BINARIES_DIR/viben-x86_64-apple-darwin"
)
```

with:

```bash
(
  cd "$REPO_ROOT/apps/cli"
  pnpm build:sidecar -- --platform macos-arm64 --skip-build
  pnpm build:sidecar -- --platform macos-x64 --skip-build
)
```

This assumes the preceding `pnpm turbo build --filter=viben` already produced `apps/cli/dist/index.js`.

- [ ] **Step 3: Copy templates from apps/cli in build-cli.sh**

Replace:

```bash
cp -R "$REPO_ROOT/packages/core/templates" "$ARTIFACT_DIR/templates"
```

with:

```bash
cp -R "$REPO_ROOT/apps/cli/dist/templates" "$ARTIFACT_DIR/templates"
```

Replace:

```bash
cp -R "$REPO_ROOT/packages/core/templates" "$TAURI_TEMPLATES_DIR"
```

with:

```bash
cp -R "$REPO_ROOT/apps/cli/dist/templates" "$TAURI_TEMPLATES_DIR"
```

- [ ] **Step 4: Keep build-desktop.sh sidecar consumption unchanged**

No change is required to `build-desktop.sh` sidecar copy logic if it already consumes `artifacts/macos/sidecar`. Only update user-facing messages if they mention core.

Run:

```bash
rg "packages/core/dist/cli/bin|packages/core/templates|core dist CLI" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-desktop.sh
```

Expected: no matches. If matches exist, rewrite them to `apps/cli`.

- [ ] **Step 5: Update check_before_release.sh comments if needed**

Run:

```bash
rg "packages/core/dist/cli/bin|packages/core/templates|core dist CLI" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/check_before_release.sh
```

Expected: no matches. If matches exist, rewrite them to `apps/cli`.

- [ ] **Step 6: Run static script check**

Run:

```bash
rg "packages/core/dist/cli/bin.js|dist/cli/bin.js|packages/core/templates" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos
```

Expected: no matches.

- [ ] **Step 7: Commit Task 6**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-cli.sh \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/build-desktop.sh \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/check_before_release.sh
git commit -m "chore(release): use apps cli in macos release scripts"
```

---

### Task 7: Retire packages/core User-Facing CLI Binary

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/package.json`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/tsup.config.ts`
- Optional Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/scripts/build-sidecar.ts`

- [ ] **Step 1: Remove `bin` from core package**

Delete this block from `packages/core/package.json`:

```json
  "bin": {
    "viben": "./dist/cli/bin.js"
  },
```

- [ ] **Step 2: Rename core sidecar script to discourage release use**

Replace:

```json
    "build:sidecar": "tsx scripts/build-sidecar.ts",
```

with:

```json
    "build:sidecar:legacy": "tsx scripts/build-sidecar.ts",
```

If no caller remains after Tasks 3-6, this is enough for a first pass. Do not delete `packages/core/scripts/build-sidecar.ts` in the same task unless `rg "build-sidecar.ts|build:sidecar:legacy"` shows no useful reference and tests do not rely on it.

- [ ] **Step 3: Stop building core `cli/bin` entry**

In `packages/core/tsup.config.ts`, remove:

```typescript
    "cli/bin": "src/cli/bin.ts",
```

From the `binFiles` array in `onSuccess`, remove:

```typescript
      "dist/cli/bin.js",
      "dist/cli/bin.cjs",
```

Keep `cli/index` so `apps/cli` can still import command implementation through `@viben/core`.

- [ ] **Step 4: Build core and apps/cli**

Run:

```bash
pnpm turbo build --filter=@viben/core
pnpm turbo build --filter=viben
```

Expected: both commands exit 0.

- [ ] **Step 5: Verify no release path depends on core bin**

Run:

```bash
rg "packages/core/dist/cli/bin.js|packages/core/dist/cli/bin.cjs|dist/cli/bin.js|dist/cli/bin.cjs" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop
```

Expected: no release/desktop sidecar matches.

- [ ] **Step 6: Commit Task 7**

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/package.json \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/tsup.config.ts
git commit -m "refactor(core): retire published cli binary"
```

---

### Task 8: Full Verification and Release Readiness

**Files:**
- No planned source edits.

- [ ] **Step 1: Run Node/npm CLI verification**

Run:

```bash
pnpm turbo build --filter=@viben/core
pnpm turbo build --filter=viben
node /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/bin/viben.js --version
node /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/bin/viben.js --help
NODE_OPTIONS='--no-warnings' /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/test-cli.sh --local
```

Expected:

- build commands exit 0.
- `--version` prints a version.
- `--help` includes `Commands:`.
- test script reports `Failed: 0`.

- [ ] **Step 2: Run current-platform sidecar verification**

Run:

```bash
pnpm --dir /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli build:sidecar:current
```

Then run the platform test matching the current machine:

macOS:

```bash
/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/macos/test-cli-gateway.sh \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src-tauri/binaries/viben-aarch64-apple-darwin
```

Linux:

```bash
/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts/linux/test-cli-gateway.sh \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src-tauri/binaries/viben-x86_64-unknown-linux-gnu
```

Windows:

```cmd
scripts\windows\test-cli-gateway.bat apps\desktop\src-tauri\binaries\viben-x86_64-pc-windows-msvc.exe
```

Expected: sidecar version/help/gateway tests pass.

- [ ] **Step 3: Run static boundary checks**

Run:

```bash
rg "packages/core/dist/cli/bin.js|packages/core/dist/cli/bin.cjs|dist/cli/bin.js|dist/cli/bin.cjs" \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/.github \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/scripts \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop
```

Expected: no release/desktop sidecar input matches.

Run:

```bash
rg "createRequire\\(import.meta.url\\)|Dynamic require of" \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/tsup.config.ts \
  /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/cli/dist/index.js
```

Expected:

- no `createRequire(import.meta.url)` in `apps/cli/tsup.config.ts`.
- no `Dynamic require of` in `apps/cli/dist/index.js`.

- [ ] **Step 4: Check git status and commit verification-only docs if needed**

Run:

```bash
git status --short
```

Expected:

- only intentional changes remain.
- do not stage unrelated `infra/Yoopta-Editor` status noise.

- [ ] **Step 5: Push branch**

Run:

```bash
git push origin main
```

Expected: push succeeds and GitHub Actions start from the new head SHA.

---

## Self-Review

Spec coverage:

- `packages/core` as library boundary: Task 7.
- `apps/cli` as product boundary: Tasks 1, 2, 3, 4, 5, 6.
- Desktop sidecar from `apps/cli`: Tasks 1, 3, 4, 6, 8.
- `release-all.yml`, `release-cli.yml`, `release-desktop.yml`: Tasks 3, 5, 4.
- Remove `createRequire` hotfix: Task 2.
- Verification: Task 8.

Placeholder scan:

- No `TBD`, `TODO`, or open-ended “handle edge cases” instructions remain.
- Commands and expected outputs are specified for each verification step.

Type consistency:

- Sidecar script names use `build:sidecar`, `build:sidecar:current`, and `build:sidecar:macos-x64` consistently.
- The sidecar input is consistently `apps/cli/dist/index.js`.
- Core command implementation remains `@viben/core` `./cli` export, not `dist/cli/bin.js`.
