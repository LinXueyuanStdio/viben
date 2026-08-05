# Phase 2 — 依赖安装

**目标**：更新 `apps/web/package.json` 添加所有新依赖，确保 `pnpm install` 成功。

## 需要新增的依赖

从 open-agents `apps/web/package.json` 对比 viben `apps/web/package.json`，以下依赖是 viben 没有的：

### workspace 依赖

```
"@viben/agent": "workspace:*"
"@viben/sandbox": "workspace:*"
"@viben/shared": "workspace:*"
```

### 第三方依赖（AI / Agent 相关）

```
"@ai-sdk/elevenlabs": "^2.0.29"
"@ai-sdk/react": "catalog:"
"@octokit/auth-app": "^8.2.0"
"@octokit/rest": "^22.0.1"
"@pierre/diffs": "^1.0.10"
"@pierre/trees": "^1.0.0-beta.3"
"@streamdown/code": "^1.1.1"
"@vercel/oidc": "^2.0.0"
"@vercel/sandbox": "2.0.0-beta.11"
"@workflow/ai": "5.0.0-beta.13"
"ai": "catalog:"
"arctic": "^3.7.0"
"ioredis": "^5.9.2"
"jose": "^6.1.3"
"server-only": "^0.0.1"
"streamdown": "^2.5.0"
"swr": "^2.3.8"
"workflow": "5.0.0-beta.27"
```

### 需要版本对比的已有依赖

viben 可能已有这些依赖，但版本不同。需要确认：

| 依赖 | open-agents 版本 | viben 现有版本 |
|------|-----------------|---------------|
| `lucide-react` | ^0.562.0 | 需要检查 |
| `react` | 19.2.3 | 需要检查 |
| `react-dom` | 19.2.3 | 需要检查 |
| `next` | 16.2.1 | 需要检查 |
| `drizzle-orm` | ^0.45.1 | 需要检查 |
| `tailwind-merge` | ^3.4.0 | 需要检查 |
| `zod` | catalog: | 需要检查 |
| `sonner` | ^2.0.7 | 需要检查 |
| `nanoid` | ^5.1.6 | 需要检查 |
| `date-fns` | ^4.1.0 | 需要检查 |
| `clsx` | ^2.1.1 | 需要检查 |
| `class-variance-authority` | ^0.7.1 | 需要检查 |
| `cmdk` | ^1.1.1 | 需要检查 |
| `postgres` | ^3.4.8 | 需要检查 |

## 实施步骤

- [ ] **Step 1: 检查 viben apps/web 现有依赖版本**

```bash
cat D:/Document/Github/LinXueyuanStdio/viben/apps/web/package.json
```

对比上表中 open-agents 的版本，记录需要升/降级的依赖。

- [ ] **Step 2: 添加 workspace 依赖**

编辑 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\package.json`，在 `dependencies` 中添加：

```json
"@viben/agent": "workspace:*",
"@viben/sandbox": "workspace:*",
"@viben/shared": "workspace:*",
```

- [ ] **Step 3: 添加新的第三方依赖**

编辑 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\package.json`，在 `dependencies` 中添加所有新依赖（使用 open-agents 的版本号）。

- [ ] **Step 4: 处理版本冲突**

如果 viben 已有某个依赖但版本较低，保持 viben 现有版本不升级（避免影响其他功能）。如果 open-agents 需要的功能依赖新版本，则升级。

- [ ] **Step 5: 运行 pnpm install**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben && pnpm install
```

预期：无错误，`pnpm-lock.yaml` 正常更新。

- [ ] **Step 6: 验证 — 快速 typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

预期：可能还有错误（因为 lib/API/hooks/components 还没移植），但不应有"package not found"类错误。

- [ ] **Step 7: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: 添加 @viben/* workspace 依赖和 assistant 所需三方包"
```
