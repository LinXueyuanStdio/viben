---
sidebar_position: 3
title: "功能特点"
description: "Viben 桌面应用的功能和特性"
---

# 功能特点

Viben Desktop 提供了一套完整的内容搜索和管理功能。

## 论文搜索

### 多来源搜索

同时搜索多个学术数据库：

- **arXiv** - 物理学、数学、计算机科学等领域的预印本
- **PubMed** - 生物医学和生命科学文献
- **Semantic Scholar** - AI 驱动的学术搜索
- **CrossRef** - 学术元数据
- **DBLP** - 计算机科学文献目录
- **OpenAlex** - 学术作品开放目录

### 高级筛选

通过以下条件精细化您的搜索结果：

- 日期范围筛选
- 作者筛选
- 出版物类型
- 学科领域
- 仅开放获取

### 搜索历史

- 查看最近搜索
- 重新运行先前的查询
- 导出搜索历史

---

## 论文管理

### 下载论文

- 直接从应用下载 PDF
- 自动文件命名和整理
- 可配置的下载位置

### 阅读论文

- 提取并查看论文内容
- 论文内全文搜索
- 复制文本和引用

### 文献集

- 将论文整理到文献集中
- 标签和分类
- 导出文献集

---

## MCP 集成

### 内置 MCP 服务器

Viben Desktop 包含 MCP 服务器，允许 AI 助手：

- 代替您搜索论文
- 下载和阅读论文内容
- 协助进行文献综述

### 配置

桌面应用自动管理 MCP 服务器。配置它以与以下客户端一起使用：

- Claude Desktop
- Continue.dev
- 其他兼容 MCP 的客户端

查看[客户端配置](../getting-started/client-configuration)了解设置说明。

---

## 用户界面

### 深色模式

完整支持浅色和深色主题：

- 自动检测系统主题
- 手动切换主题
- 所有组件风格一致

### 键盘快捷键

| 操作 | macOS | Windows/Linux |
|--------|-------|---------------|
| 新搜索 | Cmd + K | Ctrl + K |
| 设置 | Cmd + , | Ctrl + , |
| 退出 | Cmd + Q | Alt + F4 |

### 无障碍功能

- 屏幕阅读器支持
- 键盘导航
- 高对比度模式

---

## 隐私与安全

### 本地优先

- 所有数据存储在本地机器上
- 无需账户
- 无遥测或跟踪

### 安全通信

- 所有 API 请求使用 HTTPS
- 不以明文存储凭据

### 数据位置

您的数据存储在平台特定的位置：

| 平台 | 位置 |
|----------|----------|
| macOS | `~/Library/Application Support/com.viben.app` |
| Windows | `%APPDATA%\com.viben.app` |
| Linux | `~/.config/viben` |

---

## 即将推出

计划在未来版本中添加的功能：

- **自动更新** - 应用自动更新
- **插件系统** - 通过插件扩展功能
- **引用导出** - 以多种格式导出引用（BibTeX、RIS 等）
- **论文注释** - 高亮和注释 PDF
- **同步** - 可选的设置和文献集云同步

---

## 功能请求

有功能建议？在 [GitHub](https://github.com/LinXueyuanStdio/viben/issues/new?template=feature_request.md) 上提交 issue。
