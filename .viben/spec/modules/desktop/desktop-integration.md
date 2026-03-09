# T20: Desktop Integration

> Implement desktop app API client for consuming the Viben platform.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T20 |
| Dependencies | T5 (MCP API), T6 (Skills API), T13 (Packages API) |
| Effort | 3 points |
| Priority | P1 |

---

## Objectives

1. Create API client library for desktop app
2. Implement authentication flow
3. Add package discovery and download
4. Enable workspace sync

---

## API Client Design

### 1. Client Configuration (`packages/api-client/src/client.ts`)

```typescript
export interface VibenClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class VibenClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: BrowseMcpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.error || `HTTP ${response.status}`,
          response.status
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // MCP Packages
  mcp = {
    list: (params?: ListParams) =>
      this.request<PaginatedResponse<McpPackage>>(
        `/api/mcp?${buildQuery(params)}`
      ),

    get: (id: string) =>
      this.request<{ package: McpPackage }>(`/api/mcp/${id}`),

    search: (query: string, params?: ListParams) =>
      this.request<PaginatedResponse<McpPackage>>(
        `/api/mcp?q=${encodeURIComponent(query)}&${buildQuery(params)}`
      ),

    download: (id: string) =>
      this.downloadFile(`/api/packages/mcp/${id}/download`),
  };

  // Skills
  skills = {
    list: (params?: ListParams) =>
      this.request<PaginatedResponse<SkillPackage>>(
        `/api/skills?${buildQuery(params)}`
      ),

    get: (id: string) =>
      this.request<{ package: SkillPackage }>(`/api/skills/${id}`),

    search: (query: string, params?: ListParams) =>
      this.request<PaginatedResponse<SkillPackage>>(
        `/api/skills?q=${encodeURIComponent(query)}&${buildQuery(params)}`
      ),

    download: (id: string) =>
      this.downloadFile(`/api/packages/skills/${id}/download`),
  };

  // User
  user = {
    me: () => this.request<{ user: User }>('/api/users/me'),

    favorites: () =>
      this.request<{ favorites: Favorite[] }>('/api/users/me/favorites'),
  };

  // Workspaces
  workspaces = {
    list: () =>
      this.request<{ workspaces: Workspace[] }>('/api/workspaces'),

    get: (id: string) =>
      this.request<{ workspace: Workspace; role: string }>(
        `/api/workspaces/${id}`
      ),

    packages: (id: string) =>
      this.request<WorkspacePackagesResponse>(
        `/api/workspaces/${id}/packages`
      ),
  };

  private async downloadFile(path: string): Promise<Blob> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new ApiError(`Download failed: HTTP ${response.status}`, response.status);
    }

    return response.blob();
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildQuery(params?: ListParams): string {
  if (!params) return '';
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.sort) query.set('sort', params.sort);
  if (params.category) query.set('category', params.category);
  return query.toString();
}
```

### 2. Type Definitions (`packages/api-client/src/types.ts`)

```typescript
export interface ListParams {
  page?: number;
  limit?: number;
  sort?: 'latest' | 'popular' | 'downloads';
  category?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface McpPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  longDescription: string | null;
  category: string | null;
  transport: 'stdio' | 'sse';
  tags: string[] | null;
  repositoryUrl: string | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  ratingCount: number;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  longDescription: string | null;
  category: string | null;
  skillType: string;
  triggerPatterns: string[] | null;
  tags: string[] | null;
  repositoryUrl: string | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  ratingCount: number;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
}

export interface Favorite {
  id: string;
  entityType: 'mcp' | 'skill';
  entityId: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPersonal: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePackagesResponse {
  packages: {
    mcp: McpPackage[];
    skills: SkillPackage[];
  };
  configs: Array<{
    packageId: string;
    packageType: 'mcp' | 'skill';
    config: Record<string, any>;
    enabled: boolean;
  }>;
}
```

### 3. Desktop App Integration (`apps/desktop/src/lib/viben.ts`)

