# Plugin Registry Design

**Date:** 2026-03-27
**Status:** Draft

## Overview

Community plugin registry — a GitHub repo containing plugin metadata files. Developers submit plugins via PR (auto-merged after validation). CLI fetches registry index for search and install resolution. Daily cron keeps versions synced with npm.

### Goals

1. Zero infrastructure — GitHub repo + GitHub Actions only
2. Frictionless submission — PR with 1 JSON file, auto-merge on validation pass
3. CLI integration — `viben plugin search` + smart install from registry name
4. Web UI ready — `registry.json` static index fetchable by any frontend
5. Verified badge system — unverified by default, maintainer sets verified after review

### Non-Goals

- Custom server or database
- npm org/scope requirement for community plugins
- Real-time version updates (daily cron is sufficient)
- Full marketplace UI (future)

---

## 1. Registry Repo Structure

```
github.com/Viben/plugin-registry/
  plugins/                          ← one JSON per plugin
    lucas--viben-translator.json
    viben-plugin-tts.json
    ...
  registry.json                     ← auto-generated combined index
  scripts/
    validate.ts                     ← validate plugin JSON on PR
    check-npm.ts                    ← verify npm package exists
    build-registry.ts               ← generate registry.json from plugins/
    update-versions.ts              ← daily cron: poll npm for latest versions
  .github/
    workflows/
      validate-pr.yml               ← CI: validate + auto-merge on PR
      build-registry.yml            ← CI: rebuild registry.json on push to main
      update-versions.yml           ← daily cron: update versions from npm
    PULL_REQUEST_TEMPLATE.md
  CONTRIBUTING.md
  README.md
  package.json
  tsconfig.json
```

### File Naming Convention

Filename = npm package name with `/` replaced by `--`:
- `@lucas/viben-translator` → `lucas--viben-translator.json`
- `viben-plugin-tts` → `viben-plugin-tts.json`

Flat directory — no subdirectories per scope.

---

## 2. Plugin Entry Format

Each plugin has a JSON file in `plugins/`:

```json
{
  "name": "viben-translator",
  "displayName": "Auto Translator",
  "description": "Auto-translate messages between languages",
  "npm": "@lucas/viben-translator",
  "repository": "https://github.com/lucas/viben-translator",
  "author": {
    "name": "lucas",
    "github": "lucas"
  },
  "version": "1.0.0",
  "minCliVersion": "2026.0326.0",
  "category": "utility",
  "tags": ["translation", "i18n"],
  "icon": "🌐",
  "license": "MIT",
  "verified": false,
  "featured": false,
  "createdAt": "2026-03-27T00:00:00Z"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name / registry identifier (unique) |
| `description` | string | One-line description |
| `npm` | string | npm package name (actual installable name) |
| `repository` | string | Source code URL (HTTPS) |
| `author` | object | `{ name: string, github: string }` |
| `version` | string | Semver — auto-updated by daily cron |
| `minCliVersion` | string | Minimum @viben/kernel version required |
| `category` | string | One of: adapter, utility, integration, ai, security, media |
| `license` | string | SPDX license identifier |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `displayName` | string | `name` | Human-friendly name |
| `tags` | string[] | `[]` | Search keywords |
| `icon` | string | `""` | Emoji icon |
| `verified` | boolean | `false` | Verified by Viben team |
| `featured` | boolean | `false` | Featured on homepage |
| `createdAt` | string | auto | ISO datetime of first submission |

### Categories

| ID | Name | Description | Icon |
|----|------|-------------|------|
| `adapter` | Adapters | Messaging platform adapters | 🔌 |
| `utility` | Utilities | Utility plugins | 🔧 |
| `integration` | Integrations | Third-party integrations | 🔗 |
| `ai` | AI & Models | AI model providers | 🤖 |
| `security` | Security | Security & access control | 🔒 |
| `media` | Media | Voice, image, video | 🎵 |

### Naming — No Scope Required

Community plugins can use any npm name:
- `viben-plugin-translator` (no scope)
- `@lucas/viben-translator` (personal scope)
- `@myorg/viben-whatsapp` (org scope)

Registry `name` field is the display identifier. `npm` field is the actual installable package.

---

## 3. Registry Index

`registry.json` — auto-generated, single file containing all plugins.

```json
{
  "version": 1,
  "generatedAt": "2026-03-27T00:00:00Z",
  "pluginCount": 42,
  "plugins": [
    {
      "name": "viben-translator",
      "displayName": "Auto Translator",
      "description": "Auto-translate messages between languages",
      "npm": "@lucas/viben-translator",
      "version": "1.2.0",
      "minCliVersion": "2026.0326.0",
      "category": "utility",
      "tags": ["translation", "i18n"],
      "icon": "🌐",
      "author": "lucas",
      "repository": "https://github.com/lucas/viben-translator",
      "license": "MIT",
      "verified": false,
      "featured": false
    }
  ],
  "categories": [
    { "id": "adapter", "name": "Adapters", "icon": "🔌" },
    { "id": "utility", "name": "Utilities", "icon": "🔧" },
    { "id": "integration", "name": "Integrations", "icon": "🔗" },
    { "id": "ai", "name": "AI & Models", "icon": "🤖" },
    { "id": "security", "name": "Security", "icon": "🔒" },
    { "id": "media", "name": "Media", "icon": "🎵" }
  ]
}
```

**URL:** `https://raw.githubusercontent.com/Viben/plugin-registry/main/registry.json`

