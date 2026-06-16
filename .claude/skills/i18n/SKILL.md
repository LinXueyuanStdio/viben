---
name: i18n
description: "Parallel sub-agent i18n extraction - scan files for hardcoded strings, extract to translation keys, update locale JSON files, and replace with t() calls. Use when user asks to 'extract translations', 'add i18n', 'internationalize', 'extract strings', or mentions i18n/translation work for a directory or set of files."
---

# i18n Extraction (Parallel Sub-Agent)

使用并行子代理从代码中提取硬编码字符串并替换为 i18n 翻译调用。

## 流程

### 1. 确定范围

询问或推断：
- 目标目录/文件（默认：用户指定的目录）
- 使用的 i18n 库（本项目用 `react-i18next`，调用为 `t('namespace:key')`）
- locale 文件位置（搜索 `locales/` 或 `i18n/` 目录）

### 2. 发现 locale 文件结构

```bash
find . -path "*/locales/*.json" -o -path "*/i18n/*.json" | head -20
```

确定：
- 现有 namespace
- 语言列表（en, zh-CN 等）
- key 命名规范（观察现有 key 的格式）

### 3. 并行扫描

将目标文件按目录分组（每组 3-5 个文件），为每组启动一个子代理：

**子代理指令模板：**
```
扫描以下文件中的硬编码用户可见字符串：
<file-list>

对每个字符串：
1. 生成 key（格式：namespace:kebab-case-key）
2. 记录原始字符串（中文 → zh-CN，英文 → en）
3. 替换为 t('key') 或 <Trans i18nKey="key">

输出 JSON 格式：
{
  "keys": [{"key": "ns:name", "en": "...", "zh": "..."}],
  "files": [{"path": "...", "changes": [...]}]
}
```

### 4. 合并结果

收集所有子代理结果后：
- 去重 key（相同字符串用相同 key）
- 按 namespace 分组
- 写入对应 locale JSON 文件
- 应用文件变更（替换硬编码字符串）

### 5. 验证

```bash
pnpm typecheck
```

如果有类型错误，修复后再次验证。

## 规则

- 不提取：
  - 技术字符串（CSS 类名、HTML 属性、log 消息）
  - 已经使用 t() 的字符串
  - 常量/枚举值
- Key 命名跟随现有规范
- 每个 namespace 对应一个功能区域
- 确保所有语言的 locale 文件都更新

## 输出报告

```
✅ i18n 提取完成：
  - 新增 key：N 个
  - 修改文件：M 个
  - Namespace：[list]
  - 类型检查：通过 ✓
```
