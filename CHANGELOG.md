# Changelog

本文档记录 Viben 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- GitHub OAuth 登录认证流程
- 智能体 WebSocket 实时通信支持
- 沙盒管理界面
- 定时任务执行日志和 UI 增强
- 智能体交互式问答功能 (AskUserQuestion 工具)
- MCP 服务器详情页面
- 提示词和命令详情页面
- JSON 查看器组件用于聊天监控
- CLI 错误处理和输出工具

### Changed

- 重构 UI 组件，改进 OAuth 流程
- 将 CLI 整合到 core 包中，清理项目结构
- 使用 gateway client 替代直接 Tauri invoke 调用
- 整合聊天配置存储到工作区聊天页面
- 重构 kanban 集成和更新 UI 组件
- 将提示词重命名为子智能体
- 整合执行器类型，移除遗留重定向

### Fixed

- 修复文档链接到新的 /docs/user/ 路径
- 确保 MessageList 组件中 hooks 在 early returns 之前声明
- 改进聊天 UI 滚动行为

### Documentation

- 整合架构文档
- 添加后端开发指南
- 更新 MCP 服务页面调试文档

## [0.1.2] - 2026-02-07

### Added

- Homebrew tap 支持和发布自动化
- 看板智能体聊天功能
- 看板 WebSocket 实时更新
- 桌面侧边栏文档功能
- 工作区模块规范和看板集成文档
- Web 应用完整国际化支持 (认证、仪表盘、布局、设置、工具、工作区)
- 桌面应用设置国际化

### Changed

- 优化看板布局，添加详细架构文档
- 更新 turbo 构建命令和 gitignore

### Fixed

- 修复 JSON 语法错误 (i18n 语言文件)
- 移除工作区看板中不完整的批量删除占位符
- 修复 pnpm devDependencies 冲突 (Vercel 部署)

## [0.1.1] - 2026-02-06

### Added

- 入门向导和品牌规范
- Turbo 构建缓存工件
- 偏好设置部分
- 多语言翻译 (日语、韩语、德语、法语、西班牙语、葡萄牙语、意大利语)

### Changed

- 更新品牌和 CLI 规范
- 更新安装说明

### Fixed

- 修复 Tauri 构建错误
- 添加缺失的 @radix-ui/react-switch 依赖
- 修复桌面发布工作流中的版本名称变量
- 修复 setupStatus 自动更新逻辑
- 恢复 browse-mcp 包名称在安装命令中

## [0.1.0] - 2026-02-02

### Added

- 桌面应用首个正式版本
- 桌面应用发布工作流
- 国际化支持 (桌面应用)
- 落地页
- 插件市场 API 日志
- Context7 插件
- 社交媒体搜索插件
- 插件市场文档

### Changed

- 优化 useApiLogs 和 useMarketplace hooks 中的计算值记忆化

### Fixed

- 修复设置状态缓存，防止卡片闪烁
- 改进搜索服务中停止按钮的对比度
- 修复设置完成后仍显示设置卡片的问题
- 修复设置状态检测仅限启动和手动触发

[Unreleased]: https://github.com/LinXueyuanStdio/viben/compare/desktop-v0.1.2...HEAD
[0.1.2]: https://github.com/LinXueyuanStdio/viben/compare/desktop-v0.1.1...desktop-v0.1.2
[0.1.1]: https://github.com/LinXueyuanStdio/viben/compare/desktop-v0.1.0...desktop-v0.1.1
[0.1.0]: https://github.com/LinXueyuanStdio/viben/releases/tag/desktop-v0.1.0