Served directly by GitHub. No CDN needed for v1.

---

## 4. CI Workflows

### `validate-pr.yml` — Validate + Auto-Merge

Triggers on PR to `plugins/` path. Validates JSON, checks npm, auto-merges.

```yaml
name: Validate Plugin Submission
on:
  pull_request:
    paths: ['plugins/**']

permissions:
  contents: write
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Validate plugin JSON
        run: npx tsx scripts/validate.ts
      - name: Check npm package
        run: npx tsx scripts/check-npm.ts
      - name: Auto-merge
        if: success()
        run: gh pr merge ${{ github.event.pull_request.number }} --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### `build-registry.yml` — Rebuild Index

Triggers on push to main affecting `plugins/`.

```yaml
name: Build Registry
on:
  push:
    branches: [main]
    paths: ['plugins/**']
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsx scripts/build-registry.ts
      - name: Commit registry.json
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add registry.json
          git diff --staged --quiet || git commit -m "chore: rebuild registry index"
          git push
```

### `update-versions.yml` — Daily Cron

Polls npm for latest versions, updates plugin files.

```yaml
name: Update Plugin Versions
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsx scripts/update-versions.ts
      - run: npx tsx scripts/build-registry.ts
      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add plugins/ registry.json
          git diff --staged --quiet || git commit -m "chore: update plugin versions from npm"
          git push
