# Setup Documentation Static Site with Docusaurus

## Goal

建立一个完整的文档静态网站，基于 Docusaurus，为 browse-mcp 项目提供专业、易用的文档。

## Requirements

### Phase 1: Initial Setup (在 worktree 中完成)

1. **Copy Source Documentation**
   - 从 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/agentlin/docs` 复制到项目根目录的 `docs/`
   - 保留 Docusaurus 配置和基础结构

2. **Clean Up Unnecessary Files**
   - 删除 `docs/docs/tutorial-basics/*` (Docusaurus 默认教程)
   - 删除 `docs/docs/tutorial-extras/*` (Docusaurus 默认教程)
   - 删除 `docs/output/*` (AgentLin 特定内容)
   - 删除 `docs/api/openapi.yml` (AgentLin API 规范)
   - 删除不相关的中文文档（如 `工具结果协议.md`, `思维记忆.md` 等）
   - 删除 `node_modules/`, `.docusaurus/`, `build/` (构建缓存)

3. **Update Branding**
   - 修改 `docusaurus.config.ts`:
     - Title: "AgentLin" → "Browse MCP"
     - Tagline: 更新为 Browse MCP 的描述
     - GitHub 链接: 更新为 `LinXueyuanStdio/browse-mcp`
   - 修改 `package.json`:
     - name: "docs" → "@browse-mcp/docs"
     - 更新 description

4. **Integrate with Monorepo**
   - 将 docs 移动到 `apps/docs` (符合 monorepo 结构)
   - 更新根目录 `pnpm-workspace.yaml` (如果需要)
   - 在根 `package.json` 添加 `"docs": "pnpm --filter @browse-mcp/docs"` 脚本

5. **Setup GitHub Pages Deployment**
   - 创建 `.github/workflows/deploy-docs.yml`
   - 配置 GitHub Actions 自动部署到 gh-pages 分支
   - 触发条件：
     - Push to main branch (docs/ 目录有变更时)
     - 或手动触发 (workflow_dispatch)
   - 部署步骤：
     - 安装依赖 (pnpm install)
     - 构建文档 (pnpm docs build)
     - 部署到 gh-pages 分支
   - 需要配置 GitHub Pages 设置指向 gh-pages 分支

### Phase 2: Documentation Content (后续细化)

等 Phase 1 完成后，用户会进一步细化文档编写需求。

预期文档结构：

```
docs/docs/
├── intro.md                      # 项目概述
├── getting-started/
│   ├── installation.md           # pip install browse-mcp
│   ├── quick-start.md            # 基本使用
│   └── configuration.md          # 环境变量配置
├── mcp-server/
│   ├── overview.md               # MCP 服务器架构
│   ├── tools.md                  # paper_search, paper_download, paper_read
│   ├── sources.md                # 19 个学术来源
│   └── client-config.md          # Claude Desktop, Claude Code 等客户端配置
├── desktop-app/
│   ├── overview.md               # 桌面应用功能
│   ├── installation.md           # 安装指南
│   └── usage.md                  # 使用指南
├── plugins/
│   ├── overview.md               # 插件系统 (stevedore)
│   ├── creating-plugins.md       # 创建插件指南
│   └── content-types.md          # ContentSource[T] 泛型
├── api/
│   └── reference.md              # API 文档
└── contributing.md               # 贡献指南
```

## Acceptance Criteria

### Phase 1

- [ ] docs/ 目录结构从源项目成功复制
- [ ] 所有 AgentLin 特定和不必要的文件已删除
- [ ] Docusaurus 配置已更新为 Browse MCP 品牌
- [ ] docs 集成到 monorepo 结构 (apps/docs)
- [ ] `pnpm docs dev` 可以成功启动文档开发服务器
- [ ] `pnpm docs build` 可以成功构建静态站点
- [ ] GitHub Actions workflow 已配置 (.github/workflows/deploy-docs.yml)
- [ ] Workflow 可以成功构建并部署到 gh-pages 分支
- [ ] GitHub Pages 已配置并可访问

### Phase 2

- (待用户细化后补充)

## Technical Notes

### Source Documentation

- **工具**: Docusaurus v3.9.2 with OpenAPI preset
- **功能**:
  - i18n 支持 (en, zh-Hans)
  - Mermaid 图表
  - KaTeX 数学公式
  - OpenAPI 文档集成

### Documentation Content Sources

可以从以下现有文档提取内容：
- `backend/browse-mcp/README.md` - 496 行的 MCP 服务器文档
- `backend/browse-mcp/README_zh.md` - 中文版本
- `apps/desktop/README.md` - 桌面应用文档
- `CURRENT_STATUS.md` - 当前开发状态
- `IMPLEMENTATION_SUMMARY.md` - 实现总结

### Workflow

1. 使用 `/trellis:parallel` 在独立的 worktree 中工作
2. 完成 Phase 1 的初始设置（复制、清理、品牌更新）
3. 验证 Docusaurus 可以正常运行
4. 返回主线程，用户细化 Phase 2 的文档编写需求
5. 继续实现文档内容

## Dependencies

- Node.js 和 pnpm (已有)
- Docusaurus 及其依赖 (将从源复制)
- 现有的 README 文档作为内容来源

## Timeline

- Phase 1: 在 worktree 中快速完成（预计 1 个开发周期）
- Phase 2: 待细化后评估
