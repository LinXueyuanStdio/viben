# Phase 1 — packages 移植

**目标**：将 open-agents 的三个 package 复制到 viben，改名为 `@viben/*`，确保各自 typecheck 通过。

## 文件操作清单

### 1.1 复制 packages/agent

从 `D:\Document\Github\LinXueyuanStdio\open-agents\packages\agent\` 复制所有文件到 `D:\Document\Github\LinXueyuanStdio\viben\packages\agent\`。

### 1.2 复制 packages/sandbox

从 `D:\Document\Github\LinXueyuanStdio\open-agents\packages\sandbox\` 复制所有文件到 `D:\Document\Github\LinXueyuanStdio\viben\packages\sandbox\`。

### 1.3 复制 packages/shared

从 `D:\Document\Github\LinXueyuanStdio\open-agents\packages\shared\` 复制所有文件到 `D:\Document\Github\LinXueyuanStdio\viben\packages\shared\`。

### 1.4 修改 package.json（三个 package 各一个）

每个 package 的 `package.json` 需要修改 `name` 和 `dependencies` 中的引用：

**packages/agent/package.json** 改动：
- `"name": "@open-agents/agent"` → `"name": "@viben/agent"`
- `"@open-agents/sandbox": "workspace:*"` → `"@viben/sandbox": "workspace:*"`

**packages/sandbox/package.json** 改动：
- `"name": "@open-agents/sandbox"` → `"name": "@viben/sandbox"`

**packages/shared/package.json** 改动：
- `"name": "@open-agents/shared"` → `"name": "@viben/shared"`

### 1.5 修改 tsconfig.json（三个 package 各一个）

每个 package 的 `tsconfig.json` 需要修改 extends 路径。viben 的 packages 目前使用什么 tsconfig base 需要先检查。

### 1.6 全局替换 package 引用（三个 package 内所有文件）

在 `packages/agent/`、`packages/sandbox/`、`packages/shared/` 三个目录下：
- `@open-agents/agent` → `@viben/agent`
- `@open-agents/sandbox` → `@viben/sandbox`
- `@open-agents/shared` → `@viben/shared`

## 实施步骤

- [ ] **Step 1: 复制 packages/agent**

```bash
cp -r "D:/Document/Github/LinXueyuanStdio/open-agents/packages/agent" "D:/Document/Github/LinXueyuanStdio/viben/packages/agent"
```

- [ ] **Step 2: 复制 packages/sandbox**

```bash
cp -r "D:/Document/Github/LinXueyuanStdio/open-agents/packages/sandbox" "D:/Document/Github/LinXueyuanStdio/viben/packages/sandbox"
```

- [ ] **Step 3: 复制 packages/shared**

```bash
cp -r "D:/Document/Github/LinXueyuanStdio/open-agents/packages/shared" "D:/Document/Github/LinXueyuanStdio/viben/packages/shared"
```

- [ ] **Step 4: 修改 packages/agent/package.json**

文件：`D:\Document\Github\LinXueyuanStdio\viben\packages\agent\package.json`

- `"name": "@open-agents/agent"` → `"name": "@viben/agent"`
- `"@open-agents/sandbox": "workspace:*"` → `"@viben/sandbox": "workspace:*"`

- [ ] **Step 5: 修改 packages/sandbox/package.json**

文件：`D:\Document\Github\LinXueyuanStdio\viben\packages\sandbox\package.json`

- `"name": "@open-agents/sandbox"` → `"name": "@viben/sandbox"`

- [ ] **Step 6: 修改 packages/shared/package.json**

文件：`D:\Document\Github\LinXueyuanStdio\viben\packages\shared\package.json`

- `"name": "@open-agents/shared"` → `"name": "@viben/shared"`

- [ ] **Step 7: 检查并修改 tsconfig.json**

先检查 viben 现有 packages 的 tsconfig 配置，然后修改三个新 package 的 tsconfig.json 使其与 viben 体系对齐。

```bash
# 查看 viben 现有 package 的 tsconfig 参考
cat packages/core/tsconfig.json 2>/dev/null || echo "no existing package tsconfig"
```

- [ ] **Step 8: 全局替换 @open-agents/* 引用**

在三个 package 目录中，将所有 `@open-agents/` 引用改为 `@viben/`。

```bash
# 在 packages/agent/、packages/sandbox/、packages/shared/ 中
# 搜索并替换所有 @open-agents/ 前缀
grep -r "@open-agents/" packages/agent packages/sandbox packages/shared --files-with-matches
```

对每个匹配的文件，将：
- `@open-agents/agent` → `@viben/agent`
- `@open-agents/sandbox` → `@viben/sandbox`
- `@open-agents/shared` → `@viben/shared`

- [ ] **Step 9: 验证 — packages/agent typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/packages/agent && pnpm typecheck
```

预期：通过（或仅有 tsconfig 相关的预期错误）

- [ ] **Step 10: 验证 — packages/sandbox typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/packages/sandbox && pnpm typecheck
```

预期：通过（或仅有 tsconfig 相关的预期错误）

- [ ] **Step 11: 验证 — packages/shared typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/packages/shared && pnpm typecheck
```

预期：通过（或仅有 tsconfig 相关的预期错误）

- [ ] **Step 12: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add packages/agent packages/sandbox packages/shared
git commit -m "feat: 移植 open-agents packages (agent/sandbox/shared) 到 @viben/*"
```