```

---

## 5. Scripts

### `validate.ts`

Validates changed plugin files in PR:
- Parse JSON (catch syntax errors)
- Check all required fields present
- Validate `category` is one of allowed values
- Validate `npm` is a valid package name format
- Validate `repository` is HTTPS URL
- Validate `version` is semver format
- Validate `minCliVersion` is semver format
- Check filename matches npm package name convention
- Check no duplicate `name` across all plugins

### `check-npm.ts`

For each changed plugin file:
- Run `npm view <npm-field> version`
- Verify package exists and is installable
- Fail if package not found (developer must publish first)

### `build-registry.ts`

- Read all `plugins/*.json` files
- Combine into single `registry.json` with metadata
- Sort: featured first, then alphabetical
- Add `pluginCount` and `generatedAt`
- Write `registry.json`

### `update-versions.ts`

- Read all `plugins/*.json` files
- For each: run `npm view <npm-field> version`
- If npm version differs from stored version: update `version` field in JSON file
- Track changes for commit message

---

## 6. Submission Process

### For Plugin Developers

1. **Publish plugin to npm** — `npm publish`
2. **Fork** `Viben/plugin-registry`
3. **Create** `plugins/<filename>.json` with required fields
4. **Submit PR** — CI validates and auto-merges

### Filename Convention

npm package name with `@` removed and `/` replaced by `--`:
- `@lucas/viben-translator` → `lucas--viben-translator.json`
- `viben-plugin-tts` → `viben-plugin-tts.json`

### What Happens After Submission

1. CI validates JSON + checks npm → auto-merge if pass
2. `registry.json` rebuilt automatically
3. Plugin discoverable via `viben plugin search` within minutes
4. Daily cron keeps version synced with npm
5. Maintainer may later review and set `verified: true`

---

## 7. CLI Integration (in Viben)

### New Files

```
src/core/plugin/registry-client.ts    ← fetch + cache registry.json
src/cli/commands/plugin-search.ts     ← search command
```

### Modified Files

```
src/cli/commands/plugins.ts           ← add 'search' case, enhance 'install' with registry resolve
```

### RegistryClient

```typescript
const REGISTRY_URL = 'https://raw.githubusercontent.com/Viben/plugin-registry/main/registry.json'
const CACHE_TTL = 60 * 1000  // 1 minute

interface RegistryPlugin {
  name: string
  displayName?: string
  description: string
  npm: string
  version: string
  minCliVersion: string
  category: string
  tags: string[]
  icon: string
  author: string
  repository: string
  license: string
  verified: boolean
  featured: boolean
}

interface Registry {
  version: number
  generatedAt: string
  pluginCount: number
  plugins: RegistryPlugin[]
  categories: Array<{ id: string; name: string; icon: string }>
}

class RegistryClient {
  private cache: { data: Registry; fetchedAt: number } | null = null

  async getRegistry(): Promise<Registry> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL) {
      return this.cache.data
    }
    const res = await fetch(REGISTRY_URL)
    const data = await res.json() as Registry
    this.cache = { data, fetchedAt: Date.now() }
    return data
  }

  async search(query: string): Promise<RegistryPlugin[]> {
    const registry = await this.getRegistry()
    const q = query.toLowerCase()
    return registry.plugins.filter(p => {
      const text = `${p.name} ${p.displayName ?? ''} ${p.description} ${p.tags.join(' ')}`.toLowerCase()
      return text.includes(q)
    })
  }

  async resolve(name: string): Promise<string | null> {
    const registry = await this.getRegistry()
    const plugin = registry.plugins.find(p => p.name === name)
    return plugin?.npm ?? null
  }
}
```

### `viben plugin search <query>`

```
$ viben plugin search translator

  🌐 viben-translator                                    utility
     Auto-translate messages between languages
     Install: viben plugin install viben-translator

  🔗 viben-deepl  ✓ verified                             integration
     DeepL translation integration
     Install: viben plugin install viben-deepl

Found 2 plugins matching "translator"
```

### Enhanced `viben plugin install <name>`

1. Try resolve `name` from registry → get npm package name
2. If found in registry: install npm package
3. If NOT found in registry: treat `name` as npm package name directly (backward compat)
4. Run `plugin.install()` hook
5. Register in PluginRegistry

```
$ viben plugin install viben-translator

Resolving viben-translator from registry...
→ npm: @lucas/viben-translator@1.2.0
Installing...
✓ viben-translator installed! Restart to activate.
```

---

## 8. Security Model

- **Auto-merge**: PR with valid JSON + npm package exists → merge without maintainer review
- **Unverified by default**: All new plugins are `verified: false`
- **Verified badge**: Maintainer manually reviews code and sets `verified: true` via commit
- **CLI warning**: When installing unverified plugin, show warning:
  ```
  ⚠️ This plugin is not verified by Viben team. Install at your own risk.
  Continue? (y/n)
  ```
- **No code execution during validation**: CI only checks JSON format and npm existence, never runs plugin code
- **Removal**: Maintainer can remove plugin by deleting JSON file + rebuilding index

---

## 9. Testing Strategy

### Registry Scripts Tests

- `validate.ts`: valid plugin passes, missing fields fail, invalid category fails, bad JSON fails, duplicate name fails
- `check-npm.ts`: existing package passes, nonexistent package fails
- `build-registry.ts`: generates correct registry.json from sample plugins, sorts correctly, counts correct
- `update-versions.ts`: detects version changes, updates files, skips unchanged

### CLI Integration Tests

- `RegistryClient`: fetch + cache, search filtering, resolve name to npm
- `plugin search`: output format, no results handling
- `plugin install` with registry resolve: resolves name, falls back to npm name

---

## 10. Implementation Order

| Phase | What | Where |
|-------|------|-------|
| 1 | Create registry repo — structure, scripts, CI, tests | `plugin-registry/` (new repo) |
| 2 | CLI integration — RegistryClient, search, enhanced install | Viben `src/` |
| 3 | Seed with example plugins | registry repo |
