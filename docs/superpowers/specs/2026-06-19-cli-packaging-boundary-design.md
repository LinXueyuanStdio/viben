# CLI Packaging Boundary 设计

## 背景

当前发布链路里同时存在两个 CLI 入口：

1. `packages/core/dist/cli/bin.js`
2. `apps/cli/dist/index.js`

其中 Desktop sidecar 使用 `packages/core/dist/cli/bin.js` 作为 Bun compile 输入，Node/npm 场景使用 `apps/cli`。这个边界会导致几个问题：

- `packages/core` 既像底层能力库，又像 CLI 产品包，职责混在一起。
- `apps/cli` 依赖并 bundle `@viben/core` 时，core 内部 optional/CJS 依赖可能被打进 ESM bundle，触发 `Dynamic require of "http" is not supported`。
- Desktop sidecar 绕过了 `apps/cli`，导致 sidecar 行为和 npm/npx 的 `viben` 行为可能分叉。
- 发布脚本、CI artifact、Tauri sidecar 输入分散在 core 和 cli 两套产物之间，后续维护成本高。

这不是单个 external 列表或 `createRequire` banner 能彻底解决的问题。根因是产品边界不清：`packages/core` 应该是能力边界，`apps/cli` 才应该是 CLI 产品边界。

## 决策

`apps/cli` 是唯一的 `viben` CLI 产品入口。

`packages/core` 不再承担发布用 CLI binary 或 Desktop sidecar 的构建职责。它可以暴露 CLI command handlers、gateway 启动函数、配置读写函数等底层能力，但不应该作为最终用户执行的 CLI 包，也不应该作为 Tauri sidecar 的输入。

Desktop bundled sidecar 必须来自 `apps/cli` 的 native/sidecar 构建产物，而不是 `packages/core/dist/cli/bin.js`。

## 目标

1. `packages/core` 能作为 npm package 独立运行、独立测试、被 Node 项目消费。
2. `apps/cli` 负责 `viben` 命令的所有产品分发形态。
3. Desktop sidecar 与 npm/npx CLI 使用同一个 CLI 产品入口，避免行为分叉。
4. Node/npm 风味和 native sidecar 风味可以有不同构建策略，但共享同一套 CLI 命令实现。
5. 移除对 `createRequire` banner 这类全局兜底补丁的依赖，把依赖边界显式建模。

## 非目标

1. 不把所有 core 依赖强行 bundle 成一个 Node ESM 文件。
2. 不要求 `packages/core` 产出用户可执行的 `viben` binary。
3. 不在 Desktop 里直接加载 TypeScript/源码。
4. 不在当前设计里替换 Tauri sidecar 机制。
5. 不把 file-native 配置改为数据库配置。

## 包职责边界

### `packages/core`

定位：底层能力 npm 包，包名 `@viben/core`。

职责：

- 提供 gateway、workspace、agent、provider、model、task、queue、cron、mcp、skill 等底层能力。
- 暴露可被 CLI 调用的函数或 command handlers。
- 维护 file-native 配置读写逻辑，配置仍存储在 `~/.viben/`。
- 可以提供测试用或开发用的内部入口，但这些入口不作为发布产品边界。

不承担：

- 不作为 `viben` npm bin 包。
- 不作为 Desktop bundled sidecar 输入。
- 不负责 Bun compile、Tauri externalBin 命名、codesign sidecar artifact。
- 不为了 CLI 产品分发去 bundle optional/CJS 生态依赖。

### `apps/cli`

定位：唯一 CLI 产品包，npm 包名 `viben`，命令名 `viben`。

职责：

- 依赖 `@viben/core`，组装用户可见 CLI 命令。
- 声明 CLI 运行时需要的直接依赖和 optional 依赖。
- 产出 Node/npm 风味，支持：
  - `npm install -g viben`
  - `npx viben`
  - `node apps/cli/dist/index.js`
- 产出 native/sidecar 风味，供 Desktop bundle。
- 统一 CLI version、help、gateway、config 等行为。

构建风味：

