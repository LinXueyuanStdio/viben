# Viben Pet 管理系统设计文档

## 概述

为 Viben 添加完整的 Pet 管理系统，包括：
- `packages/core/src/pet/` - 核心业务逻辑
- `packages/core/src/gateway/routes/pet.ts` - Gateway API
- `packages/core/src/cli/commands/pet.ts` - CLI 命令
- `apps/desktop/src/pages/settings/pet-section/` - Desktop 设置 UI
- `packages/pet/example/` - i18n 支持

## 数据来源

| 来源 | 路径 | 说明 |
|------|------|------|
| 内置 Pet | `apps/desktop/public/pets/` | 应用自带 |
| 社区/用户 Pet | `~/.viben/pets/<pet-id>/` | 下载或导入 |

## 远程来源 (MVP)

复用现有社区源，后续支持可配置：

| 来源 | URL |
|------|-----|
| Codex Pet Share | `https://ihzwckyzfcuktrljwpha.supabase.co/functions/v1/petshare` |
| j20 Hatchery | `https://j20.nz/hatchery/api/pets.json` |

## 存储结构

```
~/.viben/pets/
├── config.yaml           # 全局配置
├── sources.yaml          # 来源配置
└── <pet-id>/
    ├── pet.json          # Pet 元数据
    └── spritesheet.webp  # 精灵图
```

### config.yaml

```yaml
current: "tux"           # 当前 Pet ID，null 时使用第一个内置 Pet
enabled: true            # 是否显示 Pet（默认 true）
preferences:
  size: 96               # 显示大小 48-192px（默认 96）
  position:
    right: 24            # 距右边距离（默认 24）
    bottom: 24           # 距底边距离（默认 24）
```

### 默认值

当 `config.yaml` 不存在或字段缺失时的默认值：

```typescript
const DEFAULT_PET_CONFIG: PetConfig = {
  current: null,        // null 表示使用第一个可用的内置 Pet
  enabled: true,
  preferences: {
    size: 96,
    position: { right: 24, bottom: 24 },
  },
};
```

### sources.yaml

```yaml
sources:
  - name: "codex-pet-share"
    url: "https://ihzwckyzfcuktrljwpha.supabase.co/functions/v1/petshare"
    enabled: true
    builtin: true
  - name: "j20-hatchery"
    url: "https://j20.nz/hatchery/api/pets.json"
    enabled: true
    builtin: true
```

## 类型定义

### 文件结构

```
packages/core/src/pet/
├── index.ts              # PetManager 类 + 单例导出
├── types.ts              # 核心类型 (Pet, PetConfig, PetPreferences)
├── paths.ts              # 路径常量
└── ops/
    ├── types.ts          # 操作相关类型 (CommunityPet, PetSource, API 响应)
    ├── storage.ts        # 配置读写、Pet 文件管理
    ├── sources.ts        # 来源管理
    ├── sync.ts           # 远程获取列表、下载 Pet
    ├── search.ts         # 跨源搜索
    └── import-export.ts  # 本地 zip 导入/导出
```

### 核心类型

文件: `packages/core/src/pet/types.ts`

```typescript
// Pet 元数据（与 pet.json 对应）
export interface PetMetadata {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  author?: string;
  tags?: string[];
  source?: string;
  sourceUrl?: string;
}

// Pet 完整信息（含本地路径）
export interface Pet {
  id: string;
  metadata: PetMetadata;
  localPath: string;
  spritesheetUrl: string;
  isBuiltin: boolean;
  installedAt?: string;
}

// 全局配置
export interface PetConfig {
  current: string | null;
  enabled: boolean;
  preferences: PetPreferences;
}

export interface PetPreferences {
  size: number;
  position: { right: number; bottom: number };
}

// 来源定义 (存放于 ops/types.ts)
export interface PetSource {
  name: string;
  url: string;
  enabled: boolean;
  builtin: boolean;
}

// 社区 Pet（远程列表项，存放于 ops/types.ts）
export interface CommunityPet {
  id: string;
  displayName: string;
  description: string;
  author?: string;
  tags?: string[];
  thumbnailUrl?: string;
  downloadUrl: string;
  source: string;
}

// API 响应类型 (存放于 ops/types.ts，snake_case 格式)
export interface PetResponse {
  id: string;
  metadata: {
    id: string;
    display_name: string;
    description: string;
    spritesheet_path: string;
    author?: string;
    tags?: string[];
    source?: string;
    source_url?: string;
  };
  local_path: string;
  spritesheet_url: string;
  is_builtin: boolean;
  installed_at?: string;
}

export interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number };
  };
}

export interface CommunityPetResponse {
  id: string;
  display_name: string;
  description: string;
  author?: string;
  tags?: string[];
  thumbnail_url?: string;
  download_url: string;
  source: string;
}

export interface PetSourceResponse {
  name: string;
  url: string;
  enabled: boolean;
  builtin: boolean;
}
```