```typescript
import { VibenClient, type McpPackage, type SkillPackage } from '@viben/api-client';
import { appDataDir, join } from '@tauri-apps/api/path';
import { createDir, writeFile, exists } from '@tauri-apps/api/fs';

const PLATFORM_URL = 'https://viben-web.vercel.app';

let client: VibenClient | null = null;

export function initClient(apiKey?: string) {
  client = new VibenClient({
    baseUrl: PLATFORM_URL,
    apiKey,
  });
  return client;
}

export function getClient(): VibenClient {
  if (!client) {
    client = new VibenClient({ baseUrl: PLATFORM_URL });
  }
  return client;
}

// Package Management
export async function searchPackages(query: string, type: 'mcp' | 'skill' = 'mcp') {
  const api = getClient();
  if (type === 'mcp') {
    return api.mcp.search(query);
  }
  return api.skills.search(query);
}

export async function installMcpPackage(pkg: McpPackage): Promise<string> {
  const api = getClient();

  // Download package
  const blob = await api.mcp.download(pkg.id);

  // Save to app data directory
  const dataDir = await appDataDir();
  const packagesDir = await join(dataDir, 'packages', 'mcp');
  const packageDir = await join(packagesDir, pkg.slug);

  // Ensure directory exists
  if (!(await exists(packagesDir))) {
    await createDir(packagesDir, { recursive: true });
  }

  // Extract and save
  const zipPath = await join(packageDir, `${pkg.slug}-${pkg.version}.zip`);
  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(zipPath, new Uint8Array(arrayBuffer));

  // TODO: Extract zip to packageDir

  return packageDir;
}

export async function installSkillPackage(pkg: SkillPackage): Promise<string> {
  const api = getClient();

  const blob = await api.skills.download(pkg.id);

  const dataDir = await appDataDir();
  const packagesDir = await join(dataDir, 'packages', 'skills');
  const packageDir = await join(packagesDir, pkg.slug);

  if (!(await exists(packagesDir))) {
    await createDir(packagesDir, { recursive: true });
  }

  const zipPath = await join(packageDir, `${pkg.slug}-${pkg.version}.zip`);
  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(zipPath, new Uint8Array(arrayBuffer));

  return packageDir;
}

// Workspace Sync
export async function syncWorkspace(workspaceId: string) {
  const api = getClient();

  const { packages, configs } = await api.workspaces.packages(workspaceId);

  const enabledMcps = packages.mcp.filter((pkg) => {
    const config = configs.find((c) => c.packageId === pkg.id);
    return config?.enabled !== false;
  });

  const enabledSkills = packages.skills.filter((pkg) => {
    const config = configs.find((c) => c.packageId === pkg.id);
    return config?.enabled !== false;
  });

  return {
    mcps: enabledMcps,
    skills: enabledSkills,
    configs,
  };
}

// Authentication
export async function setApiKey(apiKey: string) {
  initClient(apiKey);
  // Verify key by fetching user info
  try {
    await getClient().user.me();
    return true;
  } catch {
    client = new VibenClient({ baseUrl: PLATFORM_URL });
    return false;
  }
}
```

### 4. React Hooks for Desktop (`apps/desktop/src/hooks/use-viben.ts`)

```typescript
import { useState, useEffect, useCallback } from 'react';
import {
  getClient,
  searchPackages,
  installMcpPackage,
  installSkillPackage,
  syncWorkspace,
} from '@/lib/viben';
import type { McpPackage, SkillPackage, Workspace } from '@viben/api-client';

export function useMcpSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<McpPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await searchPackages(q, 'mcp');
      setResults(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query) search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  return { query, setQuery, results, loading, error, search };
}

export function useSkillSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SkillPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await searchPackages(q, 'skill');
      setResults(response.data as SkillPackage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query) search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  return { query, setQuery, results, loading, error, search };
}

export function useInstallPackage() {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const installMcp = useCallback(async (pkg: McpPackage) => {
    setInstalling(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(25);
      const path = await installMcpPackage(pkg);
      setProgress(100);
      return path;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
      throw err;
    } finally {
      setInstalling(false);
    }
  }, []);

  const installSkill = useCallback(async (pkg: SkillPackage) => {
    setInstalling(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(25);
      const path = await installSkillPackage(pkg);
      setProgress(100);
      return path;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
      throw err;
    } finally {
      setInstalling(false);
    }
  }, []);

  return { installing, progress, error, installMcp, installSkill };
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const response = await getClient().workspaces.list();
        setWorkspaces(response.workspaces);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaces();
  }, []);

  const sync = useCallback(async (workspaceId: string) => {
    return syncWorkspace(workspaceId);
  }, []);

  return { workspaces, loading, error, sync };
}
```

### 5. Package Structure (`packages/api-client/package.json`)

```json
{
  "name": "@viben/api-client",
  "version": "1.0.0",
  "description": "API client for Viben platform",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 6. Entry Point (`packages/api-client/src/index.ts`)

```typescript
export { VibenClient, ApiError } from './client';
export type { VibenClientConfig } from './client';

// Backwards compatibility aliases
export { VibenClient as BrowseMcpClient } from './client';
export type { VibenClientConfig as BrowseMcpClientConfig } from './client';
export type {
  ListParams,
  PaginatedResponse,
  McpPackage,
  SkillPackage,
  User,
  Favorite,
  Workspace,
  WorkspacePackagesResponse,
} from './types';
```

---

## Acceptance Criteria

- [ ] API client library created as separate package
- [ ] Authentication via API key works
- [ ] MCP package listing and search works
- [ ] Skills package listing and search works
- [ ] Package download works
- [ ] User info fetch works
- [ ] Workspace listing works
- [ ] Workspace package sync works
- [ ] React hooks provided for desktop app
- [ ] Error handling with typed errors
- [ ] TypeScript types exported

---

## Notes

- API client is a separate npm package for reuse
- Uses fetch API for HTTP requests
- Supports both browser and Node.js environments
- Desktop app uses Tauri APIs for file system
- Package downloads saved to app data directory
- Workspace sync enables config management across devices