| 风味 | 用途 | 输入 | 输出 |
| --- | --- | --- | --- |
| Node/npm | npm、npx、本地 Node 调试 | `apps/cli/src/index.ts` | `apps/cli/dist/index.js` |
| Sidecar/native | Desktop bundled sidecar | `apps/cli` 的 native entry | `apps/desktop/src-tauri/binaries/viben-*` 或中间 artifact |

### `apps/desktop`

定位：桌面壳和 UI，使用 bundled sidecar 启动本地 gateway。

职责：

- bundle `apps/cli` 产出的 sidecar binary。
- 通过 sidecar 执行 `viben gateway ...`。
- 不直接依赖 `packages/core/dist/cli/bin.js`。
- 不复制 core 内部 dist 作为 sidecar artifact 的主入口。

## 目标架构

```
packages/core
  └─ @viben/core
      ├─ gateway capabilities
      ├─ config/workspace/agent/task capabilities
      └─ CLI command implementation primitives

apps/cli
  └─ viben
      ├─ imports @viben/core
      ├─ Node/npm flavor: dist/index.js
      └─ Sidecar flavor: native binary built from apps/cli

apps/desktop
  └─ bundles apps/cli sidecar
      └─ invokes: viben gateway start/restart/status
```

数据流：

```
Desktop UI
  -> Tauri command
  -> bundled apps/cli sidecar
  -> @viben/core gateway APIs
  -> ~/.viben/*.yaml / workspace files
```

Node/npm 数据流：

```
npx viben / npm global viben
  -> apps/cli/dist/index.js
  -> @viben/core APIs
  -> ~/.viben/*.yaml / workspace files
```

## 构建策略

### Node/npm 风味

Node/npm 风味优先服务可调试性和 npm 依赖解析。

要求：

- `apps/cli/package.json` 声明运行时需要的 dependencies/optionalDependencies。
- `apps/cli/dist/index.js` 是 Node/npm 风味和本地 Node 调试的执行入口。
- `apps/cli/dist/index.js` 不依赖全局注入的 `createRequire` banner 才能启动。
- optional/CJS 依赖不应因为 bundle core 而进入启动路径。
- `viben --version` 和 `viben --help` 不应加载 Feishu/Lark SDK、OpenTelemetry exporter、gateway server 等非必要模块。

推荐策略：

- CLI 顶层命令保持轻量。
- 按命令边界延迟加载重依赖。
- 对 optional dependencies 使用显式加载函数。
- 对 Node/npm 风味可以选择少 bundle 或不 bundle 第三方依赖，让 npm dependency graph 负责解析。

### Sidecar/native 风味

Sidecar/native 风味优先服务单文件/少文件分发和 Desktop 开箱即用。

要求：

- 输入来自 `apps/cli`，不是 `packages/core`。
- sidecar version 与 `apps/cli/package.json` 同步。
- sidecar 行为与 Node/npm 风味一致。
- templates、assets、runtime resources 从 `apps/cli` 构建流程收集，不由 Desktop 或 core 临时拼装。
- macOS codesign/notarize 只处理 sidecar binary 和 Desktop app，不影响 npm 风味。

推荐策略：

- `apps/cli` 提供 `build:sidecar` 或等价脚本，内部可使用 Bun compile。
- sidecar 构建脚本负责复制模板和运行时资源。
- CI 上传 sidecar artifact 时只上传 `apps/cli` 生成的 sidecar 输出。

## 依赖边界

`packages/core` 可以声明自身 library 需要的依赖，但不能为了 CLI 打包把 optional 生态强行塞进 ESM bundle。

`apps/cli` 必须声明 CLI 产品运行时依赖，包括从 core 功能实际触达的依赖。原因是最终用户安装的是 `viben`，不是直接安装 `@viben/core` 之后手动补依赖。

optional dependency 原则：

- 只有特定功能需要的依赖放入 optionalDependencies。
- optional dependency 必须通过明确的 loader 访问。
- loader 错误应转换为用户可理解的功能缺失提示。
- `--help`、`--version`、基础配置命令不应因为 optional dependency 缺失而失败。

## 当前状态问题清单