## Core 模块结构

```
packages/core/src/pet/
├── index.ts              # PetManager 类 + 单例导出
├── types.ts              # 类型定义
├── paths.ts              # 路径常量
└── ops/
    ├── storage.ts        # 配置读写、Pet 文件管理
    ├── sources.ts        # 来源管理
    ├── sync.ts           # 远程获取列表、下载 Pet
    ├── search.ts         # 跨源搜索
    └── import-export.ts  # 本地 zip 导入/导出
```

### PetManager API

```typescript
export class PetManager {
  // 配置
  async getConfig(): Promise<PetConfig>
  async setConfig(updates: Partial<PetConfig>): Promise<void>
  async setCurrent(petId: string | null): Promise<void>
  
  // Pet CRUD
  async listPets(): Promise<Pet[]>
  async getPet(id: string): Promise<Pet | null>
  async removePet(id: string): Promise<void>
  
  // 社区
  async listCommunityPets(sourceFilter?: string): Promise<CommunityPet[]>
  async searchCommunityPets(query: string): Promise<CommunityPet[]>
  async installPet(petId: string, source: string): Promise<Pet>
  
  // 导入导出
  async importPet(zipPath: string): Promise<Pet>
  async exportPet(petId: string, outPath: string): Promise<string>
  
  // 来源管理
  async listSources(): Promise<PetSource[]>
  async addSource(source: Omit<PetSource, 'builtin'>): Promise<void>
  async removeSource(name: string): Promise<void>
  async setSourceEnabled(name: string, enabled: boolean): Promise<void>
}

export const petManager = new PetManager();
```

## Gateway API 路由

