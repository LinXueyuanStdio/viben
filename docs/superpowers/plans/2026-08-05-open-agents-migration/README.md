# open-agents 移植实施计划 — 总览

> **面向实施者**：请按顺序阅读本目录下的所有文件，从 `00-background.md` 开始。

## 文件导航

| 文件 | 内容 | 面向角色 |
|------|------|----------|
| `00-background.md` | 为什么移植、来源项目分析、两端现状对比 | 所有人 |
| `01-requirements.md` | 功能需求清单、技术要求、验收标准 | 所有人 |
| `02-phase1-packages.md` | Phase 1: 复制 agent/sandbox/shared 三个 package | 实施者 |
| `03-phase2-dependencies.md` | Phase 2: 安装所有新依赖 | 实施者 |
| `04-phase3-database.md` | Phase 3: 数据库 schema 合并 + migration | 实施者 |
| `05-phase4-lib.md` | Phase 4: lib/ 模块迁移（~100 个文件） | 实施者 |
| `06-phase5-api.md` | Phase 5: API routes 迁移（~70 个文件） | 实施者 |
| `07-phase6-hooks.md` | Phase 6: hooks 迁移（~25 个文件） | 实施者 |
| `08-phase7-components.md` | Phase 7: 组件迁移（~50 个文件） | 实施者 |
| `09-phase8-pages.md` | Phase 8: 页面创建 + 路由对接 | 实施者 |
| `10-phase9-verification.md` | Phase 9: 集成验证 + 功能测试 | 实施者 |
| `11-phase10-docs.md` | Phase 10: 文档编写 | 实施者 |

## 实施顺序与依赖

```
Phase 1 (packages) ──┐
                      ├──> Phase 3 (DB) ──> Phase 4 (lib) ──> Phase 5 (API)
Phase 2 (deps) ──────┘                                         │
                                                               ├──> Phase 6 (hooks) ──┐
                                                               │                       │
                                                               ├──> Phase 7 (components)┤
                                                               │                        ├──> Phase 8 (pages)
                                                               │                        │
                                                               └────────────────────────┘
                                                                                        │
                                                                                        v
                                                                              Phase 9 (verification)
                                                                                        │
                                                                                        v
                                                                              Phase 10 (docs)
```

## 全局约束

- **工作目录**：`D:\Document\Github\LinXueyuanStdio\viben`
- **源目录**：`D:\Document\Github\LinXueyuanStdio\open-agents`
- **包管理器**：pnpm（`pnpm-workspace.yaml` 已配置 `packages/*`）
- **编译目标**：每个 phase 结束后 `cd apps/web && pnpm typecheck` 必须通过
- **编辑文件**：使用绝对路径
- **spec 参考**：`docs/superpowers/specs/2026-08-05-open-agents-migration-design.md`
- **认证**：所有 API routes 和 hooks 去掉 Better Auth，改用 viben `getSession()` / `/api/users/me`
- **DB 表引用**：所有 `user_id` 外键指向 viben `users.id`
- **package 引用**：`@open-agents/*` → `@viben/*`

## 预估文件数

| Phase | 新建 | 修改 | 不迁移 |
|-------|------|------|--------|
| Phase 1 (packages) | ~55 | ~0 | — |
| Phase 3 (DB) | 0 | 1 | — |
| Phase 4 (lib) | ~85 | ~5 | ~10 |
| Phase 5 (API) | ~70 | ~0 | ~6 |
| Phase 6 (hooks) | ~25 | 1 | 1 |
| Phase 7 (components) | ~50 | 1 | ~30 (UI) |
| Phase 8 (pages) | ~10 | 0 | — |
| Phase 9 (verification) | 0 | 0 | — |
| Phase 10 (docs) | ~5 | 1 | — |
| **合计** | **~300** | **~8** | **~47** |