1. `.github/workflows/release-all.yml` 的 sidecar build 使用 `packages/core` 产物作为输入。
2. `.github/workflows/release-cli.yml` 需要同步到 `apps/cli` 作为唯一 CLI 产品包，不能保留 core CLI 产物假设。
3. `.github/workflows/release-desktop.yml` 的 Desktop sidecar 构建也必须切到 `apps/cli` sidecar artifact。
4. `packages/core/scripts/build-sidecar.ts` 当前围绕 core dist CLI 构建 sidecar。
5. `scripts/macos/build-cli.sh` 当前也以 `packages/core/dist/cli/bin.js` 为 compile 输入。
6. `apps/cli` 与 `packages/core` 都存在 CLI 入口语义。
7. `apps/cli` bundle core 后，core 的 optional/CJS 依赖可能进入 CLI ESM bundle。
8. `createRequire` banner 可以热修 Node ESM 动态 require，但掩盖了依赖边界错误。

## 迁移方案

### Phase 1：建立 `apps/cli` sidecar 构建入口

新增或调整 `apps/cli` 构建脚本：

- `build:node`：产出 Node/npm 风味。
- `build:sidecar`：产出当前平台 sidecar。
- `build:sidecar:macos-x64`：在 macOS arm64 runner 上补充 x64 sidecar。

`build:sidecar` 的输入必须在 `apps/cli` 内部，不能引用 `packages/core/dist/cli/bin.js` 作为主入口。

### Phase 2：迁移 GitHub release workflows

必须同步修改三个 workflow：

- `.github/workflows/release-all.yml`
- `.github/workflows/release-cli.yml`
- `.github/workflows/release-desktop.yml`

`release-all.yml` 修改要求：

- `build-cli` job 先构建 `@viben/core` library。
- 再构建 `apps/cli` Node/npm 风味。
- 再从 `apps/cli` 构建 sidecar/native 风味。
- 上传 `cli-build` artifact 时以 `apps/cli` 为主体。
- 上传 `sidecar-*` artifact 时以 `apps/cli` sidecar 输出为主体。

`release-cli.yml` 修改要求：

- npm publish 使用 `apps/cli` 作为发布包根目录。
- CLI release artifact 来自 `apps/cli` Node/npm 风味。
- install script、Homebrew formula、release notes 中的 CLI 安装路径和校验逻辑都以 `viben` 产品包为准。
- 不引用 `packages/core/dist/cli/bin.js` 或 core 内部 CLI dist 作为发布输入。

`release-desktop.yml` 修改要求：

- Desktop sidecar artifact 来自 `apps/cli` sidecar/native 风味。
- macOS x64/arm64、Windows、Linux 的 sidecar 构建入口统一使用 `apps/cli`。
- Tauri `externalBin` 所需文件由 `apps/cli` 构建脚本产出并复制到 `apps/desktop/src-tauri/binaries/`。
- 独立 desktop release 与 unified release 的 sidecar 产物结构保持一致。

CI 中的 Node CLI integration tests 继续使用：

```bash
./scripts/test-cli.sh --local
```

但它测试的是 `apps/cli/dist/index.js`，不再依赖 core 内部 CLI 产物。

### Phase 3：迁移本地发布脚本

修改以下脚本，使它们不再从 `packages/core/dist/cli/bin.js` 构建 sidecar：

- `scripts/macos/build-cli.sh`
- `scripts/macos/build-desktop.sh`
- `scripts/macos/check_before_release.sh`
- 其他平台 release/test 脚本中引用 core CLI sidecar 的路径。

脚本语义调整为：

- build CLI = build `apps/cli` Node/npm 风味 + sidecar/native 风味。
- build Desktop = 读取 `apps/cli` sidecar artifact 并放入 Tauri binaries。
- check before release = 同时验证 Node/npm CLI 和 Desktop sidecar。

### Phase 4：收敛 `packages/core` CLI 入口

`packages/core` 可以保留内部 CLI command implementation，但不再导出或构建发布用 `dist/cli/bin.js`。

可选收敛方式：

- 保留 `packages/core/src/cli/index.ts` 作为 command handlers。
- 删除或停止发布 `packages/core/src/cli/bin.ts`。
- 若测试仍需要 core 内部 CLI，可改为测试 handler API，而不是测试 core binary。

### Phase 5：移除热修补丁