文件: `packages/core/src/gateway/routes/pet.ts`

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/pet/list` | GET | 列出所有 Pet |
| `/api/pet/show/:id` | GET | 获取 Pet 详情 |
| `/api/pet/set/:id` | POST | 设置当前 Pet |
| `/api/pet/remove/:id` | POST | 删除已安装 Pet |
| `/api/pet/import` | POST | 导入本地 Pet |
| `/api/pet/export/:id` | GET | 导出 Pet 为 zip |
| `/api/pet/search` | GET | 搜索社区 Pet |
| `/api/pet/preview/:id` | GET | 预览社区 Pet 信息 |
| `/api/pet/install` | POST | 安装社区 Pet |
| `/api/pet/community` | GET | 列出社区 Pet |
| `/api/pet/config` | GET | 获取配置 |
| `/api/pet/config` | PUT | 更新配置 |
| `/api/pet/sources/list` | GET | 列出来源 |
| `/api/pet/sources/add` | POST | 添加来源 |
| `/api/pet/sources/remove/:name` | POST | 删除来源 |
| `/api/pet/asset/:id/*` | GET | 服务 Pet 静态资源 |

### 请求/响应格式 (snake_case)

```typescript
// GET /api/pet/list
{ pets: PetResponse[], current: string | null }

// GET /api/pet/show/:id
{ pet: PetResponse }
// Error: { error: "Pet not found", code: "PET_NOT_FOUND" }

// POST /api/pet/set/:id
{ success: true, current: string }

// POST /api/pet/remove/:id
{ success: true, removed: string }
// Error: { error: "Cannot remove builtin pet", code: "PET_IS_BUILTIN" }

// POST /api/pet/install
// Body: { pet_id: string, source: string }
{ pet: PetResponse }
// Error: { error: "Download failed", code: "DOWNLOAD_FAILED" }

// POST /api/pet/import
// Body: { path: string }
{ pet: PetResponse }
// Error: { error: "Invalid zip file", code: "INVALID_ZIP" }

// GET /api/pet/export/:id?out_path=
{ path: string }

// GET /api/pet/community?source=
{ pets: CommunityPetResponse[] }

// GET /api/pet/search?q=
{ pets: CommunityPetResponse[] }

// GET /api/pet/preview/:id?source=
{ pet: CommunityPetResponse }

// GET /api/pet/config
{ config: PetConfigResponse }

// PUT /api/pet/config
// Body: { enabled?: boolean, current?: string, preferences?: {...} }
{ config: PetConfigResponse }

// GET /api/pet/sources/list
{ sources: PetSourceResponse[] }

// POST /api/pet/sources/add
// Body: { name: string, url: string }
{ source: PetSourceResponse }
// Error: { error: "Source already exists", code: "SOURCE_EXISTS" }
// Error: { error: "Invalid URL, must be HTTPS", code: "INVALID_URL" }

// POST /api/pet/sources/remove/:name
{ success: true, removed: string }
// Error: { error: "Cannot remove builtin source", code: "SOURCE_IS_BUILTIN" }
```

### snake_case 转换

Gateway 层需要实现转换函数：

```typescript
function toSnakeCasePet(pet: Pet): PetResponse { ... }
function toSnakeCaseCommunityPet(pet: CommunityPet): CommunityPetResponse { ... }
function toSnakeCaseConfig(config: PetConfig): PetConfigResponse { ... }
```

## CLI 命令

文件: `packages/core/src/cli/commands/pet.ts`

```bash
viben pet list                          # 列出所有 Pet
viben pet show <id>                     # 显示 Pet 详情
viben pet set <id>                      # 设置当前 Pet
viben pet remove <id>                   # 删除已安装 Pet
viben pet import <path>                 # 从本地 zip 导入
viben pet export <id> [-o <path>]       # 导出 Pet 为 zip
viben pet search <query>                # 搜索社区 Pet
viben pet preview <id> [--source <s>]   # 预览社区 Pet 信息
viben pet install <id> [--source <s>]   # 安装社区 Pet
viben pet community [--source <s>]      # 列出社区 Pet
viben pet sources list                  # 列出来源
viben pet sources add --name <n> --url <u>  # 添加来源
viben pet sources remove <name>         # 删除来源
```

通用选项: `--json`, `--verbose`, `--quiet`

命令别名:
- `list` → `ls`
- `remove` → `rm`

### 删除确认

`viben pet remove` 默认需要确认，可用 `--yes` / `-y` 跳过：

```bash
$ viben pet remove my-pet
Are you sure you want to remove "my-pet"? [y/N] y
Removed pet "my-pet"

$ viben pet remove my-pet -y
Removed pet "my-pet"
```

## Desktop Settings UI

### 文件结构

```
apps/desktop/src/pages/settings/pet-section/
├── index.tsx                 # 主组件导出
├── pet-selector.tsx          # Pet 选择器（卡片网格）
├── pet-preview.tsx           # Pet 动画预览
├── community-browser.tsx     # 社区 Pet 浏览 & 安装
├── source-manager.tsx        # 来源管理
├── import-dialog.tsx         # 本地导入对话框
└── preferences-form.tsx      # 偏好设置（大小、位置）
```

### UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│ Pet 设置                                            [开关]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  当前 Pet: Tux                        │
│  │   [Pet 动画]    │  大小: [====●====] 96px               │
│  └─────────────────┘                                       │
├─────────────────────────────────────────────────────────────┤
│ 已安装                              [搜索...] [导入] [刷新]│
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                           │
│ │ tux │ │clip │ │dario│ │ ... │  [删除]                    │
│ │  ✓  │ │     │ │     │ │     │                           │
│ └─────┘ └─────┘ └─────┘ └─────┘                           │
├─────────────────────────────────────────────────────────────┤
│ 社区 Pet                    [搜索...] [来源: 全部 ▼] [排序 ▼]│
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                           │
│ │nyan │ │shiba│ │robot│ │ ... │  [安装]                    │
│ └─────┘ └─────┘ └─────┘ └─────┘                           │
│ 标签筛选: [全部] [retro] [mascot] [animated] ...           │
├─────────────────────────────────────────────────────────────┤
│ 来源管理                                          [添加来源]│
│ ● codex-pet-share (内置)                          [启用]   │
│ ● j20-hatchery (内置)                             [启用]   │
└─────────────────────────────────────────────────────────────┘
```

### 图标 (lucide-react)

| 场景 | 图标 |
|------|------|
| 导入 | `<Upload />` |
| 刷新 | `<RefreshCw />` |
| 删除 | `<Trash2 />` |
| 安装 | `<Download />` |
| 已安装 | `<Check />` |
| 来源 | `<Globe />` |
| 添加 | `<Plus />` |
| 搜索 | `<Search />` |
| 排序 | `<ArrowUpDown />` |
| 筛选 | `<Filter />` |

### 删除确认对话框

删除 Pet 或来源时显示确认对话框：

```
┌─────────────────────────────────────┐
│ 删除 Pet                        [X] │
├─────────────────────────────────────┤
│ 确定要删除 "my-pet" 吗？            │
│ 此操作不可撤销。                    │
│                                     │
│           [取消]  [确认删除]        │
└─────────────────────────────────────┘
```

## packages/pet/example i18n

### 文件结构

```
packages/pet/example/src/
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── en.json
│       └── zh-CN.json
└── components/
    └── LanguageSwitcher.tsx
```

### i18n 配置

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: navigator.language.startsWith('zh') ? 'zh-CN' : 'en',
  fallbackLng: 'en',
});
```

### 翻译键结构

```json
{
  "pet": {
    "title": "Pet Development",
    "selectPet": "Select Pet",
    "debug": { "title": "Debug Info", "animation": "Animation", ... },
    "controls": { "resetPosition": "Reset Position", ... },
    "settings": { "size": "Size", "speed": "Speed", ... },
    "help": { "title": "Help", ... }
  }
}
```

## 实现顺序

1. **Phase 1: Core 模块**
   - `packages/core/src/pet/types.ts`
   - `packages/core/src/pet/paths.ts`
   - `packages/core/src/pet/ops/storage.ts`
   - `packages/core/src/pet/ops/sources.ts`
   - `packages/core/src/pet/ops/sync.ts`
   - `packages/core/src/pet/ops/search.ts`
   - `packages/core/src/pet/ops/import-export.ts`
   - `packages/core/src/pet/index.ts`

2. **Phase 2: Gateway & CLI**
   - `packages/core/src/gateway/routes/pet.ts`
   - `packages/core/src/gateway/routes/pet.test.ts`
   - `packages/core/src/cli/commands/pet.ts`
   - `packages/core/src/cli/commands/pet.test.ts`

3. **Phase 3: Desktop UI**
   - `apps/desktop/src/pages/settings/pet-section/`

4. **Phase 4: Example i18n**
   - `packages/pet/example/src/i18n/`
   - 更新现有组件使用 `useTranslation`

## 安全措施

### 路径验证

所有文件操作必须验证路径安全：

```typescript
function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolved = path.resolve(basePath, targetPath);
  return resolved.startsWith(path.resolve(basePath));
}
```

- `/api/pet/asset/:id/*` 路由必须验证路径不含 `..`，限制在 `~/.viben/pets/<id>/` 内
- 拒绝 symlinks 和绝对路径

### Zip 导入安全

- **大小限制**: 单个 zip 文件最大 50MB，解压后最大 100MB
- **路径验证**: 拒绝包含 `..` 或绝对路径的条目
- **Symlink 拒绝**: 不解压 symlink 条目
- **文件类型白名单**: 只允许 `.json`, `.webp`, `.png`, `.gif` 扩展名

### 远程来源安全

- **仅 HTTPS**: 用户添加的来源必须是 `https://` 协议
- **超时限制**: 下载超时 30 秒
- **大小限制**: 单个文件最大 10MB
- **Content-Type 验证**: spritesheet 必须是 `image/*`

## 错误处理

### 错误响应格式

所有 API 错误遵循统一格式：

```typescript
interface ErrorResponse {
  error: string;        // 错误消息
  code?: string;        // 错误码（可选）
}
```

### 错误码定义

| 错误码 | HTTP 状态 | 描述 |
|--------|----------|------|
| `PET_NOT_FOUND` | 404 | Pet 不存在 |
| `PET_IS_BUILTIN` | 400 | 内置 Pet 不可删除 |
| `SOURCE_NOT_FOUND` | 404 | 来源不存在 |
| `SOURCE_IS_BUILTIN` | 400 | 内置来源不可删除 |
| `SOURCE_EXISTS` | 409 | 来源名称已存在 |
| `INVALID_URL` | 400 | URL 格式无效或非 HTTPS |
| `DOWNLOAD_FAILED` | 502 | 下载远程资源失败 |
| `INVALID_ZIP` | 400 | Zip 文件无效或不安全 |
| `INVALID_PET_FORMAT` | 400 | pet.json 格式无效 |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 |

### CLI 错误输出

```bash
$ viben pet remove tux
Error: Cannot remove builtin pet "tux" (PET_IS_BUILTIN)

$ viben pet install unknown-pet --source codex-pet-share
Error: Pet "unknown-pet" not found in source "codex-pet-share" (PET_NOT_FOUND)
```

## 同步策略

**按需下载**: 用户在 UI 中浏览社区 Pet，点击安装时才下载到本地。不自动全量同步。

## 数据流示例

### 安装社区 Pet

```
用户点击"安装"
  → Desktop UI: POST /api/pet/install { pet_id, source }
  → Gateway: petManager.installPet(petId, source)
  → sync.ts: 从远程下载 pet.json + spritesheet
  → storage.ts: 写入 ~/.viben/pets/<id>/
  → 返回 Pet 对象，UI 刷新列表
```

### 设置当前 Pet

```
用户点击 Pet 卡片
  → Desktop UI: POST /api/pet/set/:id
  → Gateway: petManager.setCurrent(id)
  → storage.ts: 更新 config.yaml 的 current 字段
  → 返回成功，UI 更新选中状态
```