迁移完成后，移除 `apps/cli/tsup.config.ts` 中的 ESM `createRequire` banner。

验收要求：

- 没有 banner 时 `node apps/cli/dist/index.js --version` 正常。
- 没有 banner 时 `node apps/cli/dist/index.js --help` 正常。
- 没有 banner 时 `./scripts/test-cli.sh --local` 正常。
- `apps/cli/dist/index.js` 的启动路径不触发 `Dynamic require of "http"`。

## 验收标准

### 架构验收

1. Desktop sidecar 的构建输入来自 `apps/cli`。
2. `release-all.yml`、`release-cli.yml`、`release-desktop.yml` 中不存在以 `packages/core/dist/cli/bin.js` 作为 CLI/sidecar 发布输入的步骤。
3. `packages/core` 仍可作为 library 被 `apps/cli`、`apps/desktop`、`apps/web` 间接或直接消费。
4. `apps/cli` 是唯一面向用户的 `viben` 命令产品包。

### Node/npm 验收

运行：

```bash
pnpm turbo build --filter=@viben/core
pnpm turbo build --filter=viben
node apps/cli/dist/index.js --version
node apps/cli/dist/index.js --help
./scripts/test-cli.sh --local
```

预期：

- 所有命令退出码为 0。
- `--version` 输出版本号。
- `--help` 输出 commands 列表。
- `scripts/test-cli.sh --local` 全部通过。

### Sidecar 验收

运行每个平台的 sidecar gateway 测试：

```bash
scripts/linux/test-cli-gateway.sh ./viben-x86_64-unknown-linux-gnu
scripts/macos/test-cli-gateway.sh ./viben-aarch64-apple-darwin
scripts/windows/test-cli-gateway.bat viben-x86_64-pc-windows-msvc.exe
```

预期：

- sidecar 可执行。
- `--version`、`--help` 正常。
- gateway 可启动并响应 health check。

### 打包验收

检查：

```bash
rg "packages/core/dist/cli/bin.js|dist/cli/bin.js" .github scripts apps/desktop packages/core
```

预期：

- 不再有 sidecar 构建输入依赖 `packages/core/dist/cli/bin.js`。
- 若存在 `dist/cli/bin.js`，只能是历史注释或待删除内部测试路径，不能出现在 release/desktop sidecar 主链路。

## 风险与处理

### 依赖体积变大

`apps/cli` 成为唯一产品包后，dependencies 可能变多。

处理：

- 把非基础命令依赖放到 optionalDependencies。
- 通过命令级 lazy loading 降低启动成本。
- Node/npm 风味不强求单文件 bundle。

### sidecar 与 npm 行为不一致

如果 Node/npm 和 sidecar 使用不同 entry，可能再次分叉。

处理：

- 两个风味共享同一个 CLI command registry。
- 差异只允许存在于 bootstrap/runtime adapter 层。
- `--version`、`--help`、`gateway`、`config` 作为跨风味固定验收命令。

### core 独立运行能力下降

移除 core binary 后，可能影响 core 的本地调试。

处理：

- core 保留单元测试和 handler 层调试入口。
- 需要端到端 CLI 调试时使用 `apps/cli`。
- core 不再以“能直接作为 CLI 产品运行”作为独立运行定义；core 的独立运行定义是 library build/test 可独立通过。

## 后续实现建议

优先提交顺序：

1. 新增 `apps/cli` sidecar build 脚本，但暂不切 workflow。
2. 用新脚本在本地构建并跑 sidecar gateway 测试。
3. 切换 `.github/workflows/release-all.yml` 到 `apps/cli` CLI/sidecar artifacts。
4. 切换 `.github/workflows/release-cli.yml` 到 `apps/cli` Node/npm 发布包。
5. 切换 `.github/workflows/release-desktop.yml` 到 `apps/cli` sidecar artifact。
6. 切换 `scripts/macos/*` 到新入口。
7. 删除或停用 `packages/core` 发布用 CLI bin。
8. 移除 `createRequire` banner 热修。
9. 跑完整 release 前检查。

这套迁移完成后，`@viben/core` 和 `viben` 的边界会变清楚：core 是能力包，cli 是产品包，desktop 只侧载 cli 产品。
